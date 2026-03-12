# Assistant Frontend Implementation Plan

> **Status: COMPLETE** — All 8 tasks implemented and merged to `develop` (2026-03-12). 34/34 API tests passing, static build succeeds.

**Goal:** Build the chat UI at `/assistant` that connects to the .NET SSE API, streams AI responses, and lets users review/edit/confirm goal+task proposals before writing to Supabase.

**Architecture:** The frontend has four new files: a `useAssistant` hook (SSE connection + state), `AssistantChat` (message bubbles + input), `ProposalReview` (editable goal/task cards + Supabase write), and the `/assistant` page shell that wires them together. One API-side fix scopes session keys by user ID. No new backend endpoints.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind CSS v4, Supabase client (`@supabase/ssr`), .NET 10 SSE API

**Features:** A013 (page), A014 (hook), A015 (chat component), A016 (proposal component), P1 (user-scoped sessions)

**Design doc:** `docs/plans/2026-03-12-assistant-frontend-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `api/src/Momentum.Api/Services/AssistantService.cs` | Add `userId` param, compound session key | Modify |
| `api/src/Momentum.Api/Program.cs` | Extract `sub` claim, pass to `StreamAsync` | Modify |
| `.env.example` | Add `NEXT_PUBLIC_API_URL` | Modify |
| `.env.local` | Add `NEXT_PUBLIC_API_URL=http://localhost:5061` | Modify |
| `src/hooks/useAssistant.ts` | SSE connection, messages/proposal state, `sendMessage()` | Create |
| `src/components/AssistantChat.tsx` | Message list, streaming display, text input | Create |
| `src/components/ProposalReview.tsx` | Editable goal/task cards, Supabase write, redirect | Create |
| `src/app/assistant/page.tsx` | Page shell wiring hook → components | Create |
| `src/app/layout.tsx` | Add `/assistant` to `NAV_ITEMS` | Modify |

---

## Chunk 1: API Fix + Environment Config

### Task 1: User-scoped session keys (P1 fix)

**Files:**
- Modify: `api/src/Momentum.Api/Services/AssistantService.cs`
- Modify: `api/src/Momentum.Api/Program.cs`
- Test: `api/tests/Momentum.Api.Tests/` (existing test suite)

The `SessionStore` keys by `sessionId` alone, so two users with the same sessionId share conversation history. Fix: construct a compound key `"{userId}:{sessionId}"` in `AssistantService.StreamAsync`.

- [ ] **Step 1: Add `userId` parameter to `StreamAsync`**

In `api/src/Momentum.Api/Services/AssistantService.cs`, change the method signature and use a compound session key:

```csharp
public async IAsyncEnumerable<StreamChunk> StreamAsync(
    ChatRequest request,
    string userId,
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    var sessionKey = $"{userId}:{request.SessionId}";
    var sessionLock = _sessionStore.GetLock(sessionKey);
    await sessionLock.WaitAsync(cancellationToken);
    try
    {
        var history = _sessionStore.GetOrCreate(sessionKey);
        // ... rest unchanged
```

Replace both occurrences of `request.SessionId` (in `GetLock` and `GetOrCreate` calls) with `sessionKey`.

- [ ] **Step 2: Extract `sub` claim in endpoint and pass to `StreamAsync`**

In `api/src/Momentum.Api/Program.cs`, update the endpoint to extract `userId` from the JWT and pass it:

```csharp
app.MapPost("/api/assistant/chat", async (
    ChatRequest req,
    IValidator<ChatRequest> validator,
    AssistantService assistant,
    HttpContext ctx,
    ClaimsPrincipal user) =>
{
    var validationResult = await validator.ValidateAsync(req);
    if (!validationResult.IsValid)
        return Results.ValidationProblem(validationResult.ToDictionary());

    var userId = user.FindFirst("sub")?.Value ?? "anonymous";

    async IAsyncEnumerable<SseItem<object>> StreamEvents(
        [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chunk in assistant.StreamAsync(req, userId, ct))
        {
```

Add `ClaimsPrincipal user` to the parameter list and `using System.Security.Claims;` at the top if not already there.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd api && dotnet test --verbosity normal`
Expected: All 34 tests pass. The tests use fake JWTs that include a `sub` claim (via `JwtHelper.GenerateToken()`), so the `FindFirst("sub")` will return a value.

- [ ] **Step 4: Commit**

```bash
git add api/src/Momentum.Api/Services/AssistantService.cs api/src/Momentum.Api/Program.cs
git commit -m "fix: scope session keys by userId to prevent cross-user leakage (P1)"
```

---

### Task 2: Environment config + API launch settings

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`
- Create: `api/src/Momentum.Api/Properties/launchSettings.json`

- [ ] **Step 1: Add `NEXT_PUBLIC_API_URL` to `.env.example`**

Append to `.env.example`:

```
# AI Assistant API — .NET backend for chat/proposals
# Local dev: http://localhost:5061
# Production: set to your Azure Container Apps URL
NEXT_PUBLIC_API_URL=http://localhost:5061
```

- [ ] **Step 2: Add `NEXT_PUBLIC_API_URL` to `.env.local`**

Append to `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5061
```

Note: `.env.local` is in `.gitignore` (standard Next.js convention) — do NOT commit it.

- [ ] **Step 3: Create `api/src/Momentum.Api/Properties/launchSettings.json`**

```json
{
  "profiles": {
    "Momentum.Api": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "applicationUrl": "http://localhost:5061",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

This ensures `dotnet run` uses port 5061 by default, matching the frontend's `NEXT_PUBLIC_API_URL`.

- [ ] **Step 4: Commit**

```bash
git add .env.example api/src/Momentum.Api/Properties/launchSettings.json
git commit -m "config: add NEXT_PUBLIC_API_URL and API launchSettings (port 5061)"
```

---

## Chunk 2: useAssistant Hook

### Task 3: Create the useAssistant hook

**Files:**
- Create: `src/hooks/useAssistant.ts`

This is the core data layer. It manages the SSE connection to the API, streaming state, message history, and proposal state. Uses `fetch` + `ReadableStream` (not `EventSource`, which doesn't support POST).

**SSE parsing notes (from API implementation):**
- Token events: no `event:` field, just `data: {"type":"token","content":"..."}\n\n`
- Proposal events: `event: proposal\ndata: {"goals":[...]}\n\n`
- Done events: `event: done\ndata: {}\n\n`
- Proposals arrive AFTER all tokens (never interleaved)
- .NET serializes with camelCase by default (`System.Text.Json`)

- [ ] **Step 1: Create `src/hooks/useAssistant.ts`**

```typescript
'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// --- Types ---

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ProposedTask {
  title: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  category: string | null
}

export interface ProposedGoal {
  title: string
  description: string | null
  targetDate: string | null
  tasks: ProposedTask[]
}

export interface Proposal {
  goals: ProposedGoal[]
}

// --- Hook ---

export function useAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const isStreamingRef = useRef(false)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreamingRef.current) return

    isStreamingRef.current = true
    setIsStreaming(true)
    setError(null)

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
    }
    setMessages(prev => [...prev, userMsg])

    // Create placeholder assistant message
    const assistantMsgId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setError('Session expired — please refresh')
        isStreamingRef.current = false
        setIsStreaming(false)
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      const response = await fetch(`${apiUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: [{ role: 'user', content: content.trim() }],
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired — please refresh')
        } else {
          setError("Couldn't connect to the assistant")
        }
        // Remove empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
        isStreamingRef.current = false
        setIsStreaming(false)
        return
      }

      // Parse SSE stream
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let currentData = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()! // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)
          } else if (line === '') {
            // Empty line = end of SSE event
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData)

                if (currentEvent === 'proposal') {
                  setProposal(parsed)
                } else if (currentEvent === 'done') {
                  // Stream complete — no action needed
                } else {
                  // Default event = token
                  if (parsed.type === 'token' && parsed.content) {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content + parsed.content }
                          : m
                      )
                    )
                  }
                }
              } catch {
                // Skip malformed JSON
              }
            }
            currentEvent = ''
            currentData = ''
          }
        }
      }
    } catch {
      setError("Couldn't connect to the assistant")
      // Remove empty assistant message on network error
      setMessages(prev => {
        const msg = prev.find(m => m.id === assistantMsgId)
        if (msg && msg.content === '') {
          return prev.filter(m => m.id !== assistantMsgId)
        }
        return prev
      })
    } finally {
      isStreamingRef.current = false
      setIsStreaming(false)
    }
  }, [])

  return {
    messages,
    proposal,
    setProposal,
    isStreaming,
    error,
    sendMessage,
  }
}
```

- [ ] **Step 2: Verify the hook compiles**

Run: `npm run build` (from project root)
Expected: Build succeeds. The hook won't be imported by anything yet, but TypeScript should compile it without errors. If `@/lib/supabase` or other imports cause issues, fix path aliases.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAssistant.ts
git commit -m "feat(A014): add useAssistant hook with SSE streaming and proposal state"
```

---

## Chunk 3: AssistantChat Component

### Task 4: Create the AssistantChat component

**Files:**
- Create: `src/components/AssistantChat.tsx`

Renders the message list (user/assistant bubbles), shows streaming tokens in real-time, and provides the text input. Follows the same pattern as existing components (props-driven, `'use client'`).

- [ ] **Step 1: Create `src/components/AssistantChat.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message } from '@/hooks/useAssistant'

type Props = {
  messages: Message[]
  isStreaming: boolean
  error: string | null
  onSend: (content: string) => void
}

export default function AssistantChat({ messages, isStreaming, error, onSend }: Props) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSend(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg font-medium text-gray-400">What&apos;s on your mind?</p>
            <p className="text-sm mt-1">Tell the assistant everything — goals, tasks, ideas. It&apos;ll help you organize.</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-100'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && msg.content === '' && isStreaming && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isStreaming}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds (component not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add src/components/AssistantChat.tsx
git commit -m "feat(A015): add AssistantChat component with streaming display"
```

---

## Chunk 4: ProposalReview Component

### Task 5: Create the ProposalReview component

**Files:**
- Create: `src/components/ProposalReview.tsx`

Renders editable goal/task cards from the proposal. User can edit fields, add/delete goals and tasks. "Create in Momentum" writes to Supabase via `createGoal`/`createTask` callbacks from the page. On success, redirects to `/goals`.

**Key design decisions:**
- All fields are always editable (inputs, not text that toggles to inputs)
- Local state only — edits don't touch the API until confirm
- `createGoal` and `createTask` are passed as props (page instantiates `useGoals`/`useTasks` to avoid redundant Supabase fetches)
- Priority dropdown uses same options as the rest of the app

- [ ] **Step 1: Create `src/components/ProposalReview.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Proposal, ProposedGoal, ProposedTask } from '@/hooks/useAssistant'

type Props = {
  proposal: Proposal
  onProposalChange: (proposal: Proposal) => void
  createGoal: (input: {
    title: string
    description?: string
    target_date?: string
  }) => Promise<{ id: string }>
  createTask: (input: {
    title: string
    priority?: 'high' | 'medium' | 'low'
    due_date?: string
    category?: string
    goal_id?: string | null
  }) => Promise<unknown>
}

export default function ProposalReview({
  proposal,
  onProposalChange,
  createGoal,
  createTask,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateGoal = (goalIdx: number, updates: Partial<ProposedGoal>) => {
    const goals = proposal.goals.map((g, i) =>
      i === goalIdx ? { ...g, ...updates } : g
    )
    onProposalChange({ goals })
  }

  const deleteGoal = (goalIdx: number) => {
    onProposalChange({ goals: proposal.goals.filter((_, i) => i !== goalIdx) })
  }

  const addGoal = () => {
    const newGoal: ProposedGoal = {
      title: '',
      description: null,
      targetDate: null,
      tasks: [],
    }
    onProposalChange({ goals: [...proposal.goals, newGoal] })
  }

  const updateTask = (goalIdx: number, taskIdx: number, updates: Partial<ProposedTask>) => {
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      const tasks = g.tasks.map((t, ti) =>
        ti === taskIdx ? { ...t, ...updates } : t
      )
      return { ...g, tasks }
    })
    onProposalChange({ goals })
  }

  const deleteTask = (goalIdx: number, taskIdx: number) => {
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      return { ...g, tasks: g.tasks.filter((_, ti) => ti !== taskIdx) }
    })
    onProposalChange({ goals })
  }

  const addTask = (goalIdx: number) => {
    const newTask: ProposedTask = {
      title: '',
      priority: 'medium',
      dueDate: null,
      category: null,
    }
    const goals = proposal.goals.map((g, gi) => {
      if (gi !== goalIdx) return g
      return { ...g, tasks: [...g.tasks, newTask] }
    })
    onProposalChange({ goals })
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)

    try {
      for (const goal of proposal.goals) {
        if (!goal.title.trim()) continue

        const created = await createGoal({
          title: goal.title.trim(),
          description: goal.description?.trim() || undefined,
          target_date: goal.targetDate || undefined,
        })

        for (const task of goal.tasks) {
          if (!task.title.trim()) continue

          await createTask({
            title: task.title.trim(),
            priority: task.priority,
            due_date: task.dueDate || undefined,
            category: task.category?.trim() || undefined,
            goal_id: created.id,
          })
        }
      }

      router.push('/goals')
    } catch {
      setError('Failed to create goals — please try again')
    } finally {
      setSaving(false)
    }
  }

  const hasContent = proposal.goals.some(g => g.title.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Proposed Goals</h2>
        <button
          onClick={addGoal}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add Goal
        </button>
      </div>

      {proposal.goals.map((goal, gi) => (
        <div key={gi} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          {/* Goal fields */}
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(gi, { title: e.target.value })}
              placeholder="Goal title"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => deleteGoal(gi)}
              className="text-gray-500 hover:text-red-400 text-sm px-2 py-2 transition-colors"
              title="Delete goal"
            >
              ✕
            </button>
          </div>

          <textarea
            value={goal.description ?? ''}
            onChange={e => updateGoal(gi, { description: e.target.value || null })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <input
            type="date"
            value={goal.targetDate ?? ''}
            onChange={e => updateGoal(gi, { targetDate: e.target.value || null })}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Tasks */}
          <div className="space-y-2 pl-4 border-l-2 border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tasks</span>
              <button
                onClick={() => addTask(gi)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add Task
              </button>
            </div>

            {goal.tasks.map((task, ti) => (
              <div key={ti} className="flex items-center gap-2">
                <input
                  type="text"
                  value={task.title}
                  onChange={e => updateTask(gi, ti, { title: e.target.value })}
                  placeholder="Task title"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={task.priority}
                  onChange={e => updateTask(gi, ti, { priority: e.target.value as ProposedTask['priority'] })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={e => updateTask(gi, ti, { dueDate: e.target.value || null })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={task.category ?? ''}
                  onChange={e => updateTask(gi, ti, { category: e.target.value || null })}
                  placeholder="Category"
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => deleteTask(gi, ti)}
                  className="text-gray-500 hover:text-red-400 text-sm px-1 transition-colors"
                  title="Delete task"
                >
                  ✕
                </button>
              </div>
            ))}

            {goal.tasks.length === 0 && (
              <p className="text-xs text-gray-600 italic">No tasks yet</p>
            )}
          </div>
        </div>
      ))}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={saving || !hasContent}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors"
      >
        {saving ? 'Creating...' : 'Create in Momentum'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProposalReview.tsx
git commit -m "feat(A016): add ProposalReview component with editable goal/task cards"
```

---

## Chunk 5: Assistant Page + Navigation

### Task 6: Create the assistant page

**Files:**
- Create: `src/app/assistant/page.tsx`

The page shell wires `useAssistant` to `AssistantChat` and `ProposalReview`. It also instantiates `useGoals` and `useTasks` to provide `createGoal`/`createTask` to `ProposalReview` (avoiding redundant Supabase fetches from mounting hooks inside ProposalReview).

- [ ] **Step 1: Create `src/app/assistant/page.tsx`**

```tsx
'use client'

import { useAssistant } from '@/hooks/useAssistant'
import { useGoals } from '@/hooks/useGoals'
import { useTasks } from '@/hooks/useTasks'
import AssistantChat from '@/components/AssistantChat'
import ProposalReview from '@/components/ProposalReview'

export default function AssistantPage() {
  const { messages, proposal, setProposal, isStreaming, error, sendMessage } = useAssistant()
  const { createGoal } = useGoals()
  const { createTask } = useTasks()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">AI Assistant</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-[500px] flex flex-col">
        <AssistantChat
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          onSend={sendMessage}
        />
      </div>

      {proposal && (
        <ProposalReview
          proposal={proposal}
          onProposalChange={setProposal}
          createGoal={createGoal}
          createTask={createTask}
        />
      )}
    </div>
  )
}
```

**Note on `createGoal` return type:** Check that `useGoals().createGoal` returns the created goal object (with `id`). From the existing pattern in `useGoals.ts`, create methods return the inserted row. The `ProposalReview` component needs `created.id` to link tasks. If `createGoal` returns a `Goal` type, the `{ id: string }` type in ProposalReview's props will be satisfied.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds. The page is now reachable at `/assistant` but not yet in the nav.

- [ ] **Step 3: Commit**

```bash
git add src/app/assistant/page.tsx
git commit -m "feat(A013): add assistant page wiring hook to components"
```

---

### Task 7: Add Assistant to navigation

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add `/assistant` to `NAV_ITEMS`**

In `src/app/layout.tsx`, find the `NAV_ITEMS` array (line ~9) and add the assistant entry:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks',     label: 'Tasks' },
  { href: '/goals',     label: 'Goals' },
  { href: '/assistant', label: 'Assistant' },
  { href: '/archive',   label: 'Archive' },
]
```

Place it before Archive (Archive is a utility view, Assistant is a primary feature).

- [ ] **Step 1b: Fix trailing-slash active state matching**

The app uses `trailingSlash: true` (next.config.js), so `pathname` is `/assistant/` but `item.href` is `/assistant`. Update the active state check in the same file (line ~75):

```typescript
// Before:
pathname === item.href
// After:
(pathname === item.href || pathname === item.href + '/')
```

This fixes active highlighting for all nav items, not just Assistant.

- [ ] **Step 2: Verify the build and nav**

Run: `npm run build`
Expected: Build succeeds. The nav should now show "Assistant" as a sidebar item.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Assistant to sidebar navigation"
```

---

## Chunk 6: Integration Verification

### Task 8: End-to-end verification

- [ ] **Step 1: Start the API (if needed)**

```bash
cd api/src/Momentum.Api && dotnet run
```

Confirm it starts on port 5061 (or the configured port). If no `launchSettings.json` exists, create one or pass `--urls http://localhost:5061`.

- [ ] **Step 2: Start the frontend dev server**

```bash
npm run dev
```

Confirm it starts on port 11001.

- [ ] **Step 3: Verify navigation**

Open `http://localhost:11001/assistant/` in browser. Confirm:
- "Assistant" appears in the sidebar
- Active state (indigo background) shows when on the page
- Page renders with "AI Assistant" heading and chat interface

- [ ] **Step 4: Verify chat flow (requires running API with real LLM key)**

If the API has a valid LLM API key configured:
1. Type a message and click Send
2. Confirm tokens stream in real-time
3. Confirm a proposal appears below the chat when the AI calls `propose_goals`
4. Edit a goal title in the proposal
5. Click "Create in Momentum" and confirm redirect to `/goals`

If no LLM key: verify the error handling — "Couldn't connect to the assistant" should appear.

- [ ] **Step 5: Run API tests one final time**

```bash
cd api && dotnet test --verbosity normal
```

Expected: All tests pass.

- [ ] **Step 6: Run frontend build**

```bash
npm run build
```

Expected: Static export succeeds, `out/` directory contains `assistant/index.html`.

- [ ] **Step 7: Update `claude-features.json`**

Set A013, A014, A015, A016 to `"passing"`.

- [ ] **Step 8: Final commit**

```bash
git add claude-features.json
git commit -m "feat: mark A013-A016 as passing"
```
