'use client'

import { useState, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText, Settings,
  ChevronLeft, ChevronRight, Clock, Folder, LogOut
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

const PROJECTS = [
  { name: 'Resume Review & Alignment', active: true },
  { name: 'Spotify Match Rate Deep Dive', active: false },
]

const PREVIOUS = [
  'Interview Prep: Amazon Case Study',
  'Career Roadmap Planning',
  'Salary Negotiation Tips',
  'Portfolio Layout Feedback',
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex min-h-screen bg-background">
        <aside className={cn(
          'flex flex-col border-r border-[#EDE3FF] bg-[#F9F5FF] transition-all duration-300 shrink-0 h-screen sticky top-0',
          collapsed ? 'w-[72px] items-center py-2.5 px-[11px]' : 'w-[305px] py-2.5 px-[11px]'
        )}>
          <div className={cn('flex items-center gap-[180px] shrink-0 w-full h-10 mb-2.5', collapsed && 'justify-center gap-0')}>
            {!collapsed ? (
              <Link href="/dashboard" className="flex items-center">
                <svg width="62" height="17" viewBox="0 0 38 15" fill="none"><text x="0" y="13" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700" fill="#1E1E1E">LYNKS</text></svg>
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
                  isActive ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)]'
                )}>
                  <item.icon size={14} strokeWidth={isActive ? 2.5 : 1.5} />
                  {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-y-auto mt-6">
              <p className="text-[13px] font-semibold text-[#0D0026] mb-3 px-1">Projects</p>
              {PROJECTS.map((p, i) => (
                <div key={i} className={cn('flex items-center gap-[10px] p-3 rounded-2xl mb-1 cursor-pointer transition-colors', p.active ? 'bg-[#F7F3FE]' : 'hover:bg-[rgba(0,0,0,0.03)]')}>
                  <Folder size={14} className={p.active ? 'text-[#6B26EA]' : 'text-[#A8A8A8]'} strokeWidth={2} />
                  <p className={cn('text-[13px] truncate', p.active ? 'text-[#6B26EA] font-medium' : 'text-[#0D0026]')}>{p.name}</p>
                </div>
              ))}
              <p className="text-[11px] font-bold text-[rgba(0,0,0,0.50)] tracking-widest mt-6 mb-3 px-1">PREVIOUSLY</p>
              {PREVIOUS.map((p, i) => (
                <div key={i} className="flex items-center gap-[10px] p-3 rounded-2xl cursor-pointer hover:bg-[rgba(0,0,0,0.03)] transition-colors">
                  <Clock size={14} className="text-[rgba(0,0,0,0.50)]" strokeWidth={2} />
                  <p className="text-[13px] text-[#0D0026] truncate">{p}</p>
                </div>
              ))}
            </div>
          )}
          <div className={cn('flex items-center gap-3 border-t border-[#EDE3FF] p-3 shrink-0 mt-auto', collapsed && 'justify-center')}>
            <button className="shrink-0 flex justify-center items-center rounded-full bg-[#EADFFF] w-10 h-10">
              <span className="text-[#6B26EA] text-sm font-semibold">JD</span>
            </button>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <p className="text-[13px] font-semibold text-[#0D0026] truncate">John Doe</p>
                <p className="text-[11px] text-[rgba(0,0,0,0.50)]">Premium Member</p>
              </div>
            )}
          </div>
        </aside>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="absolute top-4 left-[62px] z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-[#EDE3FF] shadow-sm hover:bg-[#F7F3FE] transition-colors">
            <ChevronRight size={12} />
          </button>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </SidebarContext.Provider>
  )
}