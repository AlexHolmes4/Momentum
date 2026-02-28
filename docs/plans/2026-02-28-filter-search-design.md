# Filter & Search Design (F035-F040) — Session 10

## Scope

- **F035**: FilterBar component with dropdowns for priority, goal, category, due-date-range
- **F036**: Filter by priority
- **F037**: Filter by goal
- **F038**: Filter by due date (today / this week / overdue)
- **F039**: Filter by category
- **F040**: Search tasks and goals

## Architecture: Approach A — Extend existing taskHelpers

All filtering uses `taskHelpers.filterTasks()` (pure function, already tested). No new hooks — page components own filter state directly.

## FilterBar Component

**File**: `src/components/FilterBar.tsx`

- Always-visible horizontal row below the Tasks page header
- Controlled component: receives `filters` + `onFiltersChange` + `goals` + `categories` props
- Controls: search input, priority dropdown, goal dropdown, category dropdown, due-date dropdown
- All dropdowns default to "All" (no filter)
- "Clear all" link appears when any filter is active, resets all to defaults
- Category options derived dynamically from the task list (passed as prop)
- Goal options from the goals array (passed as prop)

## taskHelpers Changes

Add `dueDateRange` to `TaskFilters`:

```ts
export type TaskFilters = {
  priority?: 'high' | 'medium' | 'low'
  category?: string
  goalId?: string
  search?: string
  dueDateRange?: 'today' | 'this_week' | 'overdue'
}
```

Extend `filterTasks()` to handle due-date filtering:
- `'today'`: `task.due_date === todayString`
- `'this_week'`: `task.due_date >= today && task.due_date <= endOfWeek`
- `'overdue'`: `task.due_date < today && task.due_date !== null`

The caller passes `today` as a string (YYYY-MM-DD) to keep the function pure. Add a `today` parameter to `filterTasks` when `dueDateRange` is used.

## Goals Page Search (F040)

Simple inline search input below the Goals heading. Filters goals by title using case-insensitive `includes`. No separate component — just `useState` + `useMemo`.

## Data Flow

```
Tasks page:
  state: { priority, goalId, category, dueDateRange, search }
  → <FilterBar /> displays and updates state
  → filterTasks(tasks, filters, today) → sortTasks(filtered, 'priority') → render TaskCards

Goals page:
  state: { search }
  → <input> updates search state
  → goals.filter(g => g.title.toLowerCase().includes(search)) → render GoalCards
```

## Styling

- bg-gray-800 for dropdown/input backgrounds (per CLAUDE.md conventions)
- text-gray-300 for labels, text-white for selected values
- Compact row layout with flex-wrap for smaller viewports
