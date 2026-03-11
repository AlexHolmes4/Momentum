# AI Goal-Setting Assistant — Design Document

**Date:** 2026-03-09
**Status:** Design / Pre-implementation
**Branch:** `claude/ai-goal-setting-assistant-TCfbH`

---

## 1. Problem & Goal

The hardest part of using Momentum isn't tracking goals — it's knowing what to write down. Users have overlapping, messy thoughts but no structured way to turn that mental fog into trackable goals and tasks.

This feature adds a conversational AI assistant at `/assistant`. The user brain-dumps everything on their mind. The assistant asks a few clarifying questions, then proposes a set of Momentum goals with linked tasks. The user reviews and confirms; the frontend writes directly to Supabase. **The AI never touches the database.**

---

## 2. Architecture Overview

The Momentum frontend stays a **static Next.js export** on Cloudflare Workers. We add a **separate .NET backend API** that handles AI orchestration:

```
┌───────────────────────────────────────┐
│  Cloudflare Workers (static frontend) │
│  Next.js /assistant page              │
│  • Chat UI (EventSource / SSE)        │
│  • Review panel (edit goals/tasks)    │
│  • On confirm → writes Supabase       │
└──────────────────┬────────────────────┘
                   │ POST /api/assistant/chat
                   │ SSE stream ←
                   ▼
┌───────────────────────────────────────┐
│  .NET 10 ASP.NET Core API             │
│  Hosted: Azure Container Apps         │
│  • Semantic Kernel orchestration      │
│  • Claude / OpenAI model calls        │
│  • SSE streaming responses            │
│  • MCP server (future-proof)          │
└──────────────────┬────────────────────┘
                   │
                   ▼
         AI Model (Claude / GPT-4o)
```

### Why static is preserved
- The `/assistant` page is a standard client-side Next.js page with `'use client'`
- It calls the external .NET API just like any other `fetch` call
- Cloudflare Workers continues to serve all static assets unchanged
- No SSR, no API routes needed on the Next.js side

---

## 3. User Flow

1. User opens `/assistant` — sees a chat interface with a prompt to "tell it everything"
2. User types a free-form brain dump
3. Frontend POSTs to `.NET API /api/assistant/chat`, opens `EventSource` for SSE stream
4. API streams back:
   - First: a reflection of what it heard
   - Then: 1–3 focused clarifying questions (one at a time)
5. User answers questions in the chat
6. When the model has enough context, it calls the internal `propose_goals` tool
7. API emits a special SSE event: `event: proposal` with structured JSON payload
8. Frontend parses the proposal and renders the **Review Panel**
9. User can: edit titles, change dates/priorities, delete items, add items
10. User clicks "Create in Momentum" → frontend calls `useGoals` / `useTasks` hooks directly
11. Redirect to `/goals`

---

## 4. Backend: .NET API

### 4.1 Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | .NET 10 ASP.NET Core | Native SSE support, Minimal APIs |
| AI orchestration | Semantic Kernel | MCP-native, model-agnostic, Microsoft supported |
| AI model | Claude via Anthropic API | Best at structured decomposition; swappable |
| MCP server | `ModelContextProtocol.AspNetCore` | Official C# SDK, maintained with Microsoft |
| Hosting | Azure Container Apps | Free tier covers personal use (180k vCPU-s/month) |

### 4.2 Endpoints

```
POST /api/assistant/chat
  Body: { messages: ChatMessage[], sessionId: string }
  Response: text/event-stream (SSE)
  Events:
    data: { type: "token", content: "..." }     ← streaming tokens
    event: proposal
    data: { goals: Goal[], tasks: Task[] }       ← final structured proposal
    event: done
    data: {}

GET /health
  Response: 200 OK
```

### 4.3 Semantic Kernel Orchestration

The AI conversation runs in two phases:

**Phase 1 — Clarification**
- System prompt instructs the model to reflect, then ask at most 3 focused questions (one at a time)
- Model streams responses back as plain text tokens via SSE
- Conversation history is maintained per `sessionId` (in-memory for now; Redis later if needed)

**Phase 2 — Decomposition**
- When the model determines it has enough context, it calls the `propose_goals` kernel function
- This function is defined with strict typed parameters matching our Momentum schema
- Using function calling forces structured JSON output — no parsing fragility

```csharp
// Kernel function definition
[KernelFunction, Description("Propose goals and tasks based on the user's brain dump")]
public GoalProposal ProposeGoals(
    [Description("List of goals with linked tasks")] List<ProposedGoal> goals
) { ... }

// ProposedGoal schema
public record ProposedGoal(
    string Title,
    string? Description,
    string? TargetDate,          // ISO 8601
    List<ProposedTask> Tasks
);

public record ProposedTask(
    string Title,
    string Priority,             // "high" | "medium" | "low"
    string? DueDate,
    string? Category
);
```

When the kernel function is invoked, the API emits the structured proposal via a special SSE event rather than inserting into the DB.

### 4.4 SSE Streaming Implementation

```csharp
app.MapPost("/api/assistant/chat", async (HttpContext ctx, ChatRequest req, AssistantService svc) =>
{
    ctx.Response.Headers["Content-Type"] = "text/event-stream";
    ctx.Response.Headers["Cache-Control"] = "no-cache";
    ctx.Response.Headers["Connection"] = "keep-alive";

    await foreach (var chunk in svc.StreamAsync(req, ctx.RequestAborted))
    {
        if (chunk.IsProposal)
            await ctx.Response.WriteAsync($"event: proposal\ndata: {chunk.Json}\n\n");
        else
            await ctx.Response.WriteAsync($"data: {chunk.Json}\n\n");

        await ctx.Response.Body.FlushAsync();
    }

    await ctx.Response.WriteAsync("event: done\ndata: {}\n\n");
});
```

### 4.5 CORS

Configure to allow the Cloudflare Workers domain:
```
https://momentum.alexgholmes.workers.dev
http://localhost:3000 (dev)
```

---

## 5. Frontend: `/assistant` Page

### 5.1 Components

```
src/app/assistant/page.tsx          'use client' — main page
src/components/AssistantChat.tsx    Chat UI with message list + input
src/components/ProposalReview.tsx   Review panel: edit goals/tasks before confirming
src/hooks/useAssistant.ts          Manages SSE connection, message state, proposal state
```

### 5.2 `useAssistant` Hook

```typescript
export function useAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  async function sendMessage(content: string) {
    // POST to .NET API, open EventSource, handle SSE events
    // On 'proposal' event: setProposal(...)
    // On token: append to last assistant message
  }

  return { messages, proposal, isStreaming, sendMessage }
}
```

### 5.3 ProposalReview Component

- Lists proposed goals with nested task lists
- Inline editing: title, date, priority, category
- Delete button on each item
- "Add goal" / "Add task" buttons
- "Create in Momentum" button → calls `createGoal` and `createTask` from existing hooks
- Loading state while creating, then redirect to `/goals`

---

## 6. MCP Server (Future-Proof)

The .NET API also runs as an MCP server, exposing Momentum capabilities as tools. This means any MCP-compatible client — Claude Desktop, Cursor, another AI agent — can use Momentum without the web UI.

### 6.1 Exposed MCP Tools

| Tool | Description |
|------|-------------|
| `get_goals` | List active goals with progress |
| `get_tasks` | List active tasks, optionally filtered by goal |
| `create_goal` | Create a new goal |
| `create_task` | Create a new task, optionally linked to a goal |
| `complete_task` | Mark a task as complete (moves to archive) |
| `brain_dump` | Start the clarification conversation and propose goals/tasks |

### 6.2 Implementation

Using the official `ModelContextProtocol.AspNetCore` NuGet package:

```csharp
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithTools<MomentumTools>();
```

The `MomentumTools` class uses Supabase service-role key (server-side only) to query/mutate the DB on behalf of the user, protected by MCP authentication.

### 6.3 Usage Scenarios

- **Claude Desktop**: Add Momentum MCP server → user can say "show me my goals" or "I want to get my AWS cert, help me plan it"
- **Future agents**: Any automated workflow that needs to create or query Momentum data
- **AI IDEs**: Surface today's tasks in Cursor/Windsurf context

---

## 7. Model Evaluation Framework

To save tokens and ensure consistency as we iterate on prompts and potentially switch models, we set up a lightweight eval suite using **promptfoo**.

### 7.1 What We Test

1. **Schema validity**: Does the `propose_goals` output always match our JSON schema?
2. **Question discipline**: Does the model ask ≤3 clarifying questions before decomposing?
3. **Goal quality**: Are goals actionable and non-redundant for typical inputs?
4. **Task linkage**: Are all tasks linked to a goal?
5. **Date reasonableness**: Are suggested dates sensible relative to today?

### 7.2 Structure

```
api/
  evals/
    promptfooconfig.yaml     ← test suite config
    test-cases/
      simple-goal.yaml       ← "I want to get my AWS cert"
      multi-goal.yaml        ← "AWS cert, piano, side project"
      vague-input.yaml       ← "I need to get my life together"
      already-clear.yaml     ← well-specified input (should not over-ask)
    scorers/
      schema-validator.js    ← checks output matches Goal/Task schema
      question-count.js      ← counts clarifying questions ≤ 3
```

### 7.3 Run Against Multiple Models

```yaml
# promptfooconfig.yaml
providers:
  - anthropic:claude-haiku-4-5-20251001
  - anthropic:claude-sonnet-4-6
  - openai:gpt-4o-mini
  - openai:gpt-4o
```

Run with: `npx promptfoo eval` — produces a comparison table of score/cost/latency per model.
This lets us pick the cheapest model that scores well enough, and catch regressions when we change prompts.

### 7.4 CI Integration

Add a GitHub Actions step that runs evals on PR to catch prompt regressions before deploy.

---

## 8. Hosting

### Azure Container Apps (Recommended)

| Resource | Free Allocation |
|----------|----------------|
| vCPU-seconds | 180,000 / month |
| GiB-seconds | 360,000 / month |
| HTTP requests | 2,000,000 / month |

For a personal productivity app with a single user, this is effectively free. With scale-to-zero enabled, the container sleeps when not in use (cold start ~1-2s, acceptable for a personal tool).

**Deployment:**
1. Dockerfile in `api/` builds the .NET 10 API
2. GitHub Actions builds and pushes to Azure Container Registry (100GB free)
3. Azure Container Apps pulls and deploys

**Avoid Azure Functions for this feature** — the consumption plan has execution time limits and SSE streaming responses are not cleanly supported. Container Apps is the right Azure choice.

**Alternatives if Azure isn't preferred:**
- **fly.io** — container-native, scale-to-zero, global edge (~$10.70/mo for 1 vCPU / 2GB RAM; best non-Azure option)
- **Railway.app** — trial credit only ($5), not perpetual free; good for prototyping

---

## 9. System Prompt Design

The assistant needs a carefully tuned system prompt. Key constraints:

1. **Reflect first**: Repeat back what you heard before asking anything
2. **Ask one question at a time**: Never ask more than one question per turn
3. **Maximum 3 clarifications**: After 3 questions (or if input is already clear), decompose
4. **Call `propose_goals` to finish**: Must use the structured tool, never free-text the final proposal
5. **Momentum schema awareness**: Goals have title, description, target_date; Tasks have title, priority, due_date, category, goal_id

```
You are a goal-setting assistant for Momentum, a personal productivity app.
Your job is to help the user translate their thoughts into clear, trackable goals with linked tasks.

RULES:
1. Start by reflecting back what you heard ("It sounds like you want to...")
2. Ask at most 3 clarifying questions, one at a time, only when genuinely needed
3. Once you have enough context, call the propose_goals function — never describe proposals in text
4. Goals should be meaningful objectives (e.g. "Get AWS Solutions Architect certification")
5. Tasks should be specific, actionable steps (e.g. "Complete CloudAcademy course Module 3")
6. Suggest realistic priorities: high for blockers, medium for steady progress, low for nice-to-haves
7. Suggest target dates if the user mentioned timeframes
```

---

## 10. Implementation Plan (Future Sessions)

The implementation spans multiple sessions:

| Session | Work | Status |
|---------|------|--------|
| 1 | Scaffold .NET 10 API, cross-cutting concerns (CORS, error handling, JWT auth, rate limiting, logging) | ✅ Done |
| 2 | Chat endpoint with SSE streaming, conversation history, basic system prompt, FluentValidation | ✅ Done |
| 3 | `propose_goals` kernel function, structured output, `event: proposal` SSE event | ✅ Done |
| 4 | Frontend: `/assistant` page, `useAssistant` hook, `AssistantChat` component | **Next** |
| 5 | Frontend: `ProposalReview` component, inline editing, Supabase write on confirm | |
| 6 | MCP server setup: `ModelContextProtocol.AspNetCore`, Momentum tools | |
| 7 | Eval framework: promptfoo config, test cases, CI integration | |
| 8 | Azure Container Apps deployment, Dockerfile, GitHub Actions workflow | |

---

## 11. API Cross-Cutting Concerns

### 11.1 Authentication: Supabase JWT Forwarding

The frontend sends the user's Supabase access token in the `Authorization: Bearer <token>` header. The API verifies the JWT signature using Supabase's JWT secret (from env var).

- ASP.NET middleware extracts and validates the JWT on every request (except `/health`)
- The `sub` claim gives us the user ID — available to all endpoints via `HttpContext.User`
- No separate user table in the API — Supabase is the identity provider

### 11.2 Logging: Structured JSON to Stdout

- Configure .NET's built-in `ILogger` with JSON console formatter
- Log request/response metadata (method, path, status, duration) via middleware
- Log AI model calls (model, token count, latency) in the assistant service
- Azure Container Apps captures stdout into Log Analytics (5 GB/month free tier)
- No extra logging packages — `Microsoft.Extensions.Logging` is sufficient

### 11.3 Error Handling: Global Middleware + SSE Error Events

- **REST endpoints**: Global exception handler returns RFC 7807 Problem Details JSON (`application/problem+json`). Logs the full exception server-side, returns sanitized message to client.
- **SSE streaming**: Wrap the streaming loop in try/catch. On error, emit `event: error` with `{ message: "Something went wrong" }` before closing the stream. Frontend can display an error state instead of hanging.

### 11.4 Rate Limiting: Per-User via Built-in Middleware

- Use ASP.NET's `Microsoft.AspNetCore.RateLimiting` (built-in, no extra package)
- Fixed window: **10 requests/minute per user** (keyed on JWT `sub` claim)
- Returns `429 Too Many Requests` with `Retry-After` header
- `/health` endpoint is excluded from rate limiting
- Easy to adjust thresholds via `appsettings.json`

### 11.5 Request Validation: FluentValidation

- Add `FluentValidation.AspNetCore` NuGet package
- Validators for request DTOs (e.g., `ChatRequest` must have non-empty messages, sessionId within length limits)
- Validation runs before the endpoint handler — invalid requests get a `400 Bad Request` with structured errors
- Keeps validation logic out of business code

### 11.6 Configuration: appsettings.json + Environment Variables

```
appsettings.json (committed):
  - AllowedOrigins: ["https://momentum.alexgholmes.workers.dev", ...]
  - RateLimit: { PermitLimit: 10, WindowSeconds: 60 }
  - Logging: { LogLevel: { Default: "Information" } }

Environment variables (secrets, not committed):
  - ANTHROPIC_API_KEY
  - SUPABASE_JWT_SECRET
  - SUPABASE_URL (for MCP tools in Session 6)
  - SUPABASE_SERVICE_ROLE_KEY (for MCP tools in Session 6)
```

---

## 12. Documentation References

See **[docs/ai-assistant-references.md](../ai-assistant-references.md)** — standalone file with all verified tech stack links, updated across sessions.

---

## 13. Future: AI Usage Metering

Postman-style monthly token quota per user with progressive warnings. Requires its own design session.

- Track cumulative AI token consumption per user per billing period (Supabase table)
- Progressive warnings surfaced in chat UI: 50% → 70% → 80% → 90% → 100%
- At 100%: block AI requests, show upgrade CTA
- Configurable monthly limits per tier (free vs paid)
- Separate from infrastructure rate limiting (req/min) — this is a business feature

---

## 14. Open Questions

- **Session state**: In-memory conversation history works for a single replica. If we ever scale, need Redis or Supabase for persistence.
- **Model choice**: Claude Sonnet is ideal for quality but Haiku is much cheaper. Evals will determine the right default.
