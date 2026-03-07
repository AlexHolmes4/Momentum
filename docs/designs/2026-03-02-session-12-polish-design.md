# Session 12 — Polish (F046-F049) Design

## Features

### F046: Loading States — Already Complete
All 4 pages (dashboard, goals, tasks, archive) have consistent spinner + "Loading..." text pattern. No changes needed.

### F047: Empty States — Already Complete
All pages have friendly empty messages ("No X yet", "Create your first X"). Dashboard has per-section empty states. No changes needed.

### F048: Error Handling — Already Complete
All pages show red inline error bars with "Failed to load X: {error}". Forms have inline error states. No changes needed.

### F049: Responsive Layout — Implementation Required
Spec: "Layout works at min 768px without horizontal scroll."

## F049 Design

### Sidebar (layout.tsx)
- **Desktop (md: 768px+)**: Full sidebar with text labels, fixed `w-56`
- **Mobile (<768px)**: Sidebar hidden by default. Hamburger button in a top bar toggles an overlay sidebar
- Overlay: full-height, `z-50`, semi-transparent backdrop, click-outside-to-close
- State managed with `useState` in layout.tsx (client component already)

### Main Content Padding (layout.tsx)
- Change `p-8` to `p-4 md:p-8`

### Content Container (all pages)
- Keep `max-w-3xl mx-auto` — works fine at 768px+ with reduced padding
- No changes needed to container width

### Form Grids (CreateTaskForm.tsx, dashboard quick-add)
- Change `grid grid-cols-2` to `grid grid-cols-1 md:grid-cols-2`

### FilterBar (FilterBar.tsx)
- Change `min-w-[180px]` to `min-w-[140px]` on search input
- Already uses `flex-wrap` — no other changes needed

### Card Action Buttons (TaskCard.tsx, GoalCard.tsx)
- Add `flex-wrap` to action button containers

## Files to Modify
1. `src/app/layout.tsx` — sidebar collapse + padding
2. `src/components/CreateTaskForm.tsx` — form grid responsive
3. `src/app/dashboard/page.tsx` — quick-add grid responsive
4. `src/components/FilterBar.tsx` — search min-width
5. `src/components/TaskCard.tsx` — action button wrap
6. `src/components/GoalCard.tsx` — action button wrap
