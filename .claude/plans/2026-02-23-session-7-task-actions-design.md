# Session 7 Design: Task Actions (F021-F024)

**Date**: 2026-02-23
**Features**: F021 (Create task form), F022 (Edit task), F023 (Complete task), F024 (Delete task)

## Approach

Mirror the goals domain pattern (F011-F014) exactly: inline forms, action buttons on cards, inline confirmation bars.

## F021 — CreateTaskForm

- New `src/components/CreateTaskForm.tsx`
- Fields: title (required), priority dropdown (high/medium/low, default medium), due_date, category (text), goal_id (select from goals list)
- "Add Task" button on tasks page toggles inline form
- Calls `useTasks.createTask`, hides form on success
- Goals list passed as prop for the goal_id dropdown

## F022 — EditTaskForm

- New `src/components/EditTaskForm.tsx`
- Pre-populated with all task fields (same fields as create)
- TaskCard gets "Edit" button — switches to inline edit form (same as GoalCard pattern)
- Calls `useTasks.updateTask` via `onEdit` callback prop

## F023 — Complete Task

- TaskCard gets "Complete" button
- Inline confirmation bar: "Mark task complete?" with Confirm/Cancel
- Calls `useTasks.completeTask` (archive + delete + state update)
- Goal progress recalculates automatically via task list change

## F024 — Delete Task

- TaskCard gets "Delete" button
- Inline confirmation bar: "Delete this task?" with Confirm/Cancel
- Calls `useTasks.deleteTask` via `onDelete` callback prop

## Files Modified

- `src/components/TaskCard.tsx` — add `onEdit`, `onDelete`, `onComplete` props, action buttons, edit/delete/complete confirmation states
- `src/app/tasks/page.tsx` — wire up all CRUD callbacks, add CreateTaskForm toggle, pass goals list

## Files Created

- `src/components/CreateTaskForm.tsx`
- `src/components/EditTaskForm.tsx`

## Styling

All follows CLAUDE.md conventions: bg-gray-900 cards, bg-gray-800 inputs, indigo submit buttons, red confirmation for delete, green for complete.
