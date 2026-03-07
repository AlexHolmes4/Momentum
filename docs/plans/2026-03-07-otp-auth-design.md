# OTP Auth Flow — Design Doc
Date: 2026-03-07

## Problem
Current magic link flow opens a new browser tab when the user clicks the email link, breaking the same-tab UX. Switching to a 6-digit OTP code keeps the user in the same tab throughout.

## Solution
Replace magic link with email OTP code flow: user enters email, receives a 6-digit code, enters it in the same tab.

## Supabase Dashboard Change
In Auth > Email Templates > "Magic Link", replace the template body:

```html
<h2>Your Momentum login code</h2>

<p>Enter this code to sign in:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">{{ .Token }}</p>

<p>This code expires in 10 minutes. Do not share it.</p>
```

This causes Supabase to email a plain 6-digit code instead of a clickable link. No other dashboard changes needed.

## Code Changes

### `src/hooks/useAuth.ts`
- Remove `emailRedirectTo` from `signInWithOtp` options
- Add `verifyOtp(email, token)` calling `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- Expose `verifyOtp` from hook return value

### `src/components/AuthProvider.tsx`
- Add `verifyOtp: (email: string, token: string) => Promise<void>` to `AuthContextType`
- Add safe no-op default for static prerender

### `src/components/OtpInput.tsx` (new)
- 6 single-digit `<input>` boxes
- Auto-advances focus on digit entry
- Backspace moves focus to previous box
- Paste fills all boxes at once
- Calls `onChange(code)` when all 6 digits are present
- Styling: `bg-gray-800 border-gray-700`, focused box gets `ring-1 ring-indigo-500`

### `src/app/login/page.tsx`
- Step 1 (email): same UI, on success transitions to step 2 instead of showing "check your email"
- Step 2 (code): renders `<OtpInput>`, auto-submits on 6th digit via `verifyOtp(email, code)`
- Error on invalid/expired code: red banner with "Resend code" link returning to step 1
- Loading state during verification

## UX Flow
```
/login → [enter email] → [submit] → [enter 6-digit code] → authenticated → /dashboard
                                           ↓
                                    [wrong code] → error + resend link
```

## What We're Not Building
- No `@supabase/auth-ui-react` (doesn't support 6-box UX, theming overhead)
- No separate `/login/verify` route (overkill for single-user app)
