# Filter & Search (F035-F040) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add filtering and search to the Tasks page (FilterBar with priority/goal/category/due-date dropdowns + search) and a search input to the Goals page.

**Architecture:** Extend existing `taskHelpers.filterTasks()` with due-date filtering, build a controlled `FilterBar` component, wire it into the Tasks page. Goals page gets an inline search input. All filtering is client-side, pure functions, no new hooks.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest

---

### Task 1: Extend taskHelpers with due-date filtering

**Files:**
- Modify: `src/lib/taskHelpers.ts:7-12` (TaskFilters type) and `src/lib/taskHelpers.ts:22-33` (filterTasks function)
- Test: `src/lib/__tests__/taskHelpers.test.ts`

**Step 1: Write failing tests for due-date filtering**

Add these tests to `src/lib/__tests__/taskHelpers.test.ts` inside the existing `describe('filterTasks', ...)` block, after the last `it(...)`:

```ts
it('filters by dueDateRange=today', () => {
  const today = '2026-02-20'
  const result = filterTasks(tasks, { dueDateRange: 'today' }, today)
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('1') // due_date '2026-02-20' === today
})

it('filters by dueDateRange=overdue', () => {
  const today = '2026-02-22'
  const result = filterTasks(tasks, { dueDateRange: 'overdue' }, today)
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('1') // due_date '2026-02-20' < '2026-02-22'
})

it('filters by dueDateRange=this_week (Mon-Sun)', () => {
  // 2026-02-23 is a Monday. End of week = 2026-03-01 (Sunday).
  const today = '2026-02-23'
  const weekTasks = [
    makeTask({ id: '1', due_date: '2026-02-22' }), // before this week
    makeTask({ id: '2', due_date: '2026-02-23' }), // Monday (today)
    makeTask({ id: '3', due_date: '2026-02-27' }), // Friday
    makeTask({ id: '4', due_date: '2026-03-01' }), // Sunday (end of week)
    makeTask({ id: '5', due_date: '2026-03-02' }), // next Monday (out)
    makeTask({ id: '6', due_date: null }),           // no date (excluded)
  ]
  const result = filterTasks(weekTasks, { dueDateRange: 'this_week' }, today)
  expect(result.map(t => t.id).sort()).toEqual(['2', '3', '4'])
})

it('dueDateRange filters exclude tasks with null due_date', () => {
  const today = '2026-02-20'
  const result = filterTasks(tasks, { dueDateRange: 'today' }, today)
  // task 3 has due_date=null, should not appear even though today matches nothing for null
  expect(result.every(t => t.due_date !== null)).toBe(true)
})

it('existing filters still work without today param', () => {
  // Backward compat: calling without 3rd arg should work for non-date filters
  const result = filterTasks(tasks, { priority: 'high' })
  expect(result).toHaveLength(2)
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 5 new tests FAIL (filterTasks doesn't accept `dueDateRange` or `today` param yet)

**Step 3: Implement due-date filtering in taskHelpers.ts**

Update `TaskFilters` type — add `dueDateRange`:

```ts
export type TaskFilters = {
  priority?: 'high' | 'medium' | 'low'
  category?: string
  goalId?: string
  search?: string
  dueDateRange?: 'today' | 'this_week' | 'overdue'
}
```

Update `filterTasks` signature to accept optional `today` parameter:

```ts
export function filterTasks(tasks: Task[], filters: TaskFilters, today?: string): Task[] {
```

Add due-date filtering logic inside the `.filter()` callback, after the existing `search` check:

```ts
if (filters.dueDateRange) {
  if (!task.due_date) return false
  const todayStr = today ?? new Date().toISOString().slice(0, 10)
  switch (filters.dueDateRange) {
    case 'today':
      if (task.due_date !== todayStr) return false
      break
    case 'overdue':
      if (task.due_date >= todayStr) return false
      break
    case 'this_week': {
      // Calculate end of week (Sunday) from todayStr
      const d = new Date(todayStr + 'T00:00:00')
      const dayOfWeek = d.getDay() // 0=Sun,1=Mon,...,6=Sat
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
      const endOfWeek = new Date(d)
      endOfWeek.setDate(d.getDate() + daysUntilSunday)
      const endStr = endOfWeek.toISOString().slice(0, 10)
      if (task.due_date < todayStr || task.due_date > endStr) return false
      break
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 16 tests PASS (11 existing + 5 new)

**Step 5: Commit**

```bash
git add src/lib/taskHelpers.ts src/lib/__tests__/taskHelpers.test.ts
git commit -m "feat: add due-date filtering to taskHelpers (F038)"
```

---

### Task 2: Build FilterBar component

**Files:**
- Create: `src/components/FilterBar.tsx`

**Step 1: Create FilterBar component**

```tsx
'use client'

import type { TaskFilters } from '@/lib/taskHelpers'
import type { Goal } from '@/hooks/useGoals'

type FilterBarProps = {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  goals: Goal[]
  categories: string[]
}

export function FilterBar({ filters, onFiltersChange, goals, categories }: FilterBarProps) {
  const hasActiveFilters = !!(filters.priority || filters.goalId || filters.category || filters.dueDateRange || filters.search)

  const update = (patch: Partial<TaskFilters>) => {
    onFiltersChange({ ...filters, ...patch })
  }

  const clearAll = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Search */}
      <input
        type="text"
        placeholder="Search tasks..."
        value={filters.search ?? ''}
        onChange={e => update({ search: e.target.value || undefined })}
        className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 border border-gray-700 focus:border-indigo-500 focus:outline-none min-w-[180px]"
      />

      {/* Priority */}
      <select
        value={filters.priority ?? ''}
        onChange={e => update({ priority: (e.target.value || undefined) as TaskFilters['priority'] })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Goal */}
      <select
        value={filters.goalId ?? ''}
        onChange={e => update({ goalId: e.target.value || undefined })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All goals</option>
        {goals.map(g => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category ?? ''}
        onChange={e => update({ category: e.target.value || undefined })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All categories</option>
        {categories.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Due date range */}
      <select
        value={filters.dueDateRange ?? ''}
        onChange={e => update({ dueDateRange: (e.target.value || undefined) as TaskFilters['dueDateRange'] })}
        className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">All dates</option>
        <option value="today">Today</option>
        <option value="this_week">This week</option>
        <option value="overdue">Overdue</option>
      </select>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

**Step 3: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: add FilterBar component (F035)"
```

---

### Task 3: Wire FilterBar into Tasks page

**Files:**
- Modify: `src/app/tasks/page.tsx`

**Step 1: Update Tasks page to use FilterBar + filterTasks**

Replace the entire `src/app/tasks/page.tsx` with:

```tsx
'use client'
import { useState, useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { filterTasks, sortTasks, type TaskFilters } from '@/lib/taskHelpers'
import { TaskCard } from '@/components/TaskCard'
import { CreateTaskForm } from '@/components/CreateTaskForm'
import { FilterBar } from '@/components/FilterBar'

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, completeTask } = useTasks()
  const { goals } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({})

  // Build goal name lookup: id -> title
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Extract unique categories from tasks
  const categories = useMemo(
    () => [...new Set(tasks.map(t => t.category).filter((c): c is string => c !== null))].sort(),
    [tasks]
  )

  // Today string for due-date filtering
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Filter then sort
  const filtered = useMemo(() => {
    const f = filterTasks(tasks, filters, today)
    return sortTasks(f, 'priority')
  }, [tasks, filters, today])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>

      {showForm && (
        <CreateTaskForm
          createTask={createTask}
          goals={goals}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        goals={goals}
        categories={categories}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading tasks...
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load tasks: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active tasks yet</p>
          <p className="text-sm">Create your first task to get started.</p>
        </div>
      )}

      {/* No filter results */}
      {!loading && !error && tasks.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No tasks match your filters.</p>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="flex flex-col gap-4">
          {filtered.map(task => (
            <li key={task.id}>
              <TaskCard
                task={task}
                goalTitle={task.goal_id ? goalMap[task.goal_id] : undefined}
                goals={goals}
                onEdit={updateTask}
                onDelete={deleteTask}
                onComplete={completeTask}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Key changes from original:
- Added `filters` state and `FilterBar` import/render
- Added `categories` computed from tasks
- Added `today` computed once
- Changed `sorted` to `filtered` (filterTasks → sortTasks pipeline)
- Added "No tasks match your filters" empty state (distinct from "no tasks" empty state)

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: All 16 tests PASS

**Step 4: Start dev server and verify**

Run dev server, then verify at localhost:3000/tasks:
- FilterBar renders with search input + 4 dropdowns
- Selecting a priority filter reduces the visible task list
- "Clear all" link appears when a filter is active and resets everything

**Step 5: Commit**

```bash
git add src/app/tasks/page.tsx
git commit -m "feat: wire FilterBar into Tasks page (F036, F037, F038, F039)"
```

---

### Task 4: Add search to Goals page

**Files:**
- Modify: `src/app/goals/page.tsx`

**Step 1: Add search input and filtering to Goals page**

Add `useMemo` to the import (already has `useState`). Add search state and filtered list:

After the `const [showForm, setShowForm] = useState(false)` line, add:
```ts
const [search, setSearch] = useState('')
```

Before the return, add:
```ts
const filteredGoals = useMemo(() => {
  if (!search.trim()) return goals
  const term = search.toLowerCase()
  return goals.filter(g =>
    g.title.toLowerCase().includes(term) ||
    (g.description && g.description.toLowerCase().includes(term))
  )
}, [goals, search])
```

In the JSX, after the `</div>` that closes the header (the one containing h1 + Add Goal button), add:

```tsx
{/* Search */}
<div className="mb-6">
  <input
    type="text"
    placeholder="Search goals..."
    value={search}
    onChange={e => setSearch(e.target.value)}
    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 placeholder-gray-500 border border-gray-700 focus:border-indigo-500 focus:outline-none w-full max-w-xs"
  />
</div>
```

In the goals list section, change `goals.length` checks to `filteredGoals.length` and change `goals.map(goal =>` to `filteredGoals.map(goal =>`. The empty state should still check `goals.length === 0` (so it only shows when there are truly no goals, not when a search has no results).

Add a "no search results" state (similar to Tasks page):
```tsx
{!loading && !error && goals.length > 0 && filteredGoals.length === 0 && (
  <div className="text-center py-12 text-gray-500">
    <p className="text-sm">No goals match your search.</p>
  </div>
)}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: All 16 tests PASS

**Step 4: Start dev server and verify**

At localhost:3000/goals:
- Search input renders below the header
- Typing filters goals by title/description
- Clearing search shows all goals again

**Step 5: Commit**

```bash
git add src/app/goals/page.tsx
git commit -m "feat: add search input to Goals page (F040)"
```

---

### Task 5: Update feature statuses and progress log

**Files:**
- Modify: `claude-features.json` (F035-F040 to "passing")
- Modify: `claude-progress.txt` (append session 10 summary)

**Step 1: Update claude-features.json**

Set F035, F036, F037, F038, F039, F040 status to `"passing"`.

**Step 2: Append to claude-progress.txt**

```
---
[Session 10 — Filter & Search — 2026-02-28]
STATUS: Complete
COMPLETED:
  - F035: src/components/FilterBar.tsx — controlled component with search + 4 dropdown filters + Clear all
  - F036: Filter by priority — dropdown in FilterBar, wired through filterTasks
  - F037: Filter by goal — dropdown in FilterBar, populated from useGoals, wired through filterTasks
  - F038: Filter by due date — dropdown (today/this week/overdue), new dueDateRange field in taskHelpers
  - F039: Filter by category — dropdown in FilterBar, categories extracted dynamically from tasks
  - F040: Search — FilterBar search input on Tasks page + standalone search input on Goals page (title+description)
VERIFIED:
  - npm run build passes (zero errors, all static routes)
  - npm test passes (16 tests — 11 existing + 5 new due-date filter tests)
  - npx tsc --noEmit clean
  - FilterBar renders on Tasks page with all controls
  - Goals page search filters goals by title/description
NOTES:
  - filterTasks now accepts optional `today` parameter (3rd arg) for pure due-date filtering
  - This-week = Monday through Sunday of the current week
  - Categories extracted dynamically: [...new Set(tasks.map(t => t.category))]
  - Goals search filters by title AND description (case-insensitive)
NEXT:
  Session 11: F041-F044 (useArchive hook, Archive view, archived tasks list, archived goals list)
---
```

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "feat: mark F035-F040 filter & search complete (session 10)"
```
