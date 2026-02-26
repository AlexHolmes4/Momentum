# Session 3 — Goal Components Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement F009 (GoalProgressBar), F010 (GoalCard), and F011 (Create goal form), then wire them into the Goals page so users can view and create goals.

**Architecture:** Three new components in `src/components/`. Goals page (`src/app/goals/page.tsx`) is refactored to use GoalCard + inline CreateGoalForm (toggled by an "Add Goal" button). Progress is passed as a prop (hardcoded to 0 until tasks feature is built). No test infrastructure exists — verification is TypeScript build + visual browser check.

**Tech Stack:** Next.js 16 App Router, React 19 (`'use client'`), TypeScript, Tailwind CSS v4, Supabase via `useGoals` hook already implemented.

---

## Task 0: Create feature branch

**Files:** none (git only)

**Step 1: Create and switch to the session branch**

```bash
git checkout -b feat/session-3-goal-components
```

Expected: `Switched to a new branch 'feat/session-3-goal-components'`

---

## Task 1: GoalProgressBar component (F009)

**Files:**
- Create: `src/components/GoalProgressBar.tsx`

**Step 1: Create the component**

```tsx
// src/components/GoalProgressBar.tsx
'use client'

type Props = {
  progress: number // 0-100
}

export function GoalProgressBar({ progress }: Props) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-indigo-500 rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/components/GoalProgressBar.tsx
git commit -m "feat: add GoalProgressBar component (F009)"
```

---

## Task 2: GoalCard component (F010)

**Files:**
- Create: `src/components/GoalCard.tsx`

**Step 1: Create the component**

```tsx
// src/components/GoalCard.tsx
'use client'
import { Goal } from '@/hooks/useGoals'
import { GoalProgressBar } from '@/components/GoalProgressBar'

type Props = {
  goal: Goal
  progress: number // 0-100
}

export function GoalCard({ goal, progress }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-white font-semibold text-base leading-snug">
          {goal.title}
        </h2>
        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
          {goal.status}
        </span>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="text-gray-400 text-sm mb-3">{goal.description}</p>
      )}

      {/* Target date */}
      {goal.target_date && (
        <p className="text-xs text-gray-500 mb-3">
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

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs text-gray-400">{progress}%</span>
        </div>
        <GoalProgressBar progress={progress} />
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/components/GoalCard.tsx
git commit -m "feat: add GoalCard component (F010)"
```

---

## Task 3: CreateGoalForm component (F011)

**Files:**
- Create: `src/components/CreateGoalForm.tsx`

**Step 1: Create the component**

```tsx
// src/components/CreateGoalForm.tsx
'use client'
import { useState, FormEvent } from 'react'
import { useGoals } from '@/hooks/useGoals'

type Props = {
  createGoal: ReturnType<typeof useGoals>['createGoal']
  onCreated: () => void
  onCancel: () => void
}

export function CreateGoalForm({ createGoal, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        target_date: targetDate || undefined,
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4"
    >
      <h3 className="text-white font-semibold mb-4">New Goal</h3>

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
            placeholder="What do you want to achieve?"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional details…"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Target date</label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Creating…' : 'Create Goal'}
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

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/components/CreateGoalForm.tsx
git commit -m "feat: add CreateGoalForm component (F011)"
```

---

## Task 4: Wire components into Goals page

**Files:**
- Modify: `src/app/goals/page.tsx`

Replace the entire file:

```tsx
'use client'
import { useState } from 'react'
import { useGoals } from '@/hooks/useGoals'
import { GoalCard } from '@/components/GoalCard'
import { CreateGoalForm } from '@/components/CreateGoalForm'

export default function GoalsPage() {
  const { goals, loading, error, createGoal } = useGoals()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Goals</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Goal
          </button>
        )}
      </div>

      {showForm && (
        <CreateGoalForm
          createGoal={createGoal}
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
          Loading goals…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          Failed to load goals: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && goals.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-1">No active goals yet</p>
          <p className="text-sm">Add your first goal to get started.</p>
        </div>
      )}

      {/* Goals list */}
      {!loading && !error && goals.length > 0 && (
        <ul className="flex flex-col gap-4">
          {goals.map(goal => (
            <li key={goal.id}>
              <GoalCard goal={goal} progress={0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 2: Full build verification**

```bash
npm run build
```

Expected: build succeeds, `/goals` in output.

**Step 3: Commit**

```bash
git add src/app/goals/page.tsx
git commit -m "feat: wire GoalCard + CreateGoalForm into Goals page"
```

---

## Task 5: Visual browser verification

**Step 1:** Start dev server via `preview_start` ("Momentum Dev").

**Step 2:** Navigate to `/goals` via `preview_eval`.

**Step 3:** Use `preview_snapshot` — confirm Goals heading, "+ Add Goal" button, empty state text.

**Step 4:** Use `preview_click` on "+ Add Goal" — confirm form appears with Title, Description, Target date fields.

**Step 5:** Take `preview_screenshot` for final visual confirmation.

---

## Task 6: Update feature status + progress log + PR

**Step 1: Update claude-features.json**

Set F009, F010, F011 `"status"` from `"failing"` to `"passing"`.

**Step 2: Append to claude-progress.txt**

```
---
[Session 3 — Goal Components — 2026-02-22]
STATUS: Complete
COMPLETED:
  - F009: src/components/GoalProgressBar.tsx — 0-100 prop, indigo fill, clamped
  - F010: src/components/GoalCard.tsx — title, description, target date, status badge, GoalProgressBar
  - F011: src/components/CreateGoalForm.tsx — inline form, title required, description + target_date optional, calls useGoals.createGoal
  - Refactored src/app/goals/page.tsx to use GoalCard + CreateGoalForm; Add Goal button toggles form
VERIFIED:
  - npm run build passes cleanly
  - Goals page visual check: empty state + Add Goal button + create form confirmed in browser
NOTES:
  - GoalCard progress prop hardcoded to 0 — will receive calculated value once useTasks is built
  - CreateGoalForm receives createGoal as prop (not calling useGoals internally) to avoid double-fetch
NEXT:
  Session 4: implement F012 (Edit goal), F013 (Delete goal), F014 (Archive goal)
---
```

**Step 3: Commit progress files**

```bash
git add claude-features.json claude-progress.txt
git commit -m "chore: mark F009-F011 passing, update progress log"
```

**Step 4: Open PR to main**

```bash
git push -u origin feat/session-3-goal-components
gh pr create --title "feat: Session 3 — GoalProgressBar, GoalCard, Create goal form" --body "$(cat <<'EOF'
## Summary
- F009: GoalProgressBar component — indigo progress fill, 0-100 prop, clamped
- F010: GoalCard component — title, description, target date, status badge, GoalProgressBar
- F011: CreateGoalForm — inline form with title (required), description, target date; calls useGoals.createGoal
- Goals page refactored to use new components; Add Goal button toggles form

## Test plan
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Goals page loads: shows empty state + Add Goal button
- [ ] Clicking Add Goal reveals the create form
- [ ] Cancel hides the form
- [ ] Filling in title and submitting creates a goal (requires live Supabase connection)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
