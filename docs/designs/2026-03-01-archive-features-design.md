# Archive Features Design (F041-F044)

**Date:** 2026-03-01
**Session:** 11
**Approach:** A — single self-contained useArchive hook

## F041: useArchive hook

**File:** `src/hooks/useArchive.ts`

- Does NOT fetch on mount (lazy — CLAUDE.md rule: archive data never loaded on startup)
- Exposes: `archivedTasks`, `archivedGoals`, `goalMap`, `loading`, `error`, `fetchArchive`
- `fetchArchive()` runs two parallel Supabase queries:
  1. `SELECT * FROM archived_tasks ORDER BY completed_at DESC`
  2. `SELECT * FROM goals WHERE status IN ('archived', 'completed') ORDER BY created_at DESC`
- Fetches all goals (including active) into `goalMap: Record<string, string>` (id → title) for task name resolution
- Types: `ArchivedTask` (matches archived_tasks columns), reuses `Goal` from useGoals

## F042: Archive page

**File:** `src/app/archive/page.tsx`

- `'use client'` component
- Calls `useArchive()`, triggers `fetchArchive` on mount via useEffect
- Two sections: "Archived Tasks" and "Archived Goals"
- Loading spinner, error message, empty states per section

## F043: Archived tasks list

- Each task shows: title, priority badge (red/amber/green), category pill, completed date (formatted), linked goal name (from goalMap)
- Read-only — no edit/delete/complete actions
- Sorted by completed_at descending

## F044: Archived goals list

- Each goal shows: title, description (truncated), target date, status badge (archived=gray, completed=green)
- Read-only — no actions
- Sorted by created_at descending

## Styling

- bg-gray-950 page, bg-gray-900 cards
- Priority colors match TaskCard conventions (high=red-500, medium=amber-400, low=green-400)
