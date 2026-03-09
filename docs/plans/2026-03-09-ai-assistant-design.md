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

**Alternatives if Azure isn't preferred:**
- **Railway.app** — simple Docker deployment, generous free tier, no cold starts
- **fly.io** — free tier with 3 shared VMs, global edge deployment

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

| Session | Work |
|---------|------|
| 1 | Scaffold .NET 10 API project, Semantic Kernel setup, health endpoint, CORS |
| 2 | Chat endpoint with SSE streaming, conversation history, basic system prompt |
| 3 | `propose_goals` kernel function, structured output, `event: proposal` SSE event |
| 4 | Frontend: `/assistant` page, `useAssistant` hook, `AssistantChat` component |
| 5 | Frontend: `ProposalReview` component, inline editing, Supabase write on confirm |
| 6 | MCP server setup: `ModelContextProtocol.AspNetCore`, Momentum tools |
| 7 | Eval framework: promptfoo config, test cases, CI integration |
| 8 | Azure Container Apps deployment, Dockerfile, GitHub Actions workflow |

---

## 11. Documentation References

This section captures verified documentation links for all technologies used in this feature. These were web-searched on 2026-03-09 to ensure they reflect the current state of each technology.

### Microsoft Agent Framework & Semantic Kernel

| Topic | URL |
|-------|-----|
| Semantic Kernel Docs (Microsoft Learn) | https://learn.microsoft.com/en-us/semantic-kernel/ |
| Semantic Kernel Agent Framework | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/ |
| Microsoft Agent Framework announcement | https://devblogs.microsoft.com/semantic-kernel/semantic-kernel-and-microsoft-agent-framework/ |
| SK + Microsoft Agent Framework (Visual Studio Magazine, Oct 2025) | https://visualstudiomagazine.com/articles/2025/10/01/semantic-kernel-autogen--open-source-microsoft-agent-framework.aspx |
| Semantic Kernel GitHub | https://github.com/microsoft/semantic-kernel |
| SK Quick Start Guide | https://github.com/MicrosoftDocs/semantic-kernel-docs/blob/main/semantic-kernel/get-started/quick-start-guide.md |

**Key note (2026):** Microsoft recommends Semantic Kernel v1.x for existing/near-term projects. For new projects, **Microsoft Agent Framework** (SK + AutoGen unified) is the future direction. For this feature, Semantic Kernel is appropriate and will migrate cleanly.

### Model Context Protocol (MCP)

| Topic | URL |
|-------|-----|
| MCP Official Docs | https://modelcontextprotocol.io |
| MCP Specification (2025-11-25) | https://modelcontextprotocol.io/specification/2025-11-25 |
| MCP GitHub Organization | https://github.com/modelcontextprotocol |
| MCP C# SDK GitHub | https://github.com/modelcontextprotocol/csharp-sdk |
| MCP C# SDK API Docs | https://modelcontextprotocol.github.io/csharp-sdk/ |
| Build an MCP server in C# (.NET Blog) | https://devblogs.microsoft.com/dotnet/build-a-model-context-protocol-mcp-server-in-csharp/ |
| MCP C# SDK v1.0 release | https://devblogs.microsoft.com/dotnet/release-v10-of-the-official-mcp-csharp-sdk/ |
| SK + MCP integration guide | https://devblogs.microsoft.com/semantic-kernel/integrating-model-context-protocol-tools-with-semantic-kernel-a-step-by-step-guide/ |
| Give SK agents access to MCP servers | https://learn.microsoft.com/en-us/semantic-kernel/concepts/plugins/adding-mcp-plugins |
| Building an MCP server with SK | https://devblogs.microsoft.com/semantic-kernel/building-a-model-context-protocol-server-with-semantic-kernel/ |

**NuGet packages:**
- `ModelContextProtocol` — core + DI
- `ModelContextProtocol.AspNetCore` — HTTP/SSE server
- `ModelContextProtocol.Core` — low-level only

### SSE Streaming in ASP.NET Core

| Topic | URL |
|-------|-----|
| SSE in ASP.NET Core + .NET 10 (Milan Jovanović) | https://www.milanjovanovic.tech/blog/server-sent-events-in-aspnetcore-and-dotnet-10 |
| SSE + Semantic Kernel streaming chat | https://www.petkir.at/blog/semantic-kernel/01_chat_03_sse |
| SSE in ASP.NET Core (antondevtips) | https://antondevtips.com/blog/real-time-server-sent-events-in-asp-net-core |
| Pragmatic SSE Guide (Roxeem) | https://roxeem.com/2025/10/24/a-pragmatic-guide-to-server-sent-events-sse-in-asp-net-core/ |
| SSE MCP Server in .NET (Medium) | https://medium.com/@hany.habib1988/building-a-server-sent-event-sse-mcp-server-with-net-core-c-48ac55000336 |

**Key note:** .NET 10 adds native `TypedResults.ServerSentEvents` / `Results.ServerSentEvents` with `IAsyncEnumerable<T>`. For earlier .NET versions, set `Content-Type: text/event-stream` and write `data: ...\n\n` manually.

### LLM Evaluation

| Topic | URL |
|-------|-----|
| promptfoo GitHub (open source) | https://github.com/promptfoo/promptfoo |
| Braintrust eval platform | https://www.braintrust.dev |
| Best prompt eval tools 2025 (Braintrust) | https://www.braintrust.dev/articles/best-prompt-evaluation-tools-2025 |
| LLM eval metrics guide | https://www.braintrust.dev/articles/llm-evaluation-metrics-guide |

**Recommendation:** Use **promptfoo** for this project — open source, CLI-first, YAML config, works in GitHub Actions, compares multiple models side by side.

### Hosting

| Topic | URL |
|-------|-----|
| Azure Container Apps | https://azure.microsoft.com/en-us/products/container-apps |
| Azure Container Apps Pricing | https://azure.microsoft.com/en-us/pricing/details/container-apps/ |
| Azure Container Apps Billing (free tier details) | https://learn.microsoft.com/en-us/azure/container-apps/billing |

---

## 12. Open Questions

- **Auth**: The .NET API needs to verify the caller is a valid Momentum user. Options: pass Supabase JWT in `Authorization` header and verify server-side, or use a simple API key for now.
- **Session state**: In-memory conversation history works for a single replica. If we ever scale, need Redis or Supabase for persistence.
- **Model choice**: Claude Sonnet is ideal for quality but Haiku is much cheaper. Evals will determine the right default.
- **Rate limiting**: For a personal app, probably not needed, but consider if the API is exposed via MCP to multiple clients.
