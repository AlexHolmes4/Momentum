# Subtasks (F025–F029) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add subtask support to TaskCard — collapsible expand, lazy-loaded subtask list with add/toggle/all-done prompt.

**Architecture:** Approach B — separate `useSubtasks` hook + dumb `SubtaskList` component + `SubtaskListContainer` smart wrapper. SubtaskListContainer is mounted only when TaskCard is expanded, which naturally satisfies lazy loading (F028). All three live in their own files following existing project conventions.

**Tech Stack:** React 19, TypeScript, Supabase client-side queries, Tailwind CSS v4, Vitest for pure function tests.

**Existing patterns to follow:**
- Hooks: see `src/hooks/useTasks.ts` for useState/useCallback/Supabase pattern
- Components: see `src/components/TaskCard.tsx` for card styling, confirmation bars
- Tests: see `src/lib/__tests__/taskHelpers.test.ts` for Vitest factory pattern
- Styling: bg-gray-950 (page), bg-gray-900 (cards), bg-gray-800 (inputs), dark mode only
- Supabase table: `subtasks(id uuid PK, task_id uuid FK, title text, completed boolean)`

---

### Task 1: Create feature branch

**Step 1: Create and checkout branch**

```bash
git checkout -b feat/session-8-subtasks
```

---

### Task 2: useSubtasks hook (F025 foundation)

**Files:**
- Create: `src/hooks/useSubtasks.ts`

**Step 1: Create the hook**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type Subtask = {
  id: string
  task_id: string
  title: string
  completed: boolean
}

export function useSubtasks(taskId: string) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubtasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('id', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setSubtasks(data ?? [])
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    fetchSubtasks()
  }, [fetchSubtasks])

  const addSubtask = useCallback(async (title: string): Promise<Subtask> => {
    const { data, error: err } = await supabase
      .from('subtasks')
      .insert([{ task_id: taskId, title, completed: false }])
      .select()
      .single()
    if (err) throw err
    const subtask = data as Subtask
    setSubtasks(prev => [...prev, subtask])
    return subtask
  }, [taskId])

  const toggleSubtask = useCallback(async (id: string, completed: boolean): Promise<Subtask> => {
    const { data, error: err } = await supabase
      .from('subtasks')
      .update({ completed })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const subtask = data as Subtask
    setSubtasks(prev => prev.map(s => (s.id === id ? subtask : s)))
    return subtask
  }, [])

  const deleteSubtask = useCallback(async (id: string): Promise<void> => {
    const { error: err } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id)
    if (err) throw err
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }, [])

  return { subtasks, loading, error, addSubtask, toggleSubtask, deleteSubtask, refetch: fetchSubtasks }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/hooks/useSubtasks.ts
git commit -m "feat: add useSubtasks hook (F025 foundation)"
```

---

### Task 3: SubtaskList dumb component (F025, F026, F027)

**Files:**
- Create: `src/components/SubtaskList.tsx`

**Step 1: Create SubtaskList component**

```typescript
'use client'
import { useState } from 'react'
import type { Subtask } from '@/hooks/useSubtasks'

type SubtaskListProps = {
  subtasks: Subtask[]
  loading: boolean
  onAdd: (title: string) => Promise<unknown>
  onToggle: (id: string, completed: boolean) => Promise<unknown>
  onAllComplete?: () => void
}

export function SubtaskList({ subtasks, loading, onAdd, onToggle, onAllComplete }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      await onAdd(trimmed)
      setNewTitle('')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (subtask: Subtask) => {
    const newCompleted = !subtask.completed
    await onToggle(subtask.id, newCompleted)

    // After toggling, check if ALL subtasks are now completed
    // We check the current list with this one flipped
    if (newCompleted && onAllComplete) {
      const allDone = subtasks.every(s =>
        s.id === subtask.id ? true : s.completed
      )
      if (allDone) onAllComplete()
    }
  }

  if (loading) {
    return (
      <div className="text-xs text-gray-500 py-2">Loading subtasks...</div>
    )
  }

  return (
    <div className="mt-3 bg-gray-800/50 rounded-lg p-3 space-y-2">
      {/* Subtask checkboxes */}
      {subtasks.length > 0 && (
        <ul className="space-y-1.5">
          {subtasks.map(subtask => (
            <li key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => handleToggle(subtask)}
                className="accent-indigo-500 rounded"
              />
              <span className={`text-sm ${subtask.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                {subtask.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {subtasks.length === 0 && (
        <p className="text-xs text-gray-600">No subtasks yet.</p>
      )}

      {/* Add subtask input */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add a subtask..."
          className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md px-2.5 py-1.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTitle.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/SubtaskList.tsx
git commit -m "feat: add SubtaskList dumb component (F025, F026, F027)"
```

---

### Task 4: SubtaskListContainer smart wrapper

**Files:**
- Create: `src/components/SubtaskListContainer.tsx`

**Step 1: Create the container**

```typescript
'use client'
import { useSubtasks } from '@/hooks/useSubtasks'
import { SubtaskList } from '@/components/SubtaskList'

type Props = {
  taskId: string
  onAllComplete?: () => void
}

export function SubtaskListContainer({ taskId, onAllComplete }: Props) {
  const { subtasks, loading, addSubtask, toggleSubtask } = useSubtasks(taskId)

  return (
    <SubtaskList
      subtasks={subtasks}
      loading={loading}
      onAdd={addSubtask}
      onToggle={toggleSubtask}
      onAllComplete={onAllComplete}
    />
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/SubtaskListContainer.tsx
git commit -m "feat: add SubtaskListContainer smart wrapper"
```

---

### Task 5: TaskCard expand/collapse + all-done prompt (F028, F029)

**Files:**
- Modify: `src/components/TaskCard.tsx`

**Step 1: Add import at top of TaskCard.tsx**

Add after existing imports:

```typescript
import { SubtaskListContainer } from '@/components/SubtaskListContainer'
```

**Step 2: Add `expanded` state**

Inside the TaskCard function, after the `confirming` state line:

```typescript
const [expanded, setExpanded] = useState(false)
```

**Step 3: Add subtasks toggle button**

Insert after the metadata row (the `{(task.due_date || task.category || goalTitle) && (` block) and before the complete confirmation bar. This toggle is always visible:

```tsx
{/* Subtasks toggle */}
<button
  onClick={() => setExpanded(prev => !prev)}
  className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
>
  <span className="text-[10px]">{expanded ? '▼' : '▶'}</span>
  Subtasks
</button>

{/* Subtask list — mounted only when expanded (lazy load F028) */}
{expanded && (
  <SubtaskListContainer
    taskId={task.id}
    onAllComplete={() => setConfirming('complete')}
  />
)}
```

**Step 4: Update the complete confirmation bar text for all-done context**

No change needed — the existing "Mark task complete?" text works for both manual complete clicks AND the all-done prompt. The green confirmation bar already handles this via `confirming === 'complete'`.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Commit**

```bash
git add src/components/TaskCard.tsx
git commit -m "feat: add subtask expand/collapse to TaskCard (F028, F029)"
```

---

### Task 6: Build verification + feature flags

**Step 1: Run full build**

Run: `npm run build`
Expected: all pages generate successfully, zero errors

**Step 2: Run existing tests**

Run: `npm test`
Expected: all 11 taskHelpers tests pass, no regressions

**Step 3: Verify in browser**

Start dev server, navigate to http://localhost:3000/tasks. Verify via `preview_snapshot`:
- TaskCard shows "▶ Subtasks" toggle below metadata
- Clicking toggle expands subtask area with "No subtasks yet." message and add input
- Adding a subtask shows it with checkbox
- Checking all subtasks triggers green "Mark task complete?" confirmation bar
- Collapsing and re-expanding preserves subtask data (refetches from Supabase)

**Step 4: Update claude-features.json**

Set F025, F026, F027, F028, F029 status to `"passing"`.

**Step 5: Update claude-progress.txt**

Append session 8 summary entry.

**Step 6: Final commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "feat: mark F025-F029 subtasks complete (session 8)"
```

---

### Summary of all files

| Action | File |
|--------|------|
| Create | `src/hooks/useSubtasks.ts` |
| Create | `src/components/SubtaskList.tsx` |
| Create | `src/components/SubtaskListContainer.tsx` |
| Modify | `src/components/TaskCard.tsx` |
| Update | `claude-features.json` |
| Update | `claude-progress.txt` |
