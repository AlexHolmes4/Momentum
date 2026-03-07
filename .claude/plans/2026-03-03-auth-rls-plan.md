# Auth + RLS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase magic link authentication and Row Level Security so Momentum is deployable with per-user data isolation.

**Architecture:** AuthProvider context wraps the app, providing `user` and auth methods to all children. RLS policies on all tables enforce data access at the Postgres level. The UI auth gate (redirect to /login) is a UX convenience — the security boundary is RLS. Hooks include `user_id` in inserts; reads/updates/deletes are scoped automatically by RLS.

**Tech Stack:** Supabase Auth (magic link OTP), Postgres RLS, React Context, `@supabase/ssr`

---

### Task 1: SQL Migration — Add user_id Columns + RLS Policies (F050)

**Files:**
- Create: `supabase/migration-auth-rls.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Add user_id columns and enable Row Level Security
-- Run this in Supabase SQL Editor AFTER running schema.sql
-- Pre-requisite: At least one user must exist in auth.users (invite via dashboard first)

-- =====================
-- ADD user_id COLUMNS
-- =====================

-- Goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Archived tasks
ALTER TABLE archived_tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- =====================
-- BACKFILL EXISTING DATA (optional)
-- =====================
-- If you have existing data, assign it to your user.
-- Replace YOUR_USER_ID with your auth.users id from Supabase dashboard.
-- Uncomment and run once:
--
-- UPDATE goals SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE tasks SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE archived_tasks SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;

-- After backfill, make user_id NOT NULL:
-- ALTER TABLE goals ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE archived_tasks ALTER COLUMN user_id SET NOT NULL;

-- =====================
-- ENABLE ROW LEVEL SECURITY
-- =====================

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_tasks ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES — goals
-- =====================
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- RLS POLICIES — tasks
-- =====================
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================
-- RLS POLICIES — subtasks (via parent task ownership)
-- =====================
CREATE POLICY "Users can view own subtasks"
  ON subtasks FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own subtasks"
  ON subtasks FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own subtasks"
  ON subtasks FOR UPDATE
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own subtasks"
  ON subtasks FOR DELETE
  USING (task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid()));

-- =====================
-- RLS POLICIES — archived_tasks
-- =====================
CREATE POLICY "Users can view own archived tasks"
  ON archived_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own archived tasks"
  ON archived_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own archived tasks"
  ON archived_tasks FOR DELETE
  USING (auth.uid() = user_id);
```

Save this file to `supabase/migration-auth-rls.sql`.

**Step 2: Update schema.sql comments**

In `supabase/schema.sql`, update the RLS section (lines 63-69) to reference the migration:

```sql
-- =====================
-- ROW LEVEL SECURITY
-- =====================
-- RLS is configured in migration-auth-rls.sql.
-- Run that migration after initial schema setup and user creation.
-- See docs/plans/2026-03-03-auth-rls-design.md for details.
```

**Step 3: Commit**

```bash
git add supabase/migration-auth-rls.sql supabase/schema.sql
git commit -m "feat(F050): add auth migration with user_id columns and RLS policies"
```

---

### Task 2: useAuth Hook (F051)

**Files:**
- Create: `src/hooks/useAuth.ts`
- Test: `src/hooks/__tests__/useAuth.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing hook
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignInWithOtp = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOtp: mockSignInWithOtp,
      signOut: mockSignOut,
    },
  },
}))

import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('resolves to no user when session is null', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('resolves to user when session exists', async () => {
    const fakeUser = { id: 'user-123', email: 'test@example.com' }
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
      error: null,
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('signIn calls signInWithOtp with email', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signIn('test@example.com')
    })
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com' })
  })

  it('signIn throws on error', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await expect(
      act(async () => {
        await result.current.signIn('test@example.com')
      })
    ).rejects.toThrow('Rate limit exceeded')
  })

  it('signOut calls supabase signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signOut()
    })
    expect(mockSignOut).toHaveBeenCalled()
  })
})
```

**Step 2: Install @testing-library/react (needed for renderHook)**

```bash
npm install --save-dev @testing-library/react @testing-library/dom jsdom
```

Add `environment: 'jsdom'` to `vitest.config.ts` test config.

**Step 3: Run tests to verify they fail**

```bash
npm test -- src/hooks/__tests__/useAuth.test.ts
```

Expected: FAIL — `useAuth` does not exist yet.

**Step 4: Write the hook**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  return { user, loading, signIn, signOut }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- src/hooks/__tests__/useAuth.test.ts
```

Expected: 6 tests PASS.

**Step 6: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/__tests__/useAuth.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(F051): add useAuth hook with magic link sign-in"
```

---

### Task 3: AuthProvider Context (F052)

**Files:**
- Create: `src/components/AuthProvider.tsx`

**Step 1: Write the AuthProvider**

```typescript
'use client'
import { createContext, useContext } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/components/AuthProvider.tsx
git commit -m "feat(F052): add AuthProvider context for app-wide auth state"
```

---

### Task 4: Login Page (F053)

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Write the login page**

```typescript
'use client'
import { useState, FormEvent } from 'react'
import { useAuthContext } from '@/components/AuthProvider'

export default function LoginPage() {
  const { signIn } = useAuthContext()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    setError(null)

    try {
      await signIn(email.trim())
      setSent(true)
    } catch (err) {
      // Generic message — don't leak whether email is registered
      setError('Unable to send login link. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Momentum</h1>
        <p className="text-sm text-gray-400 mb-6">Sign in with a magic link</p>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm mb-4">
              Check your email for a login link.
            </div>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="block text-xs text-gray-400 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {sending ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: clean (login page won't render yet without AuthProvider in layout — that's Task 5).

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(F053): add login page with magic link flow"
```

---

### Task 5: Auth-Guarded Layout (F054)

**Files:**
- Modify: `src/app/layout.tsx`

This task wraps the app in AuthProvider and adds redirect logic.

**Step 1: Write an AuthGate component**

Add a new component inside layout.tsx (or as a separate file) that handles the redirect logic. Since layout.tsx is already `'use client'`, we can add it inline. However, for clarity, create a separate component:

Create `src/components/AuthGate.tsx`:

```typescript
'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user && pathname !== '/login') {
      router.replace('/login')
    }
    if (user && pathname === '/login') {
      router.replace('/dashboard')
    }
  }, [user, loading, pathname, router])

  // Loading state — full-page spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Not logged in and not on login page — show nothing while redirecting
  if (!user && pathname !== '/login') {
    return null
  }

  // On login page — render without sidebar
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Authenticated — render children (with sidebar from layout)
  return <>{children}</>
}
```

**Step 2: Modify layout.tsx**

Update `src/app/layout.tsx` to:
1. Import and wrap with `AuthProvider`
2. Import and use `AuthGate`
3. Conditionally show sidebar only when authenticated and not on /login

The key change: wrap `<body>` contents in `<AuthProvider>`, then use `<AuthGate>` to control what renders. The sidebar should only appear for authenticated users.

Replace the full layout.tsx content:

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthProvider, useAuthContext } from '@/components/AuthProvider'
import { AuthGate } from '@/components/AuthGate'
import './globals.css'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks',     label: 'Tasks' },
  { href: '/goals',     label: 'Goals' },
  { href: '/archive',   label: 'Archive' },
]

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut } = useAuthContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Login page renders without sidebar
  if (pathname === '/login' || !user) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
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

      {/* Backdrop */}
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

        {/* Sign out button — bottom of sidebar */}
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="text-xs text-gray-500 px-3 mb-2 truncate">
            {user.email}
          </div>
          <button
            onClick={async () => {
              await signOut()
            }}
            className="w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-left"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pt-16 md:pt-8">
        {children}
      </main>
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <AuthProvider>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  )
}
```

Note: This combines F054 (auth-guarded layout) and F056 (sign out button) since the sign out button lives in the sidebar. They can be committed separately or together.

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Run existing tests**

```bash
npm test
```

Expected: all existing tests still pass (they don't render the layout).

**Step 5: Commit**

```bash
git add src/components/AuthGate.tsx src/app/layout.tsx
git commit -m "feat(F054, F056): auth-guarded layout with sign out button in sidebar"
```

---

### Task 6: Update Hooks with user_id (F055)

**Files:**
- Modify: `src/hooks/useGoals.ts` (line 52-62 — createGoal insert)
- Modify: `src/hooks/useTasks.ts` (line 58-68 — createTask insert, line 103-114 — completeTask archived_tasks insert)

**Step 1: Update useGoals.ts**

Add import for `useAuthContext` and include `user_id` in the insert:

At top of file, add import:
```typescript
import { useAuthContext } from '@/components/AuthProvider'
```

Inside `useGoals()` function, add:
```typescript
const { user } = useAuthContext()
```

In `createGoal` callback (line 55), change the insert from:
```typescript
.insert([{ ...input, status: 'active' }])
```
to:
```typescript
.insert([{ ...input, status: 'active', user_id: user!.id }])
```

**Step 2: Update useTasks.ts**

Same pattern. Add import and `useAuthContext()` call.

In `createTask` callback (line 61), change:
```typescript
.insert([{ ...input, status: 'active' }])
```
to:
```typescript
.insert([{ ...input, status: 'active', user_id: user!.id }])
```

In `completeTask` callback (lines 103-114), add `user_id` to the archived_tasks insert:
```typescript
.insert([{
  id: task.id,
  title: task.title,
  priority: task.priority,
  due_date: task.due_date,
  category: task.category,
  goal_id: task.goal_id,
  completed_at: new Date().toISOString(),
  original_created_at: task.created_at,
  user_id: user!.id,
}])
```

**Step 3: Verify — no changes needed for useArchive.ts or useSubtasks.ts**

- `useArchive.ts` is read-only (no inserts) — RLS handles SELECT filtering
- `useSubtasks.ts` has no user_id column — RLS policy checks via parent task

**Step 4: Verify build**

```bash
npx tsc --noEmit
```

**Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass. The existing taskHelpers tests don't touch hooks, so no impact.

**Step 6: Commit**

```bash
git add src/hooks/useGoals.ts src/hooks/useTasks.ts
git commit -m "feat(F055): include user_id in goal, task, and archived_task inserts"
```

---

### Task 7: Update claude-features.json + Progress Log

**Files:**
- Modify: `claude-features.json` — add F050-F056 entries with status `"passing"`
- Modify: `claude-progress.txt` — append session 13 summary

**Step 1: Add F050-F056 to claude-features.json**

Add after F049:
```json
{ "id": "F050", "area": "auth", "name": "Schema migration for user_id + RLS", "description": "user_id column on goals, tasks, archived_tasks. RLS policies on all 4 tables.", "status": "passing" },
{ "id": "F051", "area": "auth", "name": "useAuth hook", "description": "Exposes user, loading, signIn(email), signOut. Manages session via supabase.auth.", "status": "passing" },
{ "id": "F052", "area": "auth", "name": "AuthProvider context", "description": "Wraps app in layout.tsx, provides auth state to all children via useAuthContext.", "status": "passing" },
{ "id": "F053", "area": "auth", "name": "Login page", "description": "/login route with email input, magic link flow, success/error states.", "status": "passing" },
{ "id": "F054", "area": "auth", "name": "Auth-guarded layout", "description": "Redirect to /login if no session. Loading spinner during session check.", "status": "passing" },
{ "id": "F055", "area": "auth", "name": "Update hooks with user_id", "description": "createGoal, createTask, completeTask inserts include user_id from auth context.", "status": "passing" },
{ "id": "F056", "area": "auth", "name": "Sign out", "description": "Logout button in sidebar shows email and calls signOut.", "status": "passing" }
```

**Step 2: Append session 13 summary to claude-progress.txt**

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "feat: mark F050-F056 auth features complete (session 13)"
```

---

### Verification Checklist

After all tasks, verify end-to-end:

1. `npx tsc --noEmit` — zero errors
2. `npm test` — all tests pass (existing 16 + new useAuth tests)
3. `npm run build` — static export succeeds (all routes including /login)
4. Dev server: visiting any page without session → redirected to /login
5. Login page: enter email → "Check your email" success state
6. After clicking magic link → redirected to /dashboard, sidebar visible
7. Sign out button → redirected back to /login
8. Supabase dashboard: RLS enabled on all 4 tables

### Supabase Dashboard Setup (manual, not in code)

1. Authentication → Settings → disable "Allow new users to sign up"
2. Authentication → URL Configuration → add redirect URLs (localhost:11001, production URL)
3. Authentication → Users → "Invite user" to add your email
4. SQL Editor → run `supabase/migration-auth-rls.sql`
5. After first login, backfill existing data with your user_id (uncomment lines in migration)
