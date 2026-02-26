# Session 6 — Tasks Display (F018-F020) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the read-only Tasks list page with TaskCard components and priority color coding.

**Architecture:** Tasks page mirrors the Goals page pattern — `useTasks` hook for data, `useGoals` for goal name resolution, `sortTasks` for default ordering, `TaskCard` as a presentational component. No action buttons this session.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase client-side queries via existing hooks.

---

## Pre-flight

Before starting, create the feature branch and start the dev server:

```bash
git checkout -b feat/session-6-tasks-display
```

Start dev server: use preview_start with name "Momentum Dev".

---

### Task 1: Create TaskCard component (F019 + F020)

Build the presentational component first so the page can consume it.

**Files:**
- Create: `src/components/TaskCard.tsx`

**Step 1: Create TaskCard.tsx with priority color coding**

```tsx
'use client'
import type { Task } from '@/hooks/useTasks'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

type Props = {
  task: Task
  goalTitle?: string
}

export function TaskCard({ task, goalTitle }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Row 1: Title + priority badge */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-white font-semibold text-base leading-snug">
          {task.title}
        </h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low
          }`}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      {/* Row 2: Metadata */}
      {(task.due_date || task.category || goalTitle) && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {task.due_date && (
            <span className="text-xs text-gray-500">
              Due:{' '}
              <span className="text-gray-300">
                {new Date(task.due_date).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </span>
          )}
          {task.category && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {task.category}
            </span>
          )}
          {goalTitle && (
            <span className="text-xs text-indigo-400">
              → {goalTitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: Zero TypeScript errors, all static routes generated.

**Step 3: Commit**

```bash
git add src/components/TaskCard.tsx
git commit -m "feat(F019+F020): add TaskCard with priority color coding"
```

---

### Task 2: Build Tasks list view (F018)

Wire up the page with hooks, sorting, goal resolution, and all three states.

**Files:**
- Modify: `src/app/tasks/page.tsx` (replace stub)

**Step 1: Replace tasks/page.tsx with full implementation**

```tsx
'use client'
import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { sortTasks } from '@/lib/taskHelpers'
import { TaskCard } from '@/components/TaskCard'

export default function TasksPage() {
  const { tasks, loading, error } = useTasks()
  const { goals } = useGoals()

  // Build goal name lookup: id → title
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Default sort: priority (high → medium → low)
  const sorted = useMemo(() => sortTasks(tasks, 'priority'), [tasks])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading tasks…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load tasks: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active tasks yet</p>
          <p className="text-sm">Create your first task to get started.</p>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && sorted.length > 0 && (
        <ul className="flex flex-col gap-4">
          {sorted.map(task => (
            <li key={task.id}>
              <TaskCard
                task={task}
                goalTitle={task.goal_id ? goalMap[task.goal_id] : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: Zero TypeScript errors, `/tasks` route generated as static page.

**Step 3: Verify page structure with preview_snapshot**

Navigate to `http://localhost:3000/tasks` and run `preview_snapshot`.
Expected: Page heading "Tasks" visible. If DB has tasks, TaskCard elements render with titles and priority badges. If DB is empty, "No active tasks yet" empty state renders.

**Step 4: Run existing tests to confirm no regressions**

Run: `npm test`
Expected: All 11 taskHelpers tests pass.

**Step 5: Commit**

```bash
git add src/app/tasks/page.tsx
git commit -m "feat(F018): add Tasks list view with sorting and goal resolution"
```

---

### Task 3: Update feature tracker and progress log

**Files:**
- Modify: `claude-features.json` — set F018, F019, F020 status to `"passing"`
- Modify: `claude-progress.txt` — append Session 6 summary

**Step 1: Update claude-features.json**

Change these three entries from `"failing"` to `"passing"`:
- `F018` (line 24)
- `F019` (line 25)
- `F020` (line 26)

**Step 2: Append to claude-progress.txt**

```
---
[Session 6 — Tasks Display — 2026-02-23]
STATUS: Complete
COMPLETED:
  - F019+F020: src/components/TaskCard.tsx — title, priority badge (red/amber/green), due date, category pill, goal link label
  - F018: src/app/tasks/page.tsx — full task list with useTasks, useGoals for name resolution, sortTasks priority default, loading/error/empty states
VERIFIED:
  - npm run build passes cleanly
  - npm test passes (11 taskHelpers tests, no regressions)
  - Tasks page renders at localhost:3000/tasks with correct structure
  - Priority badges show correct color coding per CLAUDE.md conventions
NOTES:
  - TaskCard is read-only — action buttons (complete/edit/delete) come in F021-F024
  - Goal name resolution is page-level (goalMap from useGoals), not per-card queries
  - Task type imported from useTasks hook (structurally identical to goalHelpers Task type)
NEXT:
  Session 7: F021 (Create task form), F022 (Edit task), F023 (Complete task), F024 (Delete task)
---
```

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "chore: mark F018-F020 passing, update progress log"
```

---

### Task 4: Push branch and provide PR info

**Step 1: Push the feature branch**

```bash
git push -u origin feat/session-6-tasks-display
```

**Step 2: Provide PR creation URL**

Since `gh` CLI is not available, provide the GitHub URL for manual PR creation:

```
https://github.com/AlexHolmes4/Momentum/compare/main...feat/session-6-tasks-display
```

PR title: `feat: add Tasks list view with TaskCard and priority colors (F018-F020)`

PR body:
```
## Summary
- F019+F020: TaskCard component with priority color-coded badges (high=red, medium=amber, low=green), due date, category pill, goal link label
- F018: Tasks list page with priority sorting, goal name resolution, loading/error/empty states

## Test plan
- [ ] `npm run build` passes
- [ ] `npm test` passes (11 existing tests)
- [ ] Tasks page renders at /tasks
- [ ] Priority badges show correct colors
- [ ] Goal names display on linked tasks
- [ ] Empty state shows when no tasks exist
```
