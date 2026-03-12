# Assistant Frontend — Design Document

**Date:** 2026-03-12
**Status:** Design / Pre-implementation
**Features:** A013–A016 + P1 fix from Codex review (user-scoped sessions)

---

## 1. Problem & Goal

The .NET API already streams AI responses and emits structured goal/task proposals via SSE. This design covers the frontend that connects to it: a chat interface at `/assistant` where users brain-dump, refine through conversation, review proposed goals/tasks, and confirm writes to Supabase.

---

## 2. Architecture

```
/assistant page (static, 'use client')
  ├── useAssistant hook
  │     ├── fetch(POST) → .NET API /api/assistant/chat
  │     ├── ReadableStream SSE parsing
  │     ├── messages[] state
  │     └── proposal state (overwritten on each new proposal)
  ├── AssistantChat component
  │     ├── Message list (user/assistant bubbles)
  │     ├── Streaming token display
  │     └── Text input + Send button
  └── ProposalReview component (renders below chat when proposal exists)
        ├── Editable goal cards with nested task lists
        ├── Add/delete goals and tasks
        └── "Create in Momentum" → useGoals/useTasks → redirect /goals
```

No new backend endpoints. The only API-side change is scoping session keys by user ID (P1 fix).

---

## 3. User Flow

1. User opens `/assistant` — sees chat interface with brain-dump prompt
2. User types free-form text, hits Send
3. `useAssistant` POSTs to the API with Supabase JWT, reads SSE stream
4. Assistant's response streams in real-time (token by token)
5. Assistant may ask 1–3 clarifying questions (one per turn)
6. User answers in the chat
7. When the model has enough context, it calls `propose_goals` → API emits `event: proposal`
8. ProposalReview panel appears **below the chat** with editable goal/task cards
9. User can **keep chatting** to refine — new proposals overwrite the previous one
10. User can also manually edit proposal cards (always-editable fields)
11. User clicks "Create in Momentum" → frontend writes goals + tasks to Supabase
12. Redirect to `/goals`

---

## 4. SSE Contract (Existing)

**Endpoint:** `POST /api/assistant/chat`
**Auth:** `Authorization: Bearer <supabase_jwt>`
**Request:**
```json
{
  "sessionId": "uuid-string",
  "messages": [{ "role": "user", "content": "string" }]
}
```

**Response:** `text/event-stream` with three event types:

| Event | Format | Meaning |
|-------|--------|---------|
| (default) | `data: {"type":"token","content":"..."}` | Streaming text token |
| `proposal` | `event: proposal\ndata: {"goals":[...]}` | Structured goal/task proposal |
| `done` | `event: done\ndata: {}` | Stream complete |

**Proposal JSON shape (camelCase from .NET):**
```json
{
  "goals": [
    {
      "title": "string",
      "description": "string | null",
      "targetDate": "string | null",
      "tasks": [
        {
          "title": "string",
          "priority": "high | medium | low",
          "dueDate": "string | null",
          "category": "string | null"
        }
      ]
    }
  ]
}
```

---

## 5. Configuration

**Environment variable:** `NEXT_PUBLIC_API_URL`
- Local dev: `http://localhost:5061`
- Production: Azure Container Apps URL (set via GitHub Actions secret)
- Added to `.env.example` and `.env.local`

**API launch settings:** New `Properties/launchSettings.json` in the API project, port 5061.

---

## 6. File Structure

| File | Responsibility |
|------|---------------|
| `src/hooks/useAssistant.ts` | SSE connection, messages state, proposal state, `sendMessage()` |
| `src/components/AssistantChat.tsx` | Message list with user/assistant bubbles, streaming display, text input |
| `src/components/ProposalReview.tsx` | Editable goal/task cards, add/delete items, "Create in Momentum" button |
| `src/app/assistant/page.tsx` | Page shell wiring hook to components |
| `src/app/layout.tsx` | Add Assistant to `NAV_ITEMS` (trailing-slash-aware active matching, same pattern as `/login`) |
| `.env.example` | Add `NEXT_PUBLIC_API_URL` |
| `.env.local` | Add `NEXT_PUBLIC_API_URL=http://localhost:5061` |
| `api/src/Momentum.Api/Properties/launchSettings.json` | New — port 5061 dev profile |
| `api/src/Momentum.Api/Services/AssistantService.cs` | Fix: user-scoped session key |

---

## 7. Component Design

### 7.1 useAssistant Hook

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ProposedTask {
  title: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  category: string | null
}

interface ProposedGoal {
  title: string
  description: string | null
  targetDate: string | null
  tasks: ProposedTask[]
}

interface Proposal {
  goals: ProposedGoal[]
}

function useAssistant() {
  // State
  messages: Message[]
  proposal: Proposal | null
  isStreaming: boolean
  error: string | null

  // Actions
  sendMessage(content: string): Promise<void>

  // Implementation notes:
  // - sessionId: crypto.randomUUID() on mount, stable for page lifetime
  // - fetch(POST) with ReadableStream parsing (not EventSource — POST not supported)
  // - Token events: append to current assistant message
  // - Proposal events: overwrite proposal state (new proposal replaces old)
  // - Done events: set isStreaming = false
  // - Auth: supabase.auth.getSession() → session.access_token
}
```

### 7.2 AssistantChat Component

- **Message list**: Scrollable container, user messages right-aligned (indigo bg), assistant messages left-aligned (gray-900 bg)
- **Streaming**: Last assistant message updates in real-time as tokens arrive
- **Auto-scroll**: Scroll to bottom on new message content
- **Input**: Text input + Send button at bottom, disabled while streaming
- **Initial state**: Empty chat with placeholder text ("Tell the assistant everything on your mind...")

### 7.3 ProposalReview Component

- **Appears below chat** when `proposal` is not null
- **Always-editable fields**: All goal/task fields rendered as inputs by default
- **Goal card**: Title input, description textarea, target date input, nested task list
- **Task row**: Title input, priority dropdown, due date input, category input, delete button
- **Actions**: "Add Goal", "Add Task" (per goal), delete buttons
- **"Create in Momentum" button**: Iterates goals → `createGoal()`, then tasks → `createTask()` with returned `goal_id`. Shows loading state. On success → redirect to `/goals`. On failure → inline error, proposal preserved for retry.
- **Local state only**: Edits modify local state, no API calls until confirm
- **Hook usage**: `createGoal` and `createTask` are passed as props from the page, which instantiates `useGoals` and `useTasks`. This avoids ProposalReview mounting its own hook instances (which would trigger redundant Supabase fetches on mount).

---

## 8. API-Side Fix: User-Scoped Sessions (P1)

From Codex review on PR #19: `SessionStore` keys by `sessionId` only, allowing cross-user session leakage.

**Fix:** Add a `string userId` parameter to `AssistantService.StreamAsync`. The endpoint in `Program.cs` extracts `userId` from `HttpContext.User.FindFirst("sub")` and passes it in. Inside `StreamAsync`, construct the session key as `$"{userId}:{request.SessionId}"` before calling `SessionStore.GetOrCreate` and `SessionStore.GetLock`. No changes needed to `SessionStore` itself — the compound key is constructed at the call site.

The frontend continues to send just a UUID as `sessionId` — scoping is server-side only.

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| API unreachable | Inline error below input: "Couldn't connect to the assistant" |
| 401 Unauthorized | Error: "Session expired — please refresh" |
| Stream interrupted | Show received content + error message |
| Empty proposal (no goals) | Ignore, let chat continue |
| Supabase write failure | Error on ProposalReview, proposal preserved for retry |

Same inline error pattern as the rest of the app (`bg-red-500/10 border border-red-500/30 text-red-400`).

---

## 10. Styling

Follows existing conventions:
- Page root: `max-w-3xl mx-auto`
- Cards: `bg-gray-900 border border-gray-800 rounded-xl p-5`
- Inputs: `bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm`
- Primary button: `bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg`
- User message bubble: `bg-indigo-600 text-white rounded-xl px-4 py-2`
- Assistant message bubble: `bg-gray-900 border border-gray-800 text-gray-100 rounded-xl px-4 py-2`

---

## 11. Open Questions / Future Work

- Accessibility: streaming messages need `aria-live` region for screen readers
- Auto-scroll fires per token during streaming — consider debouncing
- Priority validation: AI-proposed task priorities are trusted; should validate before Supabase write
- Cross-user session isolation test: compound key fix is in place but no dedicated regression test
