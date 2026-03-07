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
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await verifyOtp(email.trim(), code)
      // AuthGate redirects to /dashboard on auth state change
    } catch {
      setError('Invalid or expired code. Please try again.')
    } finally {
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
            <p className="text-sm text-gray-400 mb-1">Enter the 8-digit code sent to</p>
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
