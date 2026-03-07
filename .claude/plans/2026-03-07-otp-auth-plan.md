# OTP Auth Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace magic link auth with a two-step same-tab OTP code flow (email → 6-digit code entry).

**Architecture:** `useAuth` hook adds `verifyOtp`; `OtpInput` component handles 6-box digit entry with auto-advance/paste; `login/page.tsx` becomes a two-step form. Supabase dashboard template change (documented in Task 0) is required before the flow works end-to-end.

**Tech Stack:** Next.js 16 static export, React 19, Supabase JS client (`@supabase/ssr`), Vitest + @testing-library/react.

---

### Task 0: Supabase Dashboard — Update Email Template

**No code change. Manual step required before testing end-to-end.**

1. Open Supabase dashboard → your project → **Auth > Email Templates**
2. Select the **"Magic Link"** template
3. Replace the entire body with:

```html
<h2>Your Momentum login code</h2>

<p>Enter this code to sign in:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">{{ .Token }}</p>

<p>This code expires in 10 minutes. Do not share it.</p>
```

4. Save. Supabase will now email a 6-digit code instead of a clickable link.

> No commit needed. Proceed to Task 1.

---

### Task 1: Update `useAuth.ts` — fix signIn + add verifyOtp

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/hooks/__tests__/useAuth.test.ts`

#### Context
The existing test at line 66 already expects `signInWithOtp` to be called with `{ email }` only (no `emailRedirectTo`). That test is currently **failing**. We fix the implementation and add tests for `verifyOtp`.

**Step 1: Run the existing failing test to confirm red state**

```bash
npx vitest run src/hooks/__tests__/useAuth.test.ts
```

Expected: 1 failing test (`signIn calls signInWithOtp with email`).

**Step 2: Add `mockVerifyOtp` to the test file**

At the top of `src/hooks/__tests__/useAuth.test.ts`, update the `vi.hoisted` block (lines 3–11) to add `mockVerifyOtp`:

```ts
const { mockGetSession, mockOnAuthStateChange, mockSignInWithOtp, mockSignOut, mockVerifyOtp } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockSignInWithOtp: vi.fn(),
    mockSignOut: vi.fn(),
    mockVerifyOtp: vi.fn(),
  }))
```

Update the `vi.mock` factory (lines 13–22) to add `verifyOtp`:

```ts
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOtp: mockSignInWithOtp,
      signOut: mockSignOut,
      verifyOtp: mockVerifyOtp,
    },
  },
}))
```

**Step 3: Add two tests for `verifyOtp` at the end of the `describe` block**

```ts
it('verifyOtp calls supabase verifyOtp with email, token, and type email', async () => {
  mockVerifyOtp.mockResolvedValue({ data: {}, error: null })
  const { result } = renderHook(() => useAuth())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => {
    await result.current.verifyOtp('test@example.com', '123456')
  })
  expect(mockVerifyOtp).toHaveBeenCalledWith({
    email: 'test@example.com',
    token: '123456',
    type: 'email',
  })
})

it('verifyOtp throws on error', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: null,
    error: { message: 'Token has expired or is invalid' },
  })
  const { result } = renderHook(() => useAuth())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await expect(
    act(async () => {
      await result.current.verifyOtp('test@example.com', '000000')
    })
  ).rejects.toThrow('Token has expired or is invalid')
})
```

**Step 4: Run tests to confirm new tests fail**

```bash
npx vitest run src/hooks/__tests__/useAuth.test.ts
```

Expected: 3 failing tests (signIn + 2 new verifyOtp tests).

**Step 5: Update `src/hooks/useAuth.ts`**

Replace the `signIn` callback (lines 28–34) and add `verifyOtp`. Full updated hook:

```ts
'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

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

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  return { user, loading, signIn, verifyOtp, signOut }
}
```

**Step 6: Run tests to confirm all pass**

```bash
npx vitest run src/hooks/__tests__/useAuth.test.ts
```

Expected: 8 passing, 0 failing.

**Step 7: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/__tests__/useAuth.test.ts
git commit -m "feat: add verifyOtp to useAuth, remove emailRedirectTo from signIn"
```

---

### Task 2: Update `AuthProvider.tsx` — add verifyOtp to context

**Files:**
- Modify: `src/components/AuthProvider.tsx`

No test needed — this is a thin wrapper that forwards the hook return value.

**Step 1: Update the context type and default**

Replace the entire file content:

```ts
'use client'
import { createContext, useContext } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
}

const defaultContext: AuthContextType = {
  user: null,
  loading: true,
  signIn: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
}

const AuthContext = createContext<AuthContextType>(defaultContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  return useContext(AuthContext)
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/AuthProvider.tsx
git commit -m "feat: add verifyOtp to AuthProvider context"
```

---

### Task 3: Create `OtpInput.tsx` component

**Files:**
- Create: `src/components/OtpInput.tsx`
- Create: `src/components/__tests__/OtpInput.test.tsx`

**Step 1: Write the failing tests first**

Create `src/components/__tests__/OtpInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OtpInput from '../OtpInput'

describe('OtpInput', () => {
  it('renders 6 input boxes', () => {
    render(<OtpInput onChange={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
  })

  it('calls onChange with full code when all 6 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('does not call onChange when fewer than 6 digits are entered', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fills all boxes from a pasted 6-digit code and calls onChange', () => {
    const onChange = vi.fn()
    render(<OtpInput onChange={onChange} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '654321' },
    })
    expect(onChange).toHaveBeenCalledWith('654321')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/__tests__/OtpInput.test.tsx
```

Expected: all 4 tests fail (module not found).

**Step 3: Implement `OtpInput.tsx`**

Create `src/components/OtpInput.tsx`:

```tsx
'use client'
import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'

type Props = {
  onChange: (code: string) => void
  disabled?: boolean
}

export default function OtpInput({ onChange, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = useRef<string[]>(Array(6).fill(''))

  function notify() {
    const code = digits.current.join('')
    if (code.length === 6) onChange(code)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    digits.current[index] = val
    e.target.value = val
    if (val && index < 5) refs.current[index + 1]?.focus()
    notify()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      digits.current[index - 1] = ''
      refs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    pasted.split('').forEach((char, i) => {
      digits.current[i] = char
      if (refs.current[i]) refs.current[i]!.value = char
    })
    refs.current[Math.min(pasted.length, 5)]?.focus()
    notify()
  }

  const boxClass =
    'w-11 h-14 text-center text-xl font-bold text-white bg-gray-800 border border-gray-700 rounded-lg ' +
    'focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50'

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className={boxClass}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/__tests__/OtpInput.test.tsx
```

Expected: all 4 passing.

**Step 5: Commit**

```bash
git add src/components/OtpInput.tsx src/components/__tests__/OtpInput.test.tsx
git commit -m "feat: add OtpInput component with 6-box auto-advance and paste support"
```

---

### Task 4: Update `login/page.tsx` — two-step flow

**Files:**
- Modify: `src/app/login/page.tsx`

No automated test — verify manually at http://localhost:11001.

**Step 1: Replace `login/page.tsx` with the two-step implementation**

```tsx
'use client'
import { useState, FormEvent } from 'react'
import { useAuthContext } from '@/components/AuthProvider'
import OtpInput from '@/components/OtpInput'

type Step = 'email' | 'code'

export default function LoginPage() {
  const { signIn, verifyOtp } = useAuthContext()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      await signIn(email.trim())
      setStep('code')
    } catch {
      setError('Unable to send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeComplete(code: string) {
    setLoading(true)
    setError(null)
    try {
      await verifyOtp(email.trim(), code)
      // AuthGate will redirect to /dashboard on auth state change
    } catch {
      setError('Invalid or expired code. Please try again.')
      setLoading(false)
    }
  }

  function handleResend() {
    setStep('email')
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Momentum</h1>

        {step === 'email' ? (
          <>
            <p className="text-sm text-gray-400 mb-6">Sign in with a one-time code</p>
            <form onSubmit={handleEmailSubmit}>
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
                disabled={loading || !email.trim()}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-1">Enter the 6-digit code sent to</p>
            <p className="text-sm text-white font-medium mb-6">{email}</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="mb-6">
              <OtpInput onChange={handleCodeComplete} disabled={loading} />
            </div>

            {loading && (
              <p className="text-center text-sm text-gray-400 mb-4">Verifying...</p>
            )}

            <button
              onClick={handleResend}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Resend code or use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests passing.

**Step 4: Manual test at http://localhost:11001**

1. Run `npm run dev` (or use existing dev server)
2. Navigate to http://localhost:11001/login
3. Enter your email → click "Send code"
4. Check email for 6-digit code
5. Enter code in the 6 boxes — should auto-advance and auto-submit on 6th digit
6. Confirm redirect to /dashboard
7. Test paste: copy the 6-digit code, paste into first box — should fill all 6 and submit
8. Test invalid code: enter `000000` → confirm red error message appears
9. Test resend: click "Resend code" → confirm returns to email step

**Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: two-step OTP login flow with 6-box code entry"
```

---

### Task 5: Final verification + branch PR

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests passing.

**Step 2: Build to confirm static export works**

```bash
npm run build
```

Expected: `out/` directory generated, no errors.

**Step 3: Push branch and open PR**

```bash
git push origin HEAD
```

Then open a PR from the current branch into `develop` via GitHub.
