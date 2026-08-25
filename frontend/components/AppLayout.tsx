'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, ChevronRight, LogOut, Settings
} from 'lucide-react'
import { cn } from '@/lib/cn'

const SidebarContext = createContext({ collapsed: false, setCollapsed: (v: boolean) => {} })
export function useSidebar() { return useContext(SidebarContext) }

const NAV_ITEMS = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Briefcase, label: 'Opportunities', href: '/opportunities' },
  { icon: MessageSquare, label: 'Chat', href: '/chat' },
  { icon: Map, label: 'Roadmap', href: '/roadmap' },
  { icon: FileText, label: 'Resume', href: '/resume' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('User')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lynks_user')
      if (raw) {
        const user = JSON.parse(raw)
        if (user.name) setUserName(user.name)
        else if (user.email) setUserName(user.email.split('@')[0])
      }
    } catch {}
  }, [])

  const initials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const handleLogout = () => {
    localStorage.removeItem('lynks_user')
    router.push('/')
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex min-h-screen bg-[#F7F3FE]">
        <aside className={cn(
          'hidden md:flex flex-col border-r border-[#EDE3FF] bg-[#F9F5FF] transition-all duration-300 shrink-0 h-screen sticky top-0',
          collapsed ? 'w-[72px] items-center py-2.5 px-[11px]' : 'w-[305px] py-2.5 px-[11px]'
        )}>
          <div className={cn('flex items-center shrink-0 w-full h-10 mb-2.5', collapsed ? 'justify-center' : 'justify-between px-0')}>
            {!collapsed ? (
              <Link href="/dashboard" className="flex items-center">
                <span className="text-[#0D0026] text-xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>LYNKS</span>
              </Link>
            ) : (
              <Link href="/dashboard" className="flex justify-center w-full">
                <div className="w-10 h-10 rounded-2xl bg-[#EADFFF] flex items-center justify-center">
                  <span className="text-[#6B26EA] font-bold text-sm">L</span>
                </div>
              </Link>
            )}
            {!collapsed && (
              <button onClick={() => setCollapsed(true)} className="flex items-center justify-center w-6 h-6 rounded-full border border-[#EDE3FF] bg-white hover:bg-[#F7F3FE] transition-colors shrink-0">
                <ChevronLeft size={12} />
              </button>
            )}
          </div>
          <div className={cn('flex flex-col gap-1', collapsed ? 'items-center mt-2' : 'mt-1')}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className={cn(
                  'flex items-center gap-[5px] rounded-2xl transition-all',
                  collapsed ? 'justify-center p-2.5 w-[48px]' : 'p-2.5 w-full',
                  isActive ? 'text-[#6B26EA] font-medium' : 'text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)]'
                )}>
                  <item.icon size={14} strokeWidth={isActive ? 2.5 : 1.5} />
                  {!collapsed && <span className="text-[13px]">{item.label}</span>}
                </Link>
              )
            })}
          </div>
          {!collapsed && (
            <div className="flex-1" />
          )}
          <div className={cn('flex items-center gap-3 border-t border-[#EDE3FF] p-3 shrink-0 mt-auto', collapsed && 'justify-center')}>
            <button className="shrink-0 flex justify-center items-center rounded-full bg-[#EADFFF] w-10 h-10">
              <span className="text-[#6B26EA] text-sm font-semibold">{initials}</span>
            </button>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#0D0026] truncate">{userName}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1">
                <Link href="/settings" className="relative group flex items-center justify-center w-7 h-7 rounded-lg text-[#A8A8A8] hover:text-[#6B26EA] hover:bg-[#F7F3FE] transition-colors">
                  <Settings size={14} />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#0D0026] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Settings</span>
                </Link>
                <button onClick={handleLogout} className="relative group flex items-center justify-center w-7 h-7 rounded-lg text-[#A8A8A8] hover:text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={14} />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-[#0D0026] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="hidden md:flex absolute top-4 left-[62px] z-10 items-center justify-center w-6 h-6 rounded-full bg-white border border-[#EDE3FF] shadow-sm hover:bg-[#F7F3FE] transition-colors">
            <ChevronRight size={12} />
          </button>
        )}

        <main className="flex-1 overflow-hidden pb-16 md:pb-0">{children}</main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-[#EDE3FF] px-2 py-2 safe-area-pb">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors min-w-[48px]',
                isActive ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)]'
              )}>
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </SidebarContext.Provider>
  )
}
