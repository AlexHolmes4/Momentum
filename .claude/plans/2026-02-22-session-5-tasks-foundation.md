# Session 5: Tasks Foundation (F015, F016, F017) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the tasks data layer (`useTasks` hook + `taskHelpers` utilities) and wire linked-task display into GoalCard so goal progress becomes live.

**Architecture:** Three features build bottom-up: F017 (pure helper functions) first since they have no dependencies, then F016 (`useTasks` hook following the `useGoals` pattern), then F015 (expand GoalCard to show linked tasks and compute real progress). Vitest is added as the test runner for pure function testing. Hook/component verification uses `npm run build` + browser snapshot.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase client-side queries, Vitest (new — for pure functions), Tailwind CSS v4

---

## Pre-flight

### Task 0: Create feature branch

**Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/session-5-tasks-foundation
```

**Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feat/session-5-tasks-foundation`

---

## F017: taskHelpers utility

### Task 1: Install Vitest

**Files:**
- Modify: `package.json` (add vitest devDependency)
- Create: `vitest.config.ts`

**Step 1: Install vitest**

```bash
npm install -D vitest
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Add test script to package.json**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify vitest runs (no tests yet)**

```bash
npm test
```

Expected: "No test files found" (exit 0 or similar — no crash).

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: Write failing tests for filterTasks

**Files:**
- Create: `src/lib/__tests__/taskHelpers.test.ts`

The `Task` type already exists in `src/lib/goalHelpers.ts`. We'll re-export it from `taskHelpers.ts` (Task 3). For now, import from goalHelpers in the test.

**Step 1: Write the failing tests**

Create `src/lib/__tests__/taskHelpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { filterTasks, sortTasks } from '@/lib/taskHelpers'
import type { Task } from '@/lib/goalHelpers'

// Factory helper — creates a minimal valid Task, overrides as needed
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test task',
    priority: overrides.priority ?? 'medium',
    due_date: overrides.due_date ?? null,
    category: overrides.category ?? null,
    goal_id: overrides.goal_id ?? null,
    status: overrides.status ?? 'active',
    completed_at: overrides.completed_at ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  }
}

describe('filterTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: '1', priority: 'high', category: 'work', goal_id: 'g1', due_date: '2026-02-20' }),
    makeTask({ id: '2', priority: 'low', category: 'personal', goal_id: null, due_date: '2026-02-25' }),
    makeTask({ id: '3', priority: 'medium', category: 'work', goal_id: 'g1', due_date: null }),
    makeTask({ id: '4', priority: 'high', category: 'health', goal_id: 'g2', due_date: '2026-02-22' }),
  ]

  it('returns all tasks when no filters', () => {
    expect(filterTasks(tasks, {})).toEqual(tasks)
  })

  it('filters by priority', () => {
    const result = filterTasks(tasks, { priority: 'high' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.priority === 'high')).toBe(true)
  })

  it('filters by category', () => {
    const result = filterTasks(tasks, { category: 'work' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.category === 'work')).toBe(true)
  })

  it('filters by goal_id', () => {
    const result = filterTasks(tasks, { goalId: 'g1' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.goal_id === 'g1')).toBe(true)
  })

  it('filters by search term (case-insensitive title match)', () => {
    const tasksWithTitles = [
      makeTask({ id: '1', title: 'Buy groceries' }),
      makeTask({ id: '2', title: 'Write report' }),
      makeTask({ id: '3', title: 'Buy birthday gift' }),
    ]
    const result = filterTasks(tasksWithTitles, { search: 'buy' })
    expect(result).toHaveLength(2)
  })

  it('combines multiple filters (AND logic)', () => {
    const result = filterTasks(tasks, { priority: 'high', category: 'work' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('returns empty array when no matches', () => {
    expect(filterTasks(tasks, { priority: 'low', category: 'work' })).toEqual([])
  })
})

describe('sortTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: '1', priority: 'low', due_date: '2026-02-25', created_at: '2026-01-03T00:00:00Z' }),
    makeTask({ id: '2', priority: 'high', due_date: '2026-02-20', created_at: '2026-01-01T00:00:00Z' }),
    makeTask({ id: '3', priority: 'medium', due_date: null, created_at: '2026-01-02T00:00:00Z' }),
  ]

  it('sorts by priority (high → medium → low)', () => {
    const result = sortTasks(tasks, 'priority')
    expect(result.map(t => t.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('sorts by due_date ascending (nulls last)', () => {
    const result = sortTasks(tasks, 'due_date')
    expect(result.map(t => t.id)).toEqual(['2', '1', '3'])
  })

  it('sorts by created_at descending (newest first)', () => {
    const result = sortTasks(tasks, 'created_at')
    expect(result.map(t => t.id)).toEqual(['1', '3', '2'])
  })

  it('returns copy, does not mutate original', () => {
    const original = [...tasks]
    sortTasks(tasks, 'priority')
    expect(tasks).toEqual(original)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/taskHelpers'`

---

### Task 3: Implement taskHelpers to make tests pass

**Files:**
- Create: `src/lib/taskHelpers.ts`

**Step 1: Write the implementation**

Create `src/lib/taskHelpers.ts`:

```typescript
// src/lib/taskHelpers.ts
// Pure utility functions for task filtering and sorting.
// No side effects — safe to use anywhere (hooks, components, tests).

import type { Task } from '@/lib/goalHelpers'

export type TaskFilters = {
  priority?: 'high' | 'medium' | 'low'
  category?: string
  goalId?: string
  search?: string
}

export type TaskSort = 'priority' | 'due_date' | 'created_at'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Filter tasks by one or more criteria (AND logic).
 * Returns a new array — does not mutate the input.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.category && task.category !== filters.category) return false
    if (filters.goalId && task.goal_id !== filters.goalId) return false
    if (filters.search) {
      const term = filters.search.toLowerCase()
      if (!task.title.toLowerCase().includes(term)) return false
    }
    return true
  })
}

/**
 * Sort tasks by a given key. Returns a new array — does not mutate the input.
 *
 * - 'priority': high → medium → low
 * - 'due_date': ascending, nulls last
 * - 'created_at': descending (newest first)
 */
export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const copy = [...tasks]
  switch (sort) {
    case 'priority':
      return copy.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
    case 'due_date':
      return copy.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'created_at':
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
    default:
      return copy
  }
}
```

**Step 2: Run tests to verify they pass**

```bash
npm test
```

Expected: All 10 tests PASS.

**Step 3: Verify build still passes**

```bash
npm run build
```

Expected: Build succeeds (taskHelpers is tree-shaken if unused by pages — no errors).

**Step 4: Commit**

```bash
git add src/lib/taskHelpers.ts src/lib/__tests__/taskHelpers.test.ts
git commit -m "feat(F017): add taskHelpers — filterTasks and sortTasks with tests"
```

---

## F016: useTasks hook

### Task 4: Create useTasks hook

**Files:**
- Create: `src/hooks/useTasks.ts`

This hook follows the exact same pattern as `src/hooks/useGoals.ts`: state (tasks, loading, error), fetch on mount, CRUD callbacks with optimistic local state updates.

**Step 1: Write the hook**

Create `src/hooks/useTasks.ts`:

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Task = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  category: string | null
  goal_id: string | null
  status: 'active' | 'completed'
  completed_at: string | null
  created_at: string
}

type CreateTaskInput = {
  title: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string
  category?: string
  goal_id?: string | null
}

type UpdateTaskInput = {
  title?: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string | null
  category?: string | null
  goal_id?: string | null
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setTasks(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    const { data, error: err } = await supabase
      .from('tasks')
      .insert([{ ...input, status: 'active' }])
      .select()
      .single()
    if (err) throw err
    const task = data as Task
    setTasks(prev => [task, ...prev])
    return task
  }, [])

  const updateTask = useCallback(async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const { data, error: err } = await supabase
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const task = data as Task
    setTasks(prev => prev.map(t => (t.id === id ? task : t)))
    return task
  }, [])

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (err) throw err
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const completeTask = useCallback(async (id: string): Promise<void> => {
    // Step 1: Find the task in local state
    const task = (await supabase.from('tasks').select('*').eq('id', id).single()).data as Task | null
    if (!task) throw new Error('Task not found')

    // Step 2: Insert into archived_tasks
    const { error: archiveErr } = await supabase
      .from('archived_tasks')
      .insert([{
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        category: task.category,
        goal_id: task.goal_id,
        completed_at: new Date().toISOString(),
        original_created_at: task.created_at,
      }])
    if (archiveErr) throw archiveErr

    // Step 3: Delete from tasks
    const { error: deleteErr } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (deleteErr) throw deleteErr

    // Step 4: Remove from local state
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    refetch: fetchTasks,
  }
}
```

**Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds. `useTasks` is not yet imported by any page, so it's tree-shaken but must compile cleanly.

**Step 3: Commit**

```bash
git add src/hooks/useTasks.ts
git commit -m "feat(F016): add useTasks hook — CRUD + completeTask with archive"
```

---

## F015: View linked tasks per goal

### Task 5: Add linked tasks expansion to GoalCard

**Files:**
- Modify: `src/components/GoalCard.tsx` — add expand/collapse, display linked tasks, accept `tasks` prop
- Modify: `src/app/goals/page.tsx` — call `useTasks`, pass filtered tasks + computed progress to each GoalCard

**Step 1: Update GoalCard to accept and display linked tasks**

Modify `src/components/GoalCard.tsx`:

Add to the Props type:

```typescript
import type { Task } from '@/hooks/useTasks'

type Props = {
  goal: Goal
  progress: number
  linkedTasks?: Task[]   // <-- NEW
  onEdit?: (id: string, input: { title?: string; description?: string; target_date?: string }) => Promise<Goal>
  onDelete?: (id: string) => Promise<void>
  onArchive?: (id: string) => Promise<Goal>
}
```

Add expand state:

```typescript
const [expanded, setExpanded] = useState(false)
```

Add this section right after the `{/* Progress */}` block and before `{/* Delete confirmation bar */}`:

```tsx
{/* Linked tasks — expandable */}
{linkedTasks && linkedTasks.length > 0 && (
  <div className="mt-3">
    <button
      onClick={() => setExpanded(!expanded)}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
    >
      <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
      {linkedTasks.length} linked task{linkedTasks.length !== 1 ? 's' : ''}
    </button>
    {expanded && (
      <ul className="mt-2 flex flex-col gap-1.5">
        {linkedTasks.map(task => (
          <li
            key={task.id}
            className="flex items-center gap-2 text-sm text-gray-400 pl-4"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              task.priority === 'high' ? 'bg-red-500' :
              task.priority === 'medium' ? 'bg-amber-400' :
              'bg-green-400'
            }`} />
            <span className="truncate">{task.title}</span>
            {task.due_date && (
              <span className="text-xs text-gray-600 shrink-0">
                {new Date(task.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

**Step 2: Update Goals page to fetch tasks and compute progress**

Modify `src/app/goals/page.tsx`:

Add `useTasks` import and call:

```typescript
import { useTasks } from '@/hooks/useTasks'
import { calculateProgress } from '@/lib/goalHelpers'
```

Inside the component, after the `useGoals()` call:

```typescript
const { tasks } = useTasks()
```

Update the GoalCard rendering in the goals list to pass real progress and linked tasks:

```tsx
{goals.map(goal => {
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id)
  const progress = calculateProgress(linkedTasks as import('@/lib/goalHelpers').Task[])
  return (
    <li key={goal.id}>
      <GoalCard
        goal={goal}
        progress={progress}
        linkedTasks={linkedTasks}
        onEdit={updateGoal}
        onDelete={deleteGoal}
        onArchive={archiveGoal}
      />
    </li>
  )
})}
```

Note: The `Task` types from `useTasks` and `goalHelpers` are structurally identical. The cast is safe. If this feels fragile, an alternative is to have `taskHelpers.ts` and `useTasks.ts` both import the `Task` type from `goalHelpers.ts` (it's already defined there). The cast ensures type-checker agreement without refactoring the import graph.

**Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds — no TypeScript errors.

**Step 4: Start dev server and verify with snapshot**

Start the dev server via `preview_start` (name: "Momentum Dev").

Navigate to `/goals` and use `preview_snapshot` to verify:
- GoalCard renders with progress bar (0% if no linked tasks)
- If tasks exist linked to a goal, the "N linked tasks" button appears
- Clicking the button expands to show task titles with priority dots

**Step 5: Commit**

```bash
git add src/components/GoalCard.tsx src/app/goals/page.tsx
git commit -m "feat(F015): show linked tasks per goal with live progress"
```

---

## Finalize

### Task 6: Update feature tracker and progress log

**Files:**
- Modify: `claude-features.json` — set F015, F016, F017 to `"passing"`
- Modify: `claude-progress.txt` — append Session 5 summary

**Step 1: Update claude-features.json**

Change these three entries from `"failing"` to `"passing"`:
- `F015` — View linked tasks per goal
- `F016` — useTasks hook
- `F017` — taskHelpers utility

**Step 2: Append to claude-progress.txt**

```
---
[Session 5 — Tasks Foundation — 2026-02-22]
STATUS: Complete
COMPLETED:
  - F017: src/lib/taskHelpers.ts — filterTasks (priority/category/goalId/search, AND logic) + sortTasks (priority/due_date/created_at) with full Vitest test suite
  - F016: src/hooks/useTasks.ts — useTasks hook (fetchTasks, createTask, updateTask, deleteTask, completeTask with archive flow)
  - F015: Expanded GoalCard to show linked tasks with priority dots + due dates; Goals page now computes live progress via calculateProgress
  - Added Vitest with vitest.config.ts and npm test script
VERIFIED:
  - All 10 taskHelpers unit tests pass (npm test)
  - npm run build passes cleanly
  - Goals page renders live progress bars and expandable linked tasks
NOTES:
  - Task type defined in both goalHelpers.ts and useTasks.ts (structurally identical) — cast used in goals/page.tsx
  - completeTask does INSERT into archived_tasks + DELETE from tasks (two-step operation)
  - Vitest config uses path alias @/ matching tsconfig.json
NEXT:
  Session 6: F018 (Tasks list view), F019 (TaskCard component), F020 (priority color coding)
```

**Step 3: Run full verification**

```bash
npm test && npm run build
```

Expected: All tests pass, build succeeds.

**Step 4: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "chore: mark F015-F017 passing, update progress log"
```

---

## Summary

| Task | Feature | What | Key files |
|------|---------|------|-----------|
| 0 | — | Create feature branch | — |
| 1 | F017 | Install Vitest | `vitest.config.ts`, `package.json` |
| 2 | F017 | Write failing tests for filterTasks + sortTasks | `src/lib/__tests__/taskHelpers.test.ts` |
| 3 | F017 | Implement taskHelpers | `src/lib/taskHelpers.ts` |
| 4 | F016 | Create useTasks hook | `src/hooks/useTasks.ts` |
| 5 | F015 | Wire linked tasks into GoalCard + Goals page | `src/components/GoalCard.tsx`, `src/app/goals/page.tsx` |
| 6 | — | Update tracker + progress log | `claude-features.json`, `claude-progress.txt` |
