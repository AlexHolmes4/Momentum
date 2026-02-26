# Momentum App — Harness Initializer Session

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the Momentum productivity app from zero using Next.js 14 + TypeScript and establish the long-running agent harness infrastructure so future sessions can implement features autonomously without context loss.

**Architecture:** Next.js 14 App Router, TypeScript, static export (`output: 'export'`), Tailwind CSS (dark mode only), Supabase Postgres backend (4 tables). Routes: `/` → redirects to `/dashboard`, plus `/goals`, `/tasks`, `/archive`. Shared sidebar via root `layout.tsx`. Static export = Cloudflare Pages serves pre-built HTML/JS; all Supabase queries are client-side via the JS client.

> **API route note:** The spec includes a `/api/send-summary` Next.js route stub. API routes require a server runtime and don't work with `output: 'export'`. The stub file will be created with an explanatory comment — to enable it, switch from static export to `@cloudflare/next-on-pages` adapter when needed.

Harness pattern: this Initializer session creates progress tracking files, a granular feature list, and a startup script — subsequent Coding Agent sessions each read the progress file, implement one feature, test it in the browser, commit, and update progress.

**Tech Stack:** Next.js 16 (latest), TypeScript, React 19, Tailwind CSS v4, @supabase/ssr + @supabase/supabase-js (publishable key), Supabase Postgres, Cloudflare Pages

---

## Task 1: Scaffold Next.js + TypeScript Project

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `postcss.config.mjs`
- Create: `tsconfig.json`
- Create: `src/app/globals.css`

> **Note on create-next-app**: The directory name "Momentum" (capital M) violates npm naming rules, so we use manual installation. This gives identical output to `create-next-app@latest` with `--yes` defaults.

**Step 1: Write package.json**
```json
{
  "name": "momentum",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Step 2: Install Next.js 16 + React 19 + TypeScript**
```bash
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/react @types/react-dom @types/node eslint eslint-config-next
```

**Step 3: Install Tailwind CSS v4**
```bash
npm install tailwindcss @tailwindcss/postcss postcss
```
Note: Tailwind v4 uses `@tailwindcss/postcss` — no `autoprefixer` or `tailwind.config.ts` needed. Content scanning is automatic.

**Step 4: Install Supabase packages**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 5: Create PostCSS config (Tailwind v4 format)**
Create `postcss.config.mjs`:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

**Step 6: Create tsconfig.json**
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 7: Configure static export for Cloudflare Pages**
Create `next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',      // generates static files in `out/` for Cloudflare Pages
  trailingSlash: true,   // required for Cloudflare Pages static file routing
  images: {
    unoptimized: true,   // image optimisation requires a server — disabled for static export
  },
}

module.exports = nextConfig
```

**Step 8: Create src/app/globals.css (Tailwind v4 + dark mode)**
```css
@import "tailwindcss";

/* Class-based dark mode — applies dark: variants when .dark class is on any ancestor */
@custom-variant dark (&:where(.dark, .dark *));
```
Note: In Tailwind v4, `@import "tailwindcss"` replaces the old three-directive pattern. `@custom-variant dark` enables `dark:` utilities via the `.dark` class on `<html>`.

**Step 9: Commit**
```bash
git add .
git commit -m "feat: scaffold Next.js 16 + React 19 + Tailwind v4 with static export config"
```

---

## Task 2: Create Directory Structure

**Files:**
- Create: `src/components/.gitkeep`
- Create: `src/lib/.gitkeep`
- Create: `src/hooks/.gitkeep`
- Create: `src/app/dashboard/.gitkeep`
- Create: `src/app/goals/.gitkeep`
- Create: `src/app/tasks/.gitkeep`
- Create: `src/app/archive/.gitkeep`
- Create: `src/app/api/send-summary/.gitkeep`
- Create: `supabase/.gitkeep`
- Create: `docs/plans/.gitkeep`

**Step 1: Create directories**
```bash
mkdir -p src/components src/lib src/hooks src/app/dashboard src/app/goals src/app/tasks src/app/archive src/app/api/send-summary supabase docs/plans
touch src/components/.gitkeep src/lib/.gitkeep src/hooks/.gitkeep supabase/.gitkeep docs/plans/.gitkeep
```

**Step 2: Commit**
```bash
git add .
git commit -m "chore: create project directory structure"
```

---

## Task 3: Create Supabase SQL Schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Write schema.sql**
```sql
-- Momentum App — Supabase Schema
-- Run this in your Supabase project's SQL Editor before starting the app.
-- Recommended region: ap-southeast-1 (Singapore — closest to Perth, Western Australia)

create extension if not exists "pgcrypto";

-- =====================
-- GOALS
-- =====================
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamp with time zone default now()
);

-- =====================
-- TASKS
-- =====================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  category text,
  goal_id uuid references goals(id) on delete set null,  -- nullable: tasks can be standalone
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at timestamp with time zone,                  -- set when task is completed
  created_at timestamp with time zone default now()
);

-- =====================
-- SUBTASKS
-- =====================
create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false
);

-- =====================
-- ARCHIVED TASKS
-- =====================
-- Completed tasks are moved here via INSERT + DELETE from tasks.
-- This table is NEVER loaded in normal app context.
-- Only queried when user explicitly opens the Archive view.
create table if not exists archived_tasks (
  id uuid,
  title text,
  priority text,
  due_date date,
  category text,
  goal_id uuid,
  completed_at timestamp with time zone,
  original_created_at timestamp with time zone
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- Single-user app — no auth required yet.
-- To add auth later: enable RLS and add per-user policies.
alter table goals disable row level security;
alter table tasks disable row level security;
alter table subtasks disable row level security;
alter table archived_tasks disable row level security;

-- =====================
-- MCP-FRIENDLY COMMENTS
-- =====================
-- Schema designed for intuitive Supabase MCP queries via Claude chat:
--   "What tasks are overdue?"
--     → SELECT * FROM tasks WHERE due_date < CURRENT_DATE AND status = 'active';
--   "Show active goals and their progress"
--     → SELECT g.*, COUNT(t.id) as total_tasks, COUNT(CASE WHEN t.status='completed' THEN 1 END) as done
--        FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id WHERE g.status = 'active' GROUP BY g.id;
--   "Mark the fitness goal as completed"
--     → UPDATE goals SET status = 'completed' WHERE title ILIKE '%fitness%';
```

**Step 2: Commit**
```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema SQL — 4 tables with MCP-friendly comments"
```

---

## Task 4: Environment Config

**Files:**
- Create: `.env.example`
- Create: `.env.local` (fill in real values — gitignored)

**Step 1: Create .env.example**
```
# Supabase — get values from: Supabase dashboard → Settings → API Keys
#
# NEXT_PUBLIC_SUPABASE_URL: your project URL (e.g. https://xyzabc.supabase.co)
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: the NEW publishable key (format: sb_publishable_...)
#   → NOT the legacy anon JWT key. Get it from: Settings → API Keys → Publishable key
#   → Publishable keys can be rotated independently and are safe to expose client-side.
#
# Note: NEXT_PUBLIC_ prefix is required for Next.js client-side environment variable access.
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
```

**Step 2: Create .env.local** (fill in real Supabase values before running)
```
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your sb_publishable_... key from Supabase dashboard>
```
Verify `.env.local` is gitignored — Next.js default `.gitignore` already includes `.env*.local`.

**Step 3: Commit**
```bash
git add .env.example
git commit -m "chore: add .env.example — NEXT_PUBLIC_ Supabase env vars (publishable key)"
```

---

## Task 5: Wire Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`

**Step 1: Create Supabase client**
```ts
// src/lib/supabase.ts
// Browser-side Supabase client using @supabase/ssr — the Supabase-recommended
// approach for Next.js projects (matches the official with-supabase template).
//
// Uses the new publishable key (sb_publishable_...) instead of the legacy anon JWT key.
// Get your publishable key from: Supabase dashboard → Settings → API Keys → Publishable key
//
// MCP Hook: Claude's Supabase MCP connector reads the same database directly —
// schema is designed to support intuitive natural-language queries via claude.ai.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example → .env.local and add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
  )
}

// Singleton browser client — safe for static export (all queries are client-side).
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)
```

**Step 2: Commit**
```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase client with env var validation"
```

---

## Task 6: Build App Shell

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx` (root redirect)
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/goals/page.tsx`
- Create: `src/app/tasks/page.tsx`
- Create: `src/app/archive/page.tsx`

**Step 1: globals.css is already created in Task 1 Step 8 — skip, already done.**

**Step 2: Write root layout with sidebar**
```tsx
// src/app/layout.tsx
'use client'
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

  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen flex">
        {/* Sidebar */}
        <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 shrink-0 min-h-screen">
          <div className="text-xl font-bold text-white mb-6 px-2">Momentum</div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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

        {/* Main content — each page fills this */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
```

**Step 3: Root page redirects to /dashboard**
```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

**Step 4: Create stub pages for each route**

`src/app/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return <p className="text-gray-500">Dashboard — to be implemented</p>
}
```

`src/app/goals/page.tsx`:
```tsx
export default function GoalsPage() {
  return <p className="text-gray-500">Goals — to be implemented</p>
}
```

`src/app/tasks/page.tsx`:
```tsx
export default function TasksPage() {
  return <p className="text-gray-500">Tasks — to be implemented</p>
}
```

`src/app/archive/page.tsx`:
```tsx
export default function ArchivePage() {
  return <p className="text-gray-500">Archive — to be implemented</p>
}
```

**Step 5: Create API route stub**
```ts
// src/app/api/send-summary/route.ts
//
// Email Summary Stub — MCP Integration Hook
//
// DEPLOYMENT NOTE: Next.js API routes require a server runtime.
// This file does NOT work with `output: 'export'` (static site).
// To enable this route, switch to @cloudflare/next-on-pages adapter:
//   npm install --save-dev @cloudflare/next-on-pages
//   Build command: npx @cloudflare/next-on-pages
//   Output directory: .vercel/output/static
//
// Future wiring: Replace console.log with Resend/SendGrid/Gmail API via MCP.
// MCP Hook: Claude can trigger this via Supabase MCP + a webhook, or directly
// by calling this endpoint when deployed with Workers runtime.

export async function GET() {
  // TODO: fetch from Supabase and build real summary
  const summary = {
    generated_at: new Date().toISOString(),
    active_goals: 0,
    active_tasks: 0,
    overdue_tasks: 0,
    message: 'Email summary stub — wire to Resend/SendGrid to activate',
  }

  console.log('[send-summary]', summary)

  return Response.json(summary)
}
```

**Step 6: Verify dev server**
```bash
npm run dev
```
Open http://localhost:3000 — should auto-redirect to http://localhost:3000/dashboard.
Verify: dark sidebar, Momentum title, 4 nav links, active link is indigo, no console errors.

**Step 7: Commit**
```bash
git add src/app/
git commit -m "feat: add App Router layout with sidebar, route stubs, and API stub"
```

---

## Task 7: Create Harness Infrastructure

The core deliverable of the Initializer Session. Creates the files that enable all future Coding Agent sessions.

**Files:**
- Create: `CLAUDE.md`
- Create: `init.sh`
- Create: `claude-progress.txt`
- Create: `claude-features.json`

**Step 1: Create CLAUDE.md**
```markdown
# Momentum — Claude Code Project Guide

## What This App Is
Personal productivity app: Goals (big-picture objectives) + Tasks (daily work).
Tasks optionally link to Goals. Goal progress = % of linked tasks completed.
Single user, no auth, dark mode only, TypeScript throughout.

## Tech Stack
- **Frontend**: Next.js 16 (latest), TypeScript, React 19, Tailwind CSS v4 (class dark mode)
- **Database**: Supabase (Postgres) — 4 tables: goals, tasks, subtasks, archived_tasks
- **Supabase client**: `@supabase/ssr` (`createBrowserClient`) + publishable key (`sb_publishable_...`)
- **Hosting**: Cloudflare Pages — static export (`output: 'export'` in next.config.js)
- **MCP**: Supabase MCP connector lets Claude query/mutate the DB directly from claude.ai chat

## Important: Static Export
The app uses `output: 'export'` in next.config.js. This means:
- `npm run build` generates `out/` — Cloudflare Pages serves these static files
- No SSR — all Supabase queries are client-side
- All interactive components MUST have `'use client'` at the top
- The root layout.tsx is already `'use client'` for the sidebar
- The `/api/send-summary` route stub does NOT work in static mode — see its file comment

## Project Structure
```
src/
  app/
    layout.tsx              Root layout — persistent sidebar (client component)
    page.tsx                Redirects to /dashboard
    dashboard/page.tsx      Dashboard view
    goals/page.tsx          Goals view
    tasks/page.tsx          Tasks view
    archive/page.tsx        Archive view (loads data only on demand)
    api/send-summary/
      route.ts              Email summary stub (requires server runtime to activate)
    globals.css             Tailwind directives only
  components/               GoalCard.tsx, GoalProgressBar.tsx, TaskCard.tsx, SubtaskList.tsx, FilterBar.tsx
  lib/                      supabase.ts, goalHelpers.ts, taskHelpers.ts
  hooks/                    useGoals.ts, useTasks.ts, useArchive.ts
supabase/
  schema.sql                Run in Supabase SQL Editor before first use
docs/plans/                 Session implementation plans
```

## Agent Startup Sequence (EVERY session)
1. `bash init.sh` — verifies env, shows git log and current progress
2. Read `claude-progress.txt` — understand what's done
3. Read `claude-features.json` — find first `"status": "failing"` entry
4. Implement that feature (one per session)
5. Test at http://localhost:3000 (run: npm run dev)
6. Update `claude-features.json`: set feature status to `"passing"`
7. Append session summary to `claude-progress.txt`
8. Commit

## Coding Conventions
- `'use client'` is required at the top of any component using hooks or browser APIs
- **Background layers**: bg-gray-950 (page), bg-gray-900 (sidebar/cards), bg-gray-800 (inputs)
- **Priority colors**: high=`text-red-500 bg-red-500/10`, medium=`text-amber-400 bg-amber-400/10`, low=`text-green-400 bg-green-400/10`
- **Active nav**: bg-indigo-600
- Components: `PascalCase.tsx` in `src/components/`
- Hooks: `camelCase.ts` starting with `use` in `src/hooks/`
- Types: define inline or in the same file — no separate types/ directory needed yet
- Supabase queries belong in hooks, not directly in components
- Env vars use `NEXT_PUBLIC_` prefix (e.g. `NEXT_PUBLIC_SUPABASE_URL`)
- Archive data is NEVER loaded on startup — `useArchive` fetches only when called

## Supabase Schema
- `goals`: id, title, description, target_date, status ('active'|'completed'|'archived'), created_at
- `tasks`: id, title, priority ('high'|'medium'|'low'), due_date, category, goal_id (nullable FK → goals), status ('active'|'completed'), completed_at, created_at
- `subtasks`: id, task_id (FK → tasks, cascade delete), title, completed (boolean)
- `archived_tasks`: completed tasks moved here (INSERT + DELETE from tasks) — never loaded by default

## Goal Progress Calculation
```
progress% = (count of linked tasks where status='completed' / count of all linked tasks) * 100
```
If no linked tasks: progress = 0%. Logic lives in `src/lib/goalHelpers.ts`.

## Key Business Rules
- Completing ALL subtasks does NOT auto-complete parent task — show a prompt, user confirms
- Completing a task: INSERT into archived_tasks + DELETE from tasks → recalculate goal progress
- Archive view: only loads data when user navigates to /archive (useArchive hook pattern)
```

**Step 2: Create init.sh**
```bash
#!/bin/bash
# init.sh — Startup verification for Momentum Coding Agent sessions
# Run at the start of every new Claude Code session on this project.

set -e

echo "=== Momentum — Agent Session Startup ==="
echo ""
echo "📁 Directory: $(pwd)"
echo "📦 Node: $(node -v 2>/dev/null || echo 'NOT FOUND') | npm: $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo ""

if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules missing — running npm install..."
  npm install
else
  echo "✅ node_modules present"
fi

if [ ! -f ".env.local" ]; then
  echo "❌ .env.local missing — copy .env.example and add Supabase credentials"
  exit 1
else
  echo "✅ .env.local present"
fi

echo ""
echo "=== Recent Commits (last 8) ==="
git log --oneline -8

echo ""
echo "=== Git Status ==="
git status --short

echo ""
echo "=== Progress Log ==="
cat claude-progress.txt

echo ""
echo "=== Agent Instructions ==="
echo "1. Find first 'failing' feature in claude-features.json"
echo "2. Implement it — one feature per session"
echo "3. Test at http://localhost:3000 (npm run dev)"
echo "4. Update claude-features.json status to 'passing'"
echo "5. Append summary to claude-progress.txt"
echo "6. Commit"
echo ""
```

**Step 3: Create claude-progress.txt**
```
# Momentum — Agent Progress Log
# Append a new entry after each session. Never delete entries.

---
[Session 1 — Initializer — 2026-02-22]
STATUS: Complete
COMPLETED:
  - Scaffolded Next.js 16 + React 19 with TypeScript + Tailwind CSS v4 (class dark mode)
  - Configured static export for Cloudflare Pages (output='export', trailingSlash=true)
  - Created full directory structure (components, lib, hooks, app routes, supabase, docs/plans)
  - Created supabase/schema.sql — 4 tables ready to run in Supabase SQL Editor
  - Created .env.example with NEXT_PUBLIC_ prefixed env vars
  - Wired Supabase client — src/lib/supabase.ts
  - Built app shell: layout.tsx sidebar + redirect at / + 4 stub pages
  - Created email summary stub — src/app/api/send-summary/route.ts (server-only, see file comment)
  - Created CLAUDE.md project guide
  - Created init.sh startup script
  - Created claude-progress.txt (this file)
  - Created claude-features.json with feature list (F001–F049)
  - Added Cloudflare Pages security headers — public/_headers
NOTES:
  - supabase/schema.sql must be manually run in Supabase SQL Editor before app can query DB
  - .env.local needs real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  - All interactive components need 'use client' directive (static export requirement)
  - API route stub at /api/send-summary requires server runtime — does not work in static export
  - Dev server runs at http://localhost:3000
NEXT:
  Session 2: implement F006 (useGoals hook) + F007 (goalHelpers) + F008 (Goals list view)
---
```

**Step 4: Create claude-features.json**
```json
{
  "app": "Momentum",
  "version": "1.0",
  "framework": "Next.js 14 App Router + TypeScript",
  "instructions": "Work through features in order. Only change 'failing' to 'passing' after verifying in the browser at http://localhost:3000. Never remove entries.",
  "features": [
    { "id": "F001", "area": "infrastructure", "name": "Next.js + TypeScript scaffold", "description": "npm run dev starts at localhost:3000 without errors", "status": "passing" },
    { "id": "F002", "area": "infrastructure", "name": "Tailwind dark mode", "description": "bg-gray-950 background renders, dark class on <html>", "status": "passing" },
    { "id": "F003", "area": "infrastructure", "name": "Static export configured", "description": "next.config.js has output: 'export' and trailingSlash: true, npm run build creates out/", "status": "passing" },
    { "id": "F004", "area": "infrastructure", "name": "Supabase client wired", "description": "src/lib/supabase.ts exports client, missing env vars throw clear error", "status": "passing" },
    { "id": "F005", "area": "infrastructure", "name": "App shell with sidebar navigation", "description": "Sidebar with 4 Next.js Link items, active route highlighted indigo, / redirects to /dashboard", "status": "passing" },
    { "id": "F006", "area": "goals", "name": "useGoals hook", "description": "src/hooks/useGoals.ts — fetches active goals on mount, exposes: goals, loading, error, createGoal, updateGoal, deleteGoal, archiveGoal", "status": "failing" },
    { "id": "F007", "area": "goals", "name": "goalHelpers utility", "description": "src/lib/goalHelpers.ts — calculateProgress(tasks: Task[]): number — returns 0-100. Pure function.", "status": "failing" },
    { "id": "F008", "area": "goals", "name": "Goals list view", "description": "src/app/goals/page.tsx renders list of active goals using useGoals hook", "status": "failing" },
    { "id": "F009", "area": "goals", "name": "GoalProgressBar component", "description": "src/components/GoalProgressBar.tsx — renders filled bar from 0-100 prop, indigo fill", "status": "failing" },
    { "id": "F010", "area": "goals", "name": "GoalCard component", "description": "src/components/GoalCard.tsx — shows title, description, target date, status badge, GoalProgressBar", "status": "failing" },
    { "id": "F011", "area": "goals", "name": "Create goal form", "description": "Modal or inline form: title (required), description, target_date. Calls useGoals.createGoal.", "status": "failing" },
    { "id": "F012", "area": "goals", "name": "Edit goal", "description": "Pre-populated form for all goal fields. Calls useGoals.updateGoal.", "status": "failing" },
    { "id": "F013", "area": "goals", "name": "Delete goal", "description": "Confirmation dialog then useGoals.deleteGoal removes from Supabase", "status": "failing" },
    { "id": "F014", "area": "goals", "name": "Archive goal", "description": "Sets goal status to 'archived' via useGoals.archiveGoal, hides from active list", "status": "failing" },
    { "id": "F015", "area": "goals", "name": "View linked tasks per goal", "description": "Expand a GoalCard to see tasks linked to that goal (filtered from task list)", "status": "failing" },
    { "id": "F016", "area": "tasks", "name": "useTasks hook", "description": "src/hooks/useTasks.ts — fetches active tasks, exposes: tasks, loading, error, createTask, updateTask, deleteTask, completeTask", "status": "failing" },
    { "id": "F017", "area": "tasks", "name": "taskHelpers utility", "description": "src/lib/taskHelpers.ts — filterTasks(tasks, filters): Task[] and sortTasks(tasks, sort): Task[] — pure functions", "status": "failing" },
    { "id": "F018", "area": "tasks", "name": "Tasks list view", "description": "src/app/tasks/page.tsx renders all active tasks using useTasks hook", "status": "failing" },
    { "id": "F019", "area": "tasks", "name": "TaskCard component", "description": "src/components/TaskCard.tsx — shows title, priority badge, due date, category, goal link label", "status": "failing" },
    { "id": "F020", "area": "tasks", "name": "Priority color coding", "description": "TaskCard: high=red-500, medium=amber-400, low=green-400 badge styling", "status": "failing" },
    { "id": "F021", "area": "tasks", "name": "Create task form", "description": "Form: title (required), priority dropdown, due_date, category, goal_id select. Calls useTasks.createTask.", "status": "failing" },
    { "id": "F022", "area": "tasks", "name": "Edit task", "description": "Pre-populated form for all task fields. Calls useTasks.updateTask.", "status": "failing" },
    { "id": "F023", "area": "tasks", "name": "Complete task action", "description": "INSERT into archived_tasks + DELETE from tasks + recalculate goal progress via useGoals", "status": "failing" },
    { "id": "F024", "area": "tasks", "name": "Delete task", "description": "Confirmation dialog then useTasks.deleteTask removes from Supabase", "status": "failing" },
    { "id": "F025", "area": "tasks", "name": "SubtaskList component", "description": "src/components/SubtaskList.tsx — renders subtask list with checkboxes for a given task", "status": "failing" },
    { "id": "F026", "area": "tasks", "name": "Subtasks — add subtask", "description": "Inline input in SubtaskList to add a new subtask. Saves to Supabase subtasks table.", "status": "failing" },
    { "id": "F027", "area": "tasks", "name": "Subtasks — complete subtask", "description": "Checking a subtask updates completed=true in Supabase", "status": "failing" },
    { "id": "F028", "area": "tasks", "name": "Subtasks — lazy load on expand", "description": "Subtasks fetched from Supabase only when TaskCard is expanded — not on initial page load", "status": "failing" },
    { "id": "F029", "area": "tasks", "name": "Subtasks — all-done prompt", "description": "When all subtasks checked, show prompt 'All subtasks done — mark task complete?' No auto-complete.", "status": "failing" },
    { "id": "F030", "area": "dashboard", "name": "Dashboard view scaffold", "description": "src/app/dashboard/page.tsx renders 3 sections: Today's Tasks, Overdue Tasks, Goals Overview", "status": "failing" },
    { "id": "F031", "area": "dashboard", "name": "Today's tasks section", "description": "Tasks where due_date = today shown in Dashboard Today section", "status": "failing" },
    { "id": "F032", "area": "dashboard", "name": "Overdue tasks section", "description": "Tasks where due_date < today shown with red highlight in Dashboard Overdue section", "status": "failing" },
    { "id": "F033", "area": "dashboard", "name": "Goal progress overview section", "description": "All active goals with GoalProgressBar shown in Dashboard Goals Overview section", "status": "failing" },
    { "id": "F034", "area": "dashboard", "name": "Quick-add task from Dashboard", "description": "Inline minimal form on Dashboard: title + priority + optional due date. Calls useTasks.createTask.", "status": "failing" },
    { "id": "F035", "area": "filter-search", "name": "FilterBar component", "description": "src/components/FilterBar.tsx — dropdowns for priority, goal, category, due-date-range", "status": "failing" },
    { "id": "F036", "area": "filter-search", "name": "Filter by priority", "description": "FilterBar priority selection filters Tasks view client-side via taskHelpers.filterTasks", "status": "failing" },
    { "id": "F037", "area": "filter-search", "name": "Filter by goal", "description": "FilterBar goal selection filters Tasks view to tasks linked to that goal", "status": "failing" },
    { "id": "F038", "area": "filter-search", "name": "Filter by due date", "description": "FilterBar date range (today / this week / overdue) filters Tasks view", "status": "failing" },
    { "id": "F039", "area": "filter-search", "name": "Filter by category", "description": "FilterBar category selection filters Tasks view by task.category", "status": "failing" },
    { "id": "F040", "area": "filter-search", "name": "Search tasks and goals", "description": "Search input filters tasks and goals by title/description, client-side", "status": "failing" },
    { "id": "F041", "area": "archive", "name": "useArchive hook", "description": "src/hooks/useArchive.ts — fetches archived_tasks and archived/completed goals only when called", "status": "failing" },
    { "id": "F042", "area": "archive", "name": "Archive view", "description": "src/app/archive/page.tsx renders completed tasks and archived goals via useArchive on demand", "status": "failing" },
    { "id": "F043", "area": "archive", "name": "Archived tasks list", "description": "List of archived_tasks with completion date and goal link shown in Archive view", "status": "failing" },
    { "id": "F044", "area": "archive", "name": "Archived goals list", "description": "Goals with status='archived' or 'completed' listed in Archive view", "status": "failing" },
    { "id": "F045", "area": "api", "name": "Email summary stub route", "description": "src/app/api/send-summary/route.ts — GET returns JSON summary of active tasks+goals. Logs to console. See file for activation instructions.", "status": "passing" },
    { "id": "F046", "area": "polish", "name": "Loading states", "description": "Skeleton or spinner on Goals and Tasks views while Supabase data fetches (from hook loading state)", "status": "failing" },
    { "id": "F047", "area": "polish", "name": "Empty states", "description": "Friendly message when no goals or tasks exist", "status": "failing" },
    { "id": "F048", "area": "polish", "name": "Error handling", "description": "Supabase errors displayed as inline message or toast (from hook error state)", "status": "failing" },
    { "id": "F049", "area": "polish", "name": "Responsive layout", "description": "Layout works at min 768px without horizontal scroll", "status": "failing" }
  ]
}
```

**Step 5: Make init.sh executable and commit**
```bash
git add CLAUDE.md init.sh claude-progress.txt claude-features.json
git commit -m "feat: add long-running agent harness — CLAUDE.md, init.sh, progress log, feature list (F001-F049)"
```

---

## Task 8: Cloudflare Pages Config

**Files:**
- Create: `public/_headers`

No `_redirects` needed — Next.js static export generates per-route HTML files (`out/dashboard/index.html`, etc.). Cloudflare Pages serves these directly.

**Step 1: Create security headers**
Create `public/_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

**Step 2: Commit**
```bash
git add public/_headers
git commit -m "chore: add Cloudflare Pages security headers"
```

---

## Task 9: Save Plan Document

**Files:**
- Create: `docs/plans/2026-02-22-momentum-full-build.md`

**Step 1:** Copy this plan file to `docs/plans/2026-02-22-momentum-full-build.md`.

**Step 2: Commit**
```bash
git add docs/plans/
git commit -m "docs: save Initializer Session implementation plan"
```

---

## Task 10: Final Verification

**Step 1: Verify dev server**
```bash
npm run dev
```
Open http://localhost:3000. Verify:
- [ ] Redirects to http://localhost:3000/dashboard
- [ ] Dark bg-gray-950 background
- [ ] Sidebar with Momentum + 4 nav links
- [ ] Active link highlights indigo
- [ ] No TypeScript or console errors

**Step 2: Verify production build**
```bash
npm run build
```
Expected: Build succeeds, `out/` folder created with `dashboard/index.html`, `goals/index.html`, `tasks/index.html`, `archive/index.html`.

**Step 3: Verify git log**
```bash
git log --oneline
```
Expected: ~9 commits showing clean scaffold → harness → config progression.

**Step 4: Verify harness files exist**
```bash
ls CLAUDE.md init.sh claude-progress.txt claude-features.json supabase/schema.sql .env.example
```
Expected: All 6 files listed.

---

## After This Session: Setup Checklist

Before Session 2 can run:
1. **Supabase**: Create project at supabase.com (free tier, region: ap-southeast-1 Singapore)
2. **Schema**: Run `supabase/schema.sql` in Supabase SQL Editor
3. **Env**: Add Supabase URL + publishable key (`sb_publishable_...`) to `.env.local`
4. **Cloudflare Pages** (optional now, required before production):
   - Connect GitHub repo at dash.cloudflare.com → Pages → Create application
   - Build command: `npm run build` | Output: `out`
   - Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Recommended Session Order After This

| Session | Features | Focus |
|---------|----------|-------|
| 2 | F006–F010 | useGoals + goalHelpers + Goals view + GoalProgressBar + GoalCard |
| 3 | F011–F015 | Goal CRUD (create, edit, delete, archive) + linked tasks view |
| 4 | F016–F020 | useTasks + taskHelpers + Tasks view + TaskCard + priority colors |
| 5 | F021–F024 | Task CRUD (create, edit, complete, delete) |
| 6 | F025–F029 | Subtasks (SubtaskList, add, complete, lazy load, all-done prompt) |
| 7 | F030–F034 | Dashboard (scaffold, today, overdue, goals overview, quick-add) |
| 8 | F035–F040 | FilterBar + all filter types + search |
| 9 | F041–F044 | Archive view |
| 10 | F046–F049 | Polish (loading, empty states, errors, responsive) |
