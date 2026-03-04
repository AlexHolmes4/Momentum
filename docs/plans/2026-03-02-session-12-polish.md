# Session 12 — Polish (F046-F049) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the app with responsive layout (collapsible sidebar, mobile-friendly forms/cards) and mark existing loading/empty/error states as passing.

**Architecture:** F046-F048 are already implemented — just need verification and status update. F049 requires modifying layout.tsx (collapsible sidebar with hamburger), reducing main padding on mobile, making form grids stack on small screens, and adding flex-wrap to card action buttons.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, TypeScript

---

### Task 1: Mark F046-F048 as passing

These features are already implemented across all pages. Update status.

**Files:**
- Modify: `claude-features.json`

**Step 1: Update feature statuses**

Change F046, F047, F048 from `"status": "failing"` to `"status": "passing"` in `claude-features.json`.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors (no code changes, just JSON)

---

### Task 2: Responsive sidebar in layout.tsx

Add hamburger menu on mobile (<768px), keep full sidebar on md+.

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Implement the responsive layout**

Replace the entire `src/app/layout.tsx` with:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './globals.css'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks',     label: 'Tasks' },
  { href: '/goals',     label: 'Goals' },
  { href: '/archive',   label: 'Archive' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex">
        {/* Mobile top bar — visible below md */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-gray-900 border-b border-gray-800 flex items-center px-4 h-12 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white mr-3"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-bold text-white">Momentum</span>
        </div>

        {/* Backdrop — visible when mobile sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav
          className={`fixed z-50 top-0 left-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 transition-transform md:translate-x-0 md:static md:shrink-0 md:min-h-screen ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-6 px-2">
            <span className="text-xl font-bold text-white">Momentum</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white md:hidden"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto pt-16 md:pt-8">
          {children}
        </main>
      </body>
    </html>
  )
}
```

Key changes from original:
- Added `useState` import and `sidebarOpen` state
- Mobile top bar with hamburger (hidden on md+)
- Backdrop overlay on mobile when sidebar open
- Sidebar: `fixed z-50 -translate-x-full` on mobile, slides in via `translate-x-0` when open; `md:static md:translate-x-0` on desktop
- Close button inside sidebar (md:hidden)
- Nav links call `setSidebarOpen(false)` on click
- Main padding: `p-4 md:p-8`, `pt-16 md:pt-8` (accounts for fixed mobile top bar height)

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS, all static routes generated

---

### Task 3: Responsive form grids

Make CreateTaskForm and Dashboard quick-add stack on mobile.

**Files:**
- Modify: `src/components/CreateTaskForm.tsx:73,98`
- Modify: `src/app/dashboard/page.tsx:114`

**Step 1: Fix CreateTaskForm grids**

In `src/components/CreateTaskForm.tsx`, change both grid lines:

Line 73: `grid grid-cols-2 gap-3` → `grid grid-cols-1 md:grid-cols-2 gap-3`
Line 98: `grid grid-cols-2 gap-3` → `grid grid-cols-1 md:grid-cols-2 gap-3`

**Step 2: Fix Dashboard quick-add grid**

In `src/app/dashboard/page.tsx`, line 114:

`grid grid-cols-2 gap-3` → `grid grid-cols-1 md:grid-cols-2 gap-3`

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 4: FilterBar and card action buttons

Reduce FilterBar search min-width and add flex-wrap to card action buttons.

**Files:**
- Modify: `src/components/FilterBar.tsx:32`
- Modify: `src/components/TaskCard.tsx:153`
- Modify: `src/components/GoalCard.tsx:135`

**Step 1: Fix FilterBar search width**

In `src/components/FilterBar.tsx`, line 32:

`min-w-[180px]` → `min-w-[140px]`

**Step 2: Fix TaskCard action buttons**

In `src/components/TaskCard.tsx`, line 153:

`flex gap-3 mt-4 pt-3 border-t border-gray-800` → `flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-800`

**Step 3: Fix GoalCard action buttons**

In `src/components/GoalCard.tsx`, line 135:

`flex gap-3 mt-4 pt-3 border-t border-gray-800` → `flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-800`

**Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 5: Build verification and mark F049 passing

**Step 1: Run full build**

Run: `npm run build`
Expected: PASS, all 8 static routes generated

**Step 2: Run tests**

Run: `npm test`
Expected: all 16 tests pass, no regressions

**Step 3: Start dev server and verify layout**

Start dev server, use preview_snapshot to verify:
- Mobile: hamburger button visible, sidebar hidden
- Desktop: sidebar visible, no hamburger

**Step 4: Update claude-features.json**

Set F049 status to `"passing"`.

**Step 5: Update claude-progress.txt**

Append session 12 summary.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: polish — responsive layout with collapsible sidebar (F046-F049)"
```
