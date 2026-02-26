# Task Actions (F021-F024) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add create, edit, complete, and delete actions to the tasks domain — mirroring the goals pattern.

**Architecture:** Two new form components (CreateTaskForm, EditTaskForm) plus enhanced TaskCard with action buttons and inline confirmation bars. Tasks page wires everything together. All callbacks flow from useTasks hook through page to components.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase client-side queries via useTasks hook.

---

### Task 1: CreateTaskForm component (F021)

**Files:**
- Create: `src/components/CreateTaskForm.tsx`

**Context:**
- Pattern: mirrors `src/components/CreateGoalForm.tsx` exactly
- `useTasks.createTask` accepts `{ title, priority?, due_date?, category?, goal_id? }`
- Goals list passed as prop for the goal_id `<select>` dropdown
- Priority defaults to `'medium'`
- Import `Goal` type from `@/hooks/useGoals`, `Task` type from `@/hooks/useTasks`

**Step 1: Create CreateTaskForm.tsx**

```tsx
'use client'
import { useState, FormEvent } from 'react'
import type { Goal } from '@/hooks/useGoals'

type CreateTaskInput = {
  title: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string
  category?: string
  goal_id?: string | null
}

type Props = {
  createTask: (input: CreateTaskInput) => Promise<unknown>
  goals: Goal[]
  onCreated: () => void
  onCancel: () => void
}

export function CreateTaskForm({ createTask, goals, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('')
  const [goalId, setGoalId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createTask({
        title: title.trim(),
        priority,
        due_date: dueDate || undefined,
        category: category.trim() || undefined,
        goal_id: goalId || null,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4"
    >
      <h3 className="text-white font-semibold mb-4">New Task</h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
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
            value={title}
            onChange={e => setTitle(e.target.value)}
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
              value={priority}
              onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
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
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Category + Goal row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Work, Personal"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Linked goal</label>
            <select
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Creating...' : 'Create Task'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build, no TypeScript errors (CreateTaskForm is not yet imported anywhere, but should compile standalone)

**Step 3: Commit**

```bash
git add src/components/CreateTaskForm.tsx
git commit -m "feat(F021): add CreateTaskForm component"
```

---

### Task 2: EditTaskForm component (F022)

**Files:**
- Create: `src/components/EditTaskForm.tsx`

**Context:**
- Pattern: mirrors `src/components/EditGoalForm.tsx`
- Pre-populated with existing task fields
- `onSave` callback receives `(id, input)` — same pattern as EditGoalForm
- Needs goals list for the goal_id dropdown

**Step 1: Create EditTaskForm.tsx**

```tsx
'use client'
import { useState, FormEvent } from 'react'
import type { Task } from '@/hooks/useTasks'
import type { Goal } from '@/hooks/useGoals'

type UpdateTaskInput = {
  title?: string
  priority?: 'high' | 'medium' | 'low'
  due_date?: string | null
  category?: string | null
  goal_id?: string | null
}

type Props = {
  task: Task
  goals: Goal[]
  onSave: (id: string, input: UpdateTaskInput) => Promise<unknown>
  onCancel: () => void
}

export function EditTaskForm({ task, goals, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [category, setCategory] = useState(task.category ?? '')
  const [goalId, setGoalId] = useState(task.goal_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(task.id, {
        title: title.trim(),
        priority,
        due_date: dueDate || null,
        category: category.trim() || null,
        goal_id: goalId || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <h3 className="text-white font-semibold mb-4">Edit Task</h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
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
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Work, Personal"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Linked goal</label>
            <select
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {goals.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/components/EditTaskForm.tsx
git commit -m "feat(F022): add EditTaskForm component"
```

---

### Task 3: Enhance TaskCard with action buttons (F022-F024)

**Files:**
- Modify: `src/components/TaskCard.tsx`

**Context:**
- Current TaskCard is read-only (just displays task data)
- Pattern: mirror `src/components/GoalCard.tsx` action buttons + confirmation bars
- Add optional callback props: `onEdit`, `onDelete`, `onComplete`
- Add states: `editing` (shows EditTaskForm), `confirmingDelete`, `confirmingComplete`
- When `editing=true`, render EditTaskForm inline (same as GoalCard renders EditGoalForm)
- Need `goals` prop for EditTaskForm's goal dropdown
- Import EditTaskForm

**Step 1: Replace TaskCard.tsx with enhanced version**

```tsx
'use client'
import { useState } from 'react'
import type { Task } from '@/hooks/useTasks'
import type { Goal } from '@/hooks/useGoals'
import { EditTaskForm } from '@/components/EditTaskForm'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

type Props = {
  task: Task
  goalTitle?: string
  goals?: Goal[]
  onEdit?: (id: string, input: { title?: string; priority?: 'high' | 'medium' | 'low'; due_date?: string | null; category?: string | null; goal_id?: string | null }) => Promise<unknown>
  onDelete?: (id: string) => Promise<void>
  onComplete?: (id: string) => Promise<void>
}

export function TaskCard({ task, goalTitle, goals, onEdit, onDelete, onComplete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingComplete, setConfirmingComplete] = useState(false)

  if (editing && onEdit && goals) {
    return (
      <EditTaskForm
        task={task}
        goals={goals}
        onSave={async (id, input) => {
          await onEdit(id, input)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

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

      {/* Complete confirmation bar */}
      {confirmingComplete && (
        <div className="flex items-center justify-between mt-4 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-sm text-green-400">Mark task complete?</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (onComplete) await onComplete(task.id)
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingComplete(false)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation bar */}
      {confirmingDelete && !confirmingComplete && (
        <div className="flex items-center justify-between mt-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <span className="text-sm text-red-400">Delete this task?</span>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (onDelete) await onDelete(task.id)
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(onEdit || onDelete || onComplete) && !confirmingDelete && !confirmingComplete && (
        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-800">
          {onComplete && (
            <button
              onClick={() => setConfirmingComplete(true)}
              className="text-xs text-gray-500 hover:text-green-400 transition-colors"
            >
              Complete
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build (TaskCard is used in tasks/page.tsx — existing props still satisfied since new props are optional)

**Step 3: Commit**

```bash
git add src/components/TaskCard.tsx
git commit -m "feat(F022-F024): add action buttons, edit mode, and confirmation bars to TaskCard"
```

---

### Task 4: Wire up Tasks page (F021-F024)

**Files:**
- Modify: `src/app/tasks/page.tsx`

**Context:**
- Current page uses `useTasks` (tasks, loading, error) and `useGoals` (goals for name resolution)
- Need to destructure `createTask`, `updateTask`, `deleteTask`, `completeTask` from `useTasks`
- Add "Add Task" toggle button + inline CreateTaskForm (same pattern as goals/page.tsx)
- Pass all callbacks + goals to TaskCard
- Import CreateTaskForm

**Step 1: Replace tasks/page.tsx with wired-up version**

```tsx
'use client'
import { useState, useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { sortTasks } from '@/lib/taskHelpers'
import { TaskCard } from '@/components/TaskCard'
import { CreateTaskForm } from '@/components/CreateTaskForm'

export default function TasksPage() {
  const { tasks, loading, error, createTask, updateTask, deleteTask, completeTask } = useTasks()
  const { goals } = useGoals()
  const [showForm, setShowForm] = useState(false)

  // Build goal name lookup: id -> title
  const goalMap = useMemo(
    () => Object.fromEntries(goals.map(g => [g.id, g.title])),
    [goals]
  )

  // Default sort: priority (high -> medium -> low)
  const sorted = useMemo(() => sortTasks(tasks, 'priority'), [tasks])

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

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
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

      {/* Task list */}
      {!loading && !error && sorted.length > 0 && (
        <ul className="flex flex-col gap-4">
          {sorted.map(task => (
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

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build, all static routes generated

**Step 3: Run existing tests (no regressions)**

Run: `npm test`
Expected: All 11 taskHelpers tests pass

**Step 4: Verify structure with dev server**

Run: `npm run dev` (via preview_start "Momentum Dev")
Then: Use `preview_snapshot` to verify:
- "Add Task" button visible in tasks page header
- TaskCard shows Complete, Edit, Delete action buttons
- Clicking "Add Task" shows CreateTaskForm with title, priority, due date, category, goal fields

**Step 5: Commit**

```bash
git add src/app/tasks/page.tsx
git commit -m "feat(F021-F024): wire task actions into Tasks page"
```

---

### Task 5: Final verification + update feature flags

**Files:**
- Modify: `claude-features.json` — set F021, F022, F023, F024 to `"passing"`
- Modify: `claude-progress.txt` — append session 7 summary

**Step 1: Run full build + tests**

Run: `npm run build && npm test`
Expected: Clean build + all tests pass

**Step 2: Verify all 4 features via dev server**

Using `preview_snapshot`, verify:
- F021: CreateTaskForm appears when clicking "+ Add Task", has all fields, Cancel hides it
- F022: Clicking Edit on a TaskCard shows EditTaskForm with pre-populated fields
- F023: Clicking Complete shows green "Mark task complete?" bar with Confirm/Cancel
- F024: Clicking Delete shows red "Delete this task?" bar with Confirm/Cancel

**Step 3: Update claude-features.json**

Set F021, F022, F023, F024 status from `"failing"` to `"passing"`.

**Step 4: Append to claude-progress.txt**

```
---
[Session 7 — Task Actions — 2026-02-23]
STATUS: Complete
COMPLETED:
  - F021: src/components/CreateTaskForm.tsx — title (required), priority dropdown, due_date, category, goal_id select
  - F022: src/components/EditTaskForm.tsx — pre-populated edit form, inline in TaskCard
  - F023: Complete task — inline green confirmation bar, calls completeTask (archive + delete)
  - F024: Delete task — inline red confirmation bar, calls deleteTask
  - Enhanced TaskCard with onEdit/onDelete/onComplete props, edit mode, and confirmation states
  - Wired Tasks page with + Add Task button, CreateTaskForm toggle, all CRUD callbacks
VERIFIED:
  - npm run build passes cleanly
  - npm test passes (11 taskHelpers tests, no regressions)
  - All 4 features verified via preview_snapshot
NOTES:
  - Pattern mirrors GoalCard/EditGoalForm/CreateGoalForm exactly
  - Goals list passed to TaskCard + forms for goal_id dropdown
  - Complete uses green confirmation; Delete uses red confirmation
NEXT:
  Session 8: F025-F029 (SubtaskList, add/complete/lazy-load subtasks, all-done prompt)
```

**Step 5: Commit all changes**

```bash
git add claude-features.json claude-progress.txt
git commit -m "chore: mark F021-F024 passing, update progress log"
```

**Step 6: Finish branch**

Use `superpowers:finishing-a-development-branch` to decide merge/PR strategy.
