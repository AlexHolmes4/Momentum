'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/login' || pathname === '/login/'

  useEffect(() => {
    if (loading) return
    if (!user && !isLoginPage) {
      router.replace('/login')
    }
    if (user && isLoginPage) {
      router.replace('/dashboard')
    }
  }, [user, loading, isLoginPage, router])

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
  if (!user && !isLoginPage) {
    return null
  }

  return <>{children}</>
}
