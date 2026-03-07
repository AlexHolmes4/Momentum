# Momentum — Claude Code Project Guide

## What This App Is
Personal productivity app: Goals (big-picture objectives) + Tasks (daily work).
Tasks optionally link to Goals. Goal progress = % of linked tasks completed.
Single user, no auth, dark mode only, TypeScript throughout.

## Tech Stack
- **Frontend**: Next.js 16 (latest), TypeScript, React 19, Tailwind CSS v4 (class dark mode)
- **Database**: Supabase (Postgres) — 4 tables: goals, tasks, subtasks, archived_tasks
- **Supabase client**: `@supabase/ssr` (`createBrowserClient`) + publishable key (`sb_publishable_...`)
- **Hosting**: Cloudflare Workers (static assets) — static export (`output: 'export'` in next.config.js), `wrangler.toml` points at `out/` — https://momentum.alexgholmes.workers.dev
- **MCP**: Supabase MCP connector lets Claude query/mutate the DB directly from claude.ai chat

## Important: Static Export
The app uses `output: 'export'` in next.config.js. This means:
- `npm run build` generates `out/` — Cloudflare Workers serves these static files
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
docs/plans/               Feature design docs (brainstorm output, permanent project knowledge)
.claude/plans/              Agent implementation plans and session working files (ephemeral)
```

## Agent Startup Sequence (EVERY session)
1. `bash init.sh` — verifies env, shows git log and current progress
2. Read `claude-progress.txt` — understand what's done
3. Read `claude-features.json` — find first `"status": "failing"` entry
4. Implement that feature (one per session)
5. Test at http://localhost:11001 (run: npm run dev)
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

## File Conventions
- **`docs/`** — permanent project documentation, committed and useful to any developer
  - `docs/plans/*-design.md` — feature design docs produced by brainstorming (what we built and why)
- **`.claude/`** — Claude Code config and working files, not project documentation
  - `.claude/plans/*-plan.md` — agent implementation plans produced by writing-plans skill
  - `.claude/plans/session-*.md` — session execution plans and notes
  - `.claude/launch.json` — dev server config

## Key Business Rules
- Completing ALL subtasks does NOT auto-complete parent task — show a prompt, user confirms
- Completing a task: INSERT into archived_tasks + DELETE from tasks → recalculate goal progress
- Archive view: only loads data when user navigates to /archive (useArchive hook pattern)
