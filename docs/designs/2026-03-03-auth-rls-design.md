# Auth + Row Level Security Design

**Date:** 2026-03-03
**Session:** 13
**Scope:** F050-F056

## Summary

Add Supabase magic link authentication and Postgres Row Level Security to make Momentum deployable. The UI is a convenience layer (login page, redirects); the actual security boundary is RLS at the database level.

## Decisions

- **Auth method:** Magic link (passwordless, via Supabase OTP)
- **User model:** Multi-user capable (user_id on all data tables, RLS scopes per user)
- **Signup access:** Invite only (disable signups in Supabase dashboard, add users manually)
- **Unauthenticated UX:** Redirect to /login

## Security Model

The UI is public; the data is private. Client-side auth context is a UX convenience, not a security boundary. Anyone can bypass React state with dev tools. RLS enforces access at the Postgres level — without a valid JWT, Supabase returns zero rows regardless of what the frontend does.

## Schema Changes

Add `user_id uuid not null references auth.users(id)` to:
- `goals`
- `tasks`
- `archived_tasks`

`subtasks` does NOT get a user_id column. RLS on subtasks checks ownership through the parent task's user_id via a subquery join.

### Migration strategy

New SQL migration file:
1. Add user_id columns (nullable initially for existing data)
2. Enable RLS on all 4 tables
3. Create SELECT/INSERT/UPDATE/DELETE policies scoped to `auth.uid() = user_id`
4. Subtasks policy: `task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid())`

Existing data needs manual user_id assignment after first login, or can be deleted and recreated.

## Auth Infrastructure

### useAuth hook (`src/hooks/useAuth.ts`)
- On mount: `supabase.auth.getSession()`
- Subscribes to `supabase.auth.onAuthStateChange()`
- Exposes: `user`, `loading`, `signIn(email)`, `signOut()`
- `signIn` calls `supabase.auth.signInWithOtp({ email })`

### AuthProvider (`src/components/AuthProvider.tsx`)
- React context wrapping the app in layout.tsx
- Provides `user` and `loading` to all children via `useAuth()` context

### Login page (`src/app/login/page.tsx`)
- Email input + "Send magic link" button
- Success state: "Check your email for a login link"
- Error state: inline message
- Generic message for unknown emails (doesn't leak registration status)
- Styled dark mode, centered card

### Auth-guarded layout (in `layout.tsx`)
- If `loading`: full-page spinner (prevents flash of login page)
- If no `user` and not on `/login`: redirect to `/login`
- If `user` and on `/login`: redirect to `/dashboard`

## Hook Changes

Only inserts change. Reads/updates/deletes are scoped by RLS automatically.

- `useGoals.ts`: `createGoal` includes `user_id: user.id`
- `useTasks.ts`: `createTask` includes `user_id: user.id`
- `useArchive.ts`: `completeTask` insert into archived_tasks includes `user_id: user.id`
- `useSubtasks.ts`: No changes (no user_id column on subtasks)

Hooks get the user via `useAuth()` context.

## Invite-Only Signup

Controlled entirely in Supabase dashboard:
- Authentication > Settings > disable "Allow new users to sign up"
- New users added via Authentication > Users > "Invite user"
- No code changes needed — `signInWithOtp` returns an error for unknown emails

## Sign Out

Logout button added to sidebar. Calls `signOut()`, redirects to `/login`.

## Feature List (F050-F056)

| ID | Name | Description |
|---|---|---|
| F050 | Schema migration for user_id + RLS | Add user_id to goals, tasks, archived_tasks. Enable RLS with per-user policies on all 4 tables. |
| F051 | useAuth hook | Exposes user, loading, signIn(email), signOut. Manages session via supabase.auth. |
| F052 | AuthProvider context | Wraps app in layout.tsx, provides auth state to all children. |
| F053 | Login page | /login route with email input, magic link flow, success/error states. |
| F054 | Auth-guarded layout | Redirect to /login if no session, redirect to /dashboard if logged in on /login. Loading spinner during session check. |
| F055 | Update hooks with user_id | createGoal, createTask, completeTask inserts include user_id from auth context. |
| F056 | Sign out | Logout button in sidebar, calls signOut, redirects to /login. |
