# Dashboard Design — F030-F034

**Date**: 2026-02-28
**Session**: 9
**Features**: F030 (scaffold), F031 (today's tasks), F032 (overdue tasks), F033 (goal progress overview), F034 (quick-add task)

## Architecture

Single `'use client'` page component at `src/app/dashboard/page.tsx`.
Calls `useTasks()` + `useGoals()` once; filters tasks client-side into today/overdue buckets.
Reuses existing `TaskCard`, `GoalProgressBar`. New inline quick-add form (not reusing full `CreateTaskForm`).

## Layout (top to bottom)

1. **Header**: "Dashboard" h1 + "+ Quick Add" toggle button
2. **Quick-Add Form** (F034): Collapsible inline form — title (required) + priority select + due date. Calls `createTask`.
3. **Overdue Tasks** (F032): Red-tinted section header with count badge. Tasks where `due_date < today` (non-null due_date only). Full actionable `TaskCard`. Empty: "No overdue tasks"
4. **Today's Tasks** (F031): Section header with count badge. Tasks where `due_date === today`. Full actionable `TaskCard`. Empty: "Nothing due today"
5. **Goals Overview** (F033): Active goals as compact rows — title + `GoalProgressBar` + target date + progress %. Progress via `calculateProgress` from linked tasks. Empty: "No active goals"

## Date Filtering Logic

```ts
const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today)
const todayTasks = tasks.filter(t => t.due_date === today)
```

Tasks with no `due_date` appear in neither section (visible only on Tasks page).

## Quick-Add Form (F034)

Three fields only (no goal_id, no category):
- Title: text input, required
- Priority: select high/medium/low, default medium
- Due date: date input, optional

On submit → `createTask({ title, priority, due_date })` → form clears, task appears in appropriate section.

## Goal Progress

For each active goal, filter `tasks` by `goal_id`, pass to `calculateProgress()`.
Same logic used on Goals page. Compact display: no action buttons, just progress overview.

## State Consistency

- Completing/deleting a task via Dashboard `TaskCard` removes it from `useTasks` state → today/overdue re-filter on re-render
- Goal progress recalculates from updated task list (derived state, not stored)
- Quick-add inserts into `useTasks` state → appears in correct section immediately

## Components Reused

- `TaskCard` (full actionable: complete/edit/delete)
- `GoalProgressBar` (indigo fill bar)
- `useTasks` hook (tasks, createTask, updateTask, deleteTask, completeTask)
- `useGoals` hook (goals)
- `calculateProgress` from goalHelpers

## New Code

- `src/app/dashboard/page.tsx` — rewrite of stub (only file changed)
