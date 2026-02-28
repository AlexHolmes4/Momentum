# Dashboard (F030-F034) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Dashboard page with today's tasks, overdue tasks, goal progress overview, and a quick-add task form.

**Architecture:** Single `'use client'` page component at `src/app/dashboard/page.tsx`. Calls `useTasks()` + `useGoals()` once; filters tasks client-side into today/overdue buckets using `useMemo`. Reuses existing `TaskCard` and `GoalProgressBar` components. New inline quick-add form built directly in the page (3 fields: title, priority, due date).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase client-side queries via existing hooks.

**Existing patterns to follow:**
- Hooks: `src/hooks/useTasks.ts` for task CRUD, `src/hooks/useGoals.ts` for goals
- Components: `src/components/TaskCard.tsx` for actionable task cards, `src/components/GoalProgressBar.tsx` for progress bars
- Helpers: `src/lib/goalHelpers.ts` `calculateProgress()` for goal progress
- Styling: bg-gray-950 (page), bg-gray-900 (cards), bg-gray-800 (inputs), dark mode only
- Priority colors: high=red-500, medium=amber-400, low=green-400

---

### Task 1: Create feature branch

**Step 1: Create and checkout branch**

```bash
git checkout -b feat/session-9-dashboard
```

---

### Task 2: Dashboard scaffold with loading/error states (F030)

**Files:**
- Modify: `src/app/dashboard/page.tsx` (replace stub)

**Step 1: Replace the dashboard stub with the full page scaffold**

Replace the entire content of `src/app/dashboard/page.tsx` with:

```typescript
'use client'
import { useState, useMemo, FormEvent } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { calculateProgress } from '@/lib/goalHelpers'
import type { Task as GoalTask } from '@/lib/goalHelpers'
import { TaskCard } from '@/components/TaskCard'
import { GoalProgressBar } from '@/components/GoalProgressBar'

export default function DashboardPage() {
  const { tasks, loading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask, completeTask } = useTasks()
  const { goals, loading: goalsLoading, error: goalsError } = useGoals()

  // Quick-add form state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [qaTitle, setQaTitle] = useState('')
  const [qaPriority, setQaPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [qaDueDate, setQaDueDate] = useState('')
  const [qaSaving, setQaSaving] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)

  // Date filtering
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const overdueTasks = useMemo(
    () => tasks.filter(t => t.due_date != null && t.due_date < today),
    [tasks, today]
  )

  const todayTasks = useMemo(
    () => tasks.filter(t => t.due_date === today),
    [tasks, today]
  )

  // Goal name lookup for TaskCard
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Quick-add submit handler
  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault()
    if (!qaTitle.trim()) return
    setQaSaving(true)
    setQaError(null)
    try {
      await createTask({
        title: qaTitle.trim(),
        priority: qaPriority,
        due_date: qaDueDate || undefined,
      })
      setQaTitle('')
      setQaPriority('medium')
      setQaDueDate('')
      setShowQuickAdd(false)
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setQaSaving(false)
    }
  }

  const loading = tasksLoading || goalsLoading
  const error = tasksError || goalsError

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {!showQuickAdd && (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Quick Add
          </button>
        )}
      </div>

      {/* Quick-Add Form (F034) */}
      {showQuickAdd && (
        <form
          onSubmit={handleQuickAdd}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6"
        >
          <h3 className="text-white font-semibold mb-4">Quick Add Task</h3>

          {qaError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
              {qaError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Title */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={qaTitle}
                onChange={e => setQaTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Priority + Due date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Priority</label>
                <select
                  value={qaPriority}
                  onChange={e => setQaPriority(e.target.value as 'high' | 'medium' | 'low')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Due date</label>
                <input
                  type="date"
                  value={qaDueDate}
                  onChange={e => setQaDueDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={qaSaving || !qaTitle.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {qaSaving ? 'Adding...' : 'Add Task'}
            </button>
            <button
              type="button"
              onClick={() => { setShowQuickAdd(false); setQaError(null) }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading dashboard…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
          Failed to load data: {error}
        </div>
      )}

      {/* Dashboard sections — only render when data is loaded */}
      {!loading && !error && (
        <div className="flex flex-col gap-8">
          {/* Overdue Tasks Section (F032) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Overdue</h2>
              {overdueTasks.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  {overdueTasks.length}
                </span>
              )}
            </div>

            {overdueTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No overdue tasks</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {overdueTasks.map(task => (
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
          </section>

          {/* Today's Tasks Section (F031) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Today</h2>
              {todayTasks.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {todayTasks.length}
                </span>
              )}
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing due today</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {todayTasks.map(task => (
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
          </section>

          {/* Goals Overview Section (F033) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">Goals</h2>
              {goals.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {goals.length}
                </span>
              )}
            </div>

            {goals.length === 0 ? (
              <p className="text-sm text-gray-500">No active goals</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {goals.map(goal => {
                  const linkedTasks = tasks.filter(t => t.goal_id === goal.id)
                  const progress = calculateProgress(linkedTasks as GoalTask[])
                  return (
                    <li
                      key={goal.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium text-sm">{goal.title}</h3>
                        <span className="text-xs text-gray-400">{progress}%</span>
                      </div>
                      <GoalProgressBar progress={progress} />
                      {goal.target_date && (
                        <p className="text-xs text-gray-500 mt-2">
                          Target:{' '}
                          <span className="text-gray-400">
                            {new Date(goal.target_date).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: implement Dashboard page (F030-F034)"
```

---

### Task 3: Build verification

**Step 1: Run full build**

Run: `npm run build`
Expected: all pages generate successfully, zero errors

**Step 2: Run existing tests**

Run: `npm test`
Expected: all 11 taskHelpers tests pass, no regressions

**Step 3: Verify in browser**

Start dev server, navigate to http://localhost:3000/dashboard. Verify via `preview_snapshot`:
- "Dashboard" heading visible with "+ Quick Add" button
- "Overdue" section heading visible (with or without tasks)
- "Today" section heading visible (with or without tasks)
- "Goals" section heading visible (with or without goals)
- Clicking "+ Quick Add" shows inline form with Title, Priority, Due date fields
- TaskCards in overdue/today sections have Complete/Edit/Delete action buttons

**Step 4: Verify quick-add form creates tasks**

Use quick-add to create a task with today's due date. Verify it appears in the "Today" section immediately.

---

### Task 4: Update feature flags and progress log

**Step 1: Update claude-features.json**

Set F030, F031, F032, F033, F034 status to `"passing"`.

**Step 2: Update claude-progress.txt**

Append session 9 summary entry:

```
---
[Session 9 — Dashboard — 2026-02-28]
STATUS: Complete
COMPLETED:
  - F030: src/app/dashboard/page.tsx — Dashboard scaffold with 3 sections (Overdue, Today, Goals)
  - F031: Today's tasks section — filters tasks where due_date === today, full actionable TaskCard
  - F032: Overdue tasks section — filters tasks where due_date < today, red count badge, full actionable TaskCard
  - F033: Goals overview section — all active goals with GoalProgressBar, progress %, target date
  - F034: Quick-add task form — inline collapsible form (title + priority + due date), calls createTask
VERIFIED:
  - npm run build passes (zero errors, all static routes)
  - npm test passes (11 taskHelpers tests, no regressions)
  - npx tsc --noEmit clean
  - Dashboard renders all 3 sections at localhost:3000/dashboard
  - Quick-add creates tasks that appear in correct section immediately
  - TaskCards fully actionable (complete/edit/delete) from Dashboard
NOTES:
  - Single page component with client-side date filtering (useMemo)
  - today computed once via useMemo (YYYY-MM-DD string comparison)
  - Tasks without due_date appear on Tasks page only, not on Dashboard
  - Goal progress calculated from live task list (same as Goals page)
NEXT:
  Session 10: F035-F040 (FilterBar, filter by priority/goal/date/category, search)
---
```

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "feat: mark F030-F034 dashboard complete (session 9)"
```

---

### Summary of all files

| Action | File |
|--------|------|
| Modify | `src/app/dashboard/page.tsx` (replace stub with full implementation) |
| Update | `claude-features.json` |
| Update | `claude-progress.txt` |
