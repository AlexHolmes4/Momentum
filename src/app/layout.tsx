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

        {/* Sign out button — bottom of sidebar (F056) */}
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
