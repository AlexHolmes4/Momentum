# Archive Features (F041-F044) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Archive view so users can see completed tasks and archived/completed goals.

**Architecture:** Single `useArchive` hook fetches archived_tasks + non-active goals + a goalMap for name resolution. Archive page renders two read-only sections. No mutations — archive is read-only.

**Tech Stack:** React 19, Supabase client, TypeScript, Tailwind CSS v4

---

### Task 1: useArchive hook

**Files:**
- Create: `src/hooks/useArchive.ts`

**Step 1: Create the hook**

```typescript
'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/hooks/useGoals'

export type ArchivedTask = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  category: string | null
  goal_id: string | null
  completed_at: string | null
  original_created_at: string | null
}

export function useArchive() {
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([])
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([])
  const [goalMap, setGoalMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArchive = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [tasksRes, goalsRes, allGoalsRes] = await Promise.all([
      supabase
        .from('archived_tasks')
        .select('*')
        .order('completed_at', { ascending: false }),
      supabase
        .from('goals')
        .select('*')
        .in('status', ['archived', 'completed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('goals')
        .select('id, title'),
    ])

    if (tasksRes.error) {
      setError(tasksRes.error.message)
      setLoading(false)
      return
    }
    if (goalsRes.error) {
      setError(goalsRes.error.message)
      setLoading(false)
      return
    }

    setArchivedTasks(tasksRes.data ?? [])
    setArchivedGoals((goalsRes.data ?? []) as Goal[])

    // Build goalMap from all goals for name resolution on archived tasks
    const map: Record<string, string> = {}
    for (const g of (allGoalsRes.data ?? [])) {
      map[g.id] = g.title
    }
    setGoalMap(map)

    setLoading(false)
  }, [])

  return { archivedTasks, archivedGoals, goalMap, loading, error, fetchArchive }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/hooks/useArchive.ts
git commit -m "feat: add useArchive hook (F041)"
```

---

### Task 2: Archive page with both sections

**Files:**
- Modify: `src/app/archive/page.tsx`

**Step 1: Implement the full Archive page**

Replace the stub with a full page that renders archived tasks and archived goals:

```typescript
'use client'
import { useEffect } from 'react'
import { useArchive } from '@/hooks/useArchive'
import type { ArchivedTask } from '@/hooks/useArchive'

const PRIORITY_STYLES: Record<string, string> = {
  high:   'text-red-500 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:    'text-green-400 bg-green-400/10 border-green-400/20',
}

const STATUS_STYLES: Record<string, string> = {
  archived:  'text-gray-400 bg-gray-400/10 border-gray-400/20',
  completed: 'text-green-400 bg-green-400/10 border-green-400/20',
}

function ArchivedTaskCard({ task, goalName }: { task: ArchivedTask; goalName?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-white font-semibold text-base leading-snug">{task.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low
          }`}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {task.completed_at && (
          <span className="text-xs text-gray-500">
            Completed:{' '}
            <span className="text-gray-300">
              {new Date(task.completed_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </span>
        )}
        {task.category && (
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {task.category}
          </span>
        )}
        {goalName && (
          <span className="text-xs text-indigo-400">→ {goalName}</span>
        )}
      </div>
    </div>
  )
}

function ArchivedGoalCard({ goal }: { goal: { id: string; title: string; description: string | null; target_date: string | null; status: string } }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-white font-semibold text-base leading-snug">{goal.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
            STATUS_STYLES[goal.status] ?? STATUS_STYLES.archived
          }`}
        >
          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
        </span>
      </div>

      {goal.description && (
        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{goal.description}</p>
      )}

      {goal.target_date && (
        <p className="text-xs text-gray-500 mt-2">
          Target:{' '}
          <span className="text-gray-300">
            {new Date(goal.target_date).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </p>
      )}
    </div>
  )
}

export default function ArchivePage() {
  const { archivedTasks, archivedGoals, goalMap, loading, error, fetchArchive } = useArchive()

  useEffect(() => {
    fetchArchive()
  }, [fetchArchive])

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Archive</h1>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading archive…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load archive: {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Archived Tasks section */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Archived Tasks
              {archivedTasks.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({archivedTasks.length})</span>
              )}
            </h2>

            {archivedTasks.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No archived tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {archivedTasks.map(task => (
                  <li key={task.id}>
                    <ArchivedTaskCard
                      task={task}
                      goalName={task.goal_id ? goalMap[task.goal_id] : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Archived Goals section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Archived Goals
              {archivedGoals.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({archivedGoals.length})</span>
              )}
            </h2>

            {archivedGoals.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No archived goals yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {archivedGoals.map(goal => (
                  <li key={goal.id}>
                    <ArchivedGoalCard goal={goal} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Verify build passes**

Run: `npm run build`
Expected: all static routes generate including /archive

**Step 4: Verify page renders**

Start dev server, navigate to `/archive`, use `preview_snapshot` to confirm:
- "Archive" heading
- "Archived Tasks" section heading
- "Archived Goals" section heading
- Empty states or data rendered correctly

**Step 5: Commit**

```bash
git add src/app/archive/page.tsx
git commit -m "feat: add Archive view with tasks and goals sections (F042, F043, F044)"
```

---

### Task 3: Run all tests + update feature tracker

**Step 1: Run existing tests**

Run: `npm test`
Expected: all 16 tests pass (no regressions)

**Step 2: Update claude-features.json**

Set F041, F042, F043, F044 status to `"passing"`.

**Step 3: Append session summary to claude-progress.txt**

**Step 4: Final commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "feat: mark F041-F044 archive features complete (session 11)"
```
