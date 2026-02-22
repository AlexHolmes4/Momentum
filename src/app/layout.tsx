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
