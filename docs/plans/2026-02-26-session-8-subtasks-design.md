# Session 8 — Subtasks Design (F025–F029)

## Features

- F025: SubtaskList component
- F026: Add subtask inline
- F027: Complete (toggle) subtask
- F028: Lazy load subtasks on expand
- F029: All-done prompt when every subtask checked

## Architecture

Approach B chosen: separate useSubtasks hook + dumb SubtaskList. Hook called inside a container component, mounted only when TaskCard is expanded (satisfies F028 lazy loading naturally).

```
TaskCard (expanded state, confirmation state)
  └─ expanded? → <SubtaskListContainer taskId onAllComplete />
                    ├─ calls useSubtasks(taskId)
                    └─ renders <SubtaskList subtasks loading onAdd onToggle onAllComplete />
                         └─ pure render: checkboxes, inline add input
```

## Files

| File | Role |
|------|------|
| `src/hooks/useSubtasks.ts` | Hook: fetch, add, toggle, delete for a taskId |
| `src/components/SubtaskList.tsx` | Exports SubtaskList (dumb) + SubtaskListContainer (calls hook) |
| `src/components/TaskCard.tsx` | Modified: adds expanded state, renders SubtaskListContainer |

## useSubtasks(taskId) API

```ts
type Subtask = {
  id: string
  task_id: string
  title: string
  completed: boolean
}

useSubtasks(taskId: string) → {
  subtasks: Subtask[]
  loading: boolean
  error: string | null
  addSubtask: (title: string) => Promise<Subtask>
  toggleSubtask: (id: string, completed: boolean) => Promise<Subtask>
  deleteSubtask: (id: string) => Promise<void>
}
```

Follows same useState/useCallback/Supabase pattern as useTasks. Fetches on mount via useEffect.

## SubtaskList (dumb) Props

```ts
type SubtaskListProps = {
  subtasks: Subtask[]
  loading: boolean
  onAdd: (title: string) => Promise<unknown>
  onToggle: (id: string, completed: boolean) => Promise<unknown>
  onAllComplete?: () => void
}
```

- Checkbox per subtask, strikethrough text when completed
- Inline text input + "Add" button at bottom
- After onToggle resolves, checks if all subtasks are now completed → calls onAllComplete()

## TaskCard Changes

- New `expanded` boolean state
- "Subtasks" toggle below metadata row (no count in collapsed state per F028)
- When expanded, mounts SubtaskListContainer with `taskId` and `onAllComplete`
- onAllComplete sets confirming to 'complete', reusing existing green confirmation bar
- Confirmation text: "All subtasks done — mark task complete?"

## Styling

- Subtask area: bg-gray-800/50 rounded section inside the card
- Checkboxes: accent-indigo-500
- Completed subtasks: line-through text-gray-600
- Add input: bg-gray-800 border-gray-700, same as other form inputs
- Toggle button: text-gray-500 hover:text-gray-300

## Out of Scope

- No subtask reordering or drag-drop
- No subtask inline editing (add, toggle, delete only)
- No subtask count in collapsed state (avoids page-load queries)
- Delete subtask: hook method exists but no UI button in this session
