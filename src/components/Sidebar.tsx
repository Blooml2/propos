'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Layers, User, Upload, Settings } from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: Layers },
  { href: '/agents', label: 'Agents', icon: User },
  { href: '/import', label: 'Import', icon: Upload },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 bg-gray-950 border-r border-gray-800">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black tracking-tight">E</span>
        </div>
        <span className="text-white text-sm font-semibold tracking-wide">ErickOS</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/'
              ? pathname === '/'
              : pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                active
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
            pathname === '/settings'
              ? 'bg-blue-600/20 text-blue-400 font-medium'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Settings size={15} />
          Settings
        </Link>
        <p className="text-gray-600 text-xs px-3 mt-2">Day 4 Build · v0.4</p>
      </div>
    </aside>
  )
}