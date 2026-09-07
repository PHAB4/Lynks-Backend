'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, ChevronRight, LogOut, Settings, User,
  Loader2, Plus, Trash2, ListChecks, Maximize2,
  CheckCircle2, Circle, MoreVertical, Pin, ArrowUp, ArrowDown,
  ChevronsUp, ChevronsDown,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { profile, resume } from '@/lib/api'
import type { ResumeData } from '@/lib/types'
import { useAuthGate } from '@/lib/use-auth'
import {
  listConversations,
  togglePinConversation,
  deleteConversation,
  reorderConversation,
  type ConversationItem,
} from '@/lib/chat-api'
import { getRoadmap, type Roadmap } from '@/lib/roadmap-api'

export type PanelId = 'chat' | 'steps' | 'resume' | 'roadmap'

const PANEL_ICONS: { id: PanelId; icon: typeof MessageSquare; label: string }[] = [
  { id: 'steps', icon: ListChecks, label: 'Steps' },
  { id: 'roadmap', icon: Map, label: 'Roadmap' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'resume', icon: FileText, label: 'Resume' },
]

const PANEL_ROUTES: Partial<Record<PanelId, string>> = {
  roadmap: '/roadmap',
  steps: '/roadmap',
  chat: '/chat',
  resume: '/resume',
}

type PanelSide = 'left' | 'right'

function getPanelSide(id: PanelId): PanelSide {
  if (id === 'chat' || id === 'roadmap') return 'left'
  return 'right'
}

function sortPanelsBySide(panels: PanelId[]): { left: PanelId[]; right: PanelId[] } {
  const left: PanelId[] = []
  const right: PanelId[] = []
  for (const id of panels) {
    if (getPanelSide(id) === 'left') left.push(id)
    else right.push(id)
  }
  return { left, right }
}

interface NavItem {
  id: string
  icon: typeof Home
  label: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: Home, label: 'Home', href: '/dashboard' },
  { id: 'chat', icon: MessageSquare, label: 'Chat', href: '/chat' },
  { id: 'roadmap', icon: Map, label: 'Roadmap', href: '/roadmap' },
  { id: 'opportunities', icon: Briefcase, label: 'Opportunities', href: '/opportunities' },
  { id: 'resume', icon: FileText, label: 'Resume', href: '/resume' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const authChecked = useAuthGate()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [openPanels, setOpenPanels] = useState<PanelId[]>([])
  const [loadingPanels, setLoadingPanels] = useState<Set<PanelId>>(new Set())
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('lynks_user')
      if (cached) {
        try { return JSON.parse(cached).name || 'User' } catch { /* ignore */ }
      }
    }
    return 'User'
  })

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const conversationsFetched = useRef(false)
  const [openConvMenuId, setOpenConvMenuId] = useState<string | null>(null)
  const convMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: { user: { id: string; email?: string } } | null) => {
      if (session?.user) {
        try {
          const userData = await profile.get()
          const name = userData.name || session.user.email?.split('@')[0] || 'User'
          setUserName(name)
          localStorage.setItem('lynks_user', JSON.stringify({ name }))
        } catch {
          const fallback = session.user.email?.split('@')[0] || 'User'
          setUserName(fallback)
          localStorage.setItem('lynks_user', JSON.stringify({ name: fallback }))
        }
      } else if (event === 'SIGNED_OUT') {
        setUserName('User')
        localStorage.removeItem('lynks_user')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sidebarExpanded && !conversationsFetched.current) {
      loadConversations()
    }
  }, [sidebarExpanded])

  useEffect(() => {
    conversationsFetched.current = false
    if (sidebarExpanded) {
      loadConversations()
    }
  }, [pathname])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const result = await listConversations()
      setConversations(result.conversations || [])
      conversationsFetched.current = true
    } catch { /* ignore */ }
    finally { setLoadingConversations(false) }
  }

  const handleNewChat = () => {
    router.push('/chat')
    setSidebarExpanded(false)
  }

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/chat?conversation=${conversationId}`)
    setSidebarExpanded(false)
  }

  const handleToggleConvPin = async (conversationId: string) => {
    try {
      const result = await togglePinConversation(conversationId)
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === conversationId ? { ...c, is_pinned: result.is_pinned } : c
        ).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
      )
      setOpenConvMenuId(null)
    } catch { /* ignore */ }
  }

  const handleDeleteConv = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId)
      setConversations(prev => prev.filter(c => c.conversation_id !== conversationId))
      setOpenConvMenuId(null)
    } catch { /* ignore */ }
  }

  const handleReorderConv = async (conversationId: string, action: 'top' | 'bottom' | 'up' | 'down') => {
    try {
      const result = await reorderConversation(conversationId, action)
      if (result.conversations) {
        setConversations(prev => {
          const updated = prev.map(c => {
            const match = result.conversations.find(r => r.conversation_id === c.conversation_id)
            return match ? { ...c, is_pinned: match.is_pinned } : c
          })
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
            const aMatch = result.conversations.find(r => r.conversation_id === a.conversation_id)
            const bMatch = result.conversations.find(r => r.conversation_id === b.conversation_id)
            return (aMatch?.sort_order ?? 0) - (bMatch?.sort_order ?? 0)
          })
        })
      }
      setOpenConvMenuId(null)
    } catch { /* ignore */ }
  }

  const initials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  const handleSidebarExpand = useCallback(() => {
    setSidebarExpanded(prev => {
      if (!prev) {
        setOpenPanels(curr => {
          if (curr.length >= 2) return [curr[0]]
          return curr
        })
      }
      return !prev
    })
  }, [])

  const startLoading = useCallback((id: PanelId) => {
    setLoadingPanels(prev => new Set(prev).add(id))
    setTimeout(() => {
      setLoadingPanels(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2000)
  }, [])

  const togglePanel = useCallback((id: PanelId) => {
    const panelRoute = PANEL_ROUTES[id]
    if (panelRoute && pathname.startsWith(panelRoute)) {
      setOpenPanels(prev => {
        if (prev.length <= 1) return []
        return [prev[prev.length - 1]]
      })
      return
    }
    setOpenPanels(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id)
      }
      const side = getPanelSide(id)
      const sameSide = prev.filter(p => getPanelSide(p) === side)
      if (sameSide.length > 0) {
        return prev.map(p => sameSide.includes(p) ? id : p)
      }
      if (prev.length >= 2) {
        const oppSide = side === 'left' ? 'right' : 'left'
        const oppPanel = prev.find(p => getPanelSide(p) === oppSide)
        return oppPanel ? [oppPanel, id] : [prev[0], id]
      }
      return [...prev, id]
    })
    startLoading(id)
    setSidebarExpanded(false)
  }, [startLoading, pathname])

  const closePanel = useCallback((id: PanelId) => {
    setOpenPanels(prev => prev.filter(p => p !== id))
  }, [])

  const expandPanel = useCallback((id: PanelId) => {
    const route = PANEL_ROUTES[id]
    setOpenPanels([])
    if (route) {
      router.push(route)
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('lynks_user')
    router.push('/')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const { left: leftPanels, right: rightPanels } = sortPanelsBySide(openPanels)

  if (!authChecked) return (
    <div className="flex h-screen bg-[#F7F3FE] items-center justify-center">
      <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
    </div>
  )

  const collapsedSidebar = (
    <div className="hidden md:flex flex-col items-center w-[75px] shrink-0 bg-[#F9F5FF] border-r border-[#EDE3FF] py-4 h-screen sticky top-0 z-20">
      <button
        onClick={handleSidebarExpand}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
      >
        <img src="/lynks-chain-link.png" className="h-full w-full object-contain p-0" alt="LYNKS logo" />
      </button>

      <div className="flex flex-col items-center gap-0.5 flex-1 mt-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => { router.push(item.href); setSidebarExpanded(false) }}
            className={cn(
              'flex items-center justify-center w-[48px] h-[48px] rounded-xl transition-all',
              isActive(item.href)
                ? 'bg-[#EADFFF] text-[#6B26EA]'
                : 'text-[rgba(0,0,0,0.40)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
            )}
          >
            <item.icon size={18} strokeWidth={isActive(item.href) ? 2.5 : 1.5} />
          </button>
        ))}
      </div>

     <div className="flex flex-col items-center gap-2 mt-auto">
        <button
          onClick={() => { router.push('/settings'); setSidebarExpanded(false) }}
          className="w-[48px] h-[48px] rounded-full bg-[#EADFFF] flex items-center justify-center hover:bg-[#D4C4F7] transition-colors cursor-pointer"
        >
          <span className="text-[#6B26EA] text-sm font-semibold">{initials}</span>
        </button>
      </div>
    </div>
  )

  const expandedSidebar = (
    <div className="hidden md:flex flex-col w-[305px] shrink-0 bg-[#F9F5FF] border-r border-[#EDE3FF] py-2.5 px-[11px] h-screen sticky top-0 z-20">
      <div className="flex items-center justify-between w-full h-10 mb-2.5 shrink-0">
        <Link href="/dashboard" onClick={() => setSidebarExpanded(false)}>
          <img src="/lynks-full-logo.png" alt="LYNKS" className="h-28 w-auto object-contain" />
        </Link>
        <button
          onClick={handleSidebarExpand}
          className="flex items-center justify-center w-6 h-6 rounded-full border border-[#EDE3FF] bg-white hover:bg-[#F7F3FE] transition-colors"
        >
          <ChevronLeft size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 mt-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => { router.push(item.href); setSidebarExpanded(false) }}
            className={cn(
              'flex items-center gap-[5px] rounded-2xl p-2.5 w-full transition-all',
              isActive(item.href) ? 'text-[#6B26EA] font-medium' : 'text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)]'
            )}
          >
            <item.icon size={14} strokeWidth={isActive(item.href) ? 2.5 : 1.5} />
            <span className="text-[13px]">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="h-px bg-[#EDE3FF] my-3" />

      <div className="flex items-center justify-between px-2.5 mb-1.5 shrink-0">
        <p className="text-[11px] text-[rgba(0,0,0,0.30)] font-semibold uppercase tracking-wider">Conversations</p>
        <button
          onClick={handleNewChat}
          className="flex items-center justify-center w-5 h-5 rounded bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors"
          title="New chat"
        >
          <Plus size={10} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-1">
        {loadingConversations && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="text-[#6B26EA] animate-spin" />
          </div>
        )}
        {!loadingConversations && conversations.length === 0 && (
          <p className="text-[12px] text-[rgba(0,0,0,0.25)] text-center py-4 px-2">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div key={conv.conversation_id} className="relative group">
            <button
              onClick={() => handleSelectConversation(conv.conversation_id)}
              className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)] transition-all truncate"
            >
              <div className="flex items-center gap-1.5 truncate">
                {conv.is_pinned ? (
                  <Pin size={10} className="shrink-0 text-[#6B26EA] fill-current" />
                ) : (
                  <MessageSquare size={10} className="shrink-0 opacity-40" />
                )}
                <span className="truncate">{conv.title || 'New conversation'}</span>
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setOpenConvMenuId(openConvMenuId === conv.conversation_id ? null : conv.conversation_id)
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[rgba(0,0,0,0.06)] transition-all text-[rgba(0,0,0,0.30)] hover:text-[#6B26EA]"
            >
              <MoreVertical size={12} />
            </button>

            {openConvMenuId === conv.conversation_id && (
              <div
                ref={convMenuRef}
                className="absolute right-0 top-6 z-50 bg-white border border-[#EDE3FF] rounded-xl shadow-[0_8px_24px_rgba(107,38,234,0.15)] py-1 min-w-[160px]"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleConvPin(conv.conversation_id) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#0D0026] hover:bg-[#F9F5FF] transition-colors"
                >
                  <Pin size={11} className={conv.is_pinned ? 'fill-current text-[#6B26EA]' : 'text-[#8B898E]'} />
                  {conv.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <div className="mx-2 my-0.5 h-px bg-[#EDE3FF]" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleReorderConv(conv.conversation_id, 'top') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#0D0026] hover:bg-[#F9F5FF] transition-colors"
                >
                  <ChevronsUp size={11} className="text-[#8B898E]" />
                  Move to top
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReorderConv(conv.conversation_id, 'up') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#0D0026] hover:bg-[#F9F5FF] transition-colors"
                >
                  <ArrowUp size={11} className="text-[#8B898E]" />
                  Move up
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReorderConv(conv.conversation_id, 'down') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#0D0026] hover:bg-[#F9F5FF] transition-colors"
                >
                  <ArrowDown size={11} className="text-[#8B898E]" />
                  Move down
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReorderConv(conv.conversation_id, 'bottom') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#0D0026] hover:bg-[#F9F5FF] transition-colors"
                >
                  <ChevronsDown size={11} className="text-[#8B898E]" />
                  Move to bottom
                </button>
                <div className="mx-2 my-0.5 h-px bg-[#EDE3FF]" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.conversation_id) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#D14444] hover:bg-[#FEF2F2] transition-colors"
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-[#EDE3FF] p-3 shrink-0">
        <div className="flex justify-center items-center rounded-full bg-[#EADFFF] w-10 h-10 shrink-0">
          <span className="text-[#6B26EA] text-sm font-semibold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0D0026] truncate">{userName}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/settings" className="relative group flex items-center justify-center w-7 h-7 rounded-lg text-[#A8A8A8] hover:text-[#6B26EA] hover:bg-[#F7F3FE] transition-colors">
            <Settings size={14} />
          </Link>
          <button onClick={handleLogout} className="relative group flex items-center justify-center w-7 h-7 rounded-lg text-[#A8A8A8] hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#F7F3FE] overflow-hidden">
      {!sidebarExpanded && collapsedSidebar}
      {sidebarExpanded && expandedSidebar}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className={cn(
          "hidden md:flex items-center justify-end gap-1 px-4 py-2 border-b border-[#EDE3FF] bg-white shrink-0",
          (pathname === '/dashboard' || pathname === '/settings' || pathname === '/onboarding') && "invisible h-0 border-none py-0 overflow-hidden"
        )}>
          {PANEL_ICONS.filter((item) => {
            const route = PANEL_ROUTES[item.id]
            return !route || !pathname.startsWith(route)
          }).map((item) => {
            const isPanelActive = openPanels.includes(item.id)
            return (
              <button
                key={item.id}
                onClick={() => togglePanel(item.id)}
                className={cn(
                  'flex items-center justify-center w-[36px] h-[36px] rounded-lg transition-all',
                  isPanelActive
                    ? 'bg-[#EADFFF] text-[#6B26EA]'
                    : 'text-[rgba(0,0,0,0.35)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
                )}
                title={item.label}
              >
                <item.icon size={16} strokeWidth={isPanelActive ? 2 : 1.5} />
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {openPanels.length >= 2 ? (
            <>
              {leftPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col flex-1 border-r border-[#EDE3FF] bg-white h-full overflow-hidden min-w-0">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={togglePanel} />}
                  </div>
                </div>
              ))}
              {rightPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col flex-1 border-l border-[#EDE3FF] bg-white h-full overflow-hidden min-w-0">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={togglePanel} />}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {leftPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col w-[420px] shrink-0 border-r border-[#EDE3FF] bg-white h-full overflow-hidden">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={togglePanel} />}
                  </div>
                </div>
              ))}
              <div className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
                {children}
              </div>
              {rightPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col w-[420px] shrink-0 border-l border-[#EDE3FF] bg-white h-full overflow-hidden">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={togglePanel} />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-[#EDE3FF] px-2 py-2">
        {PANEL_ICONS.filter((item) => {
          const route = PANEL_ROUTES[item.id]
          return !route || !pathname.startsWith(route)
        }).map((item) => {
          const isPanelActive = openPanels.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => togglePanel(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors min-w-[48px]',
                isPanelActive ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)]'
              )}
            >
              <item.icon size={18} strokeWidth={isPanelActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
        <Link
          href="/settings"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors min-w-[48px]',
            pathname === '/settings' ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)]'
          )}
        >
          <Settings size={18} strokeWidth={pathname === '/settings' ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </nav>
    </div>
  )
}

function PanelHeader({ panelId, onClose, onExpand }: { panelId: PanelId; onClose: () => void; onExpand: () => void }) {
  const titles: Record<PanelId, string> = {
    chat: 'Chat with LYNKS',
    steps: 'Steps',
    resume: 'Resume',
    roadmap: 'Roadmap',
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE3FF] shrink-0">
      <p className="text-[13px] font-semibold text-[#0D0026]">{titles[panelId]}</p>
      <div className="flex items-center gap-1">
        {PANEL_ROUTES[panelId] && (
          <button
            onClick={onExpand}
            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#F7F3FE] transition-colors text-[#A8A8A8] hover:text-[#6B26EA]"
            title="Expand to full page"
          >
            <Maximize2 size={13} />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#F7F3FE] transition-colors text-[#A8A8A8] hover:text-[#0D0026]"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function PanelContent({ panelId, openPanel }: { panelId: PanelId; openPanel?: (id: PanelId) => void }) {
  switch (panelId) {
    case 'chat':
      return <ChatPanel />
    case 'steps':
      return <StepsPanel />
    case 'resume':
      return <ResumePanel />
    case 'roadmap':
      return <RoadmapPanel />
    default:
      return null
  }
}

function LoadingPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <Loader2 size={24} className="text-[#6B26EA] animate-spin mb-3" />
      <p className="text-[13px] text-[#8B898E]">Generating content...</p>
    </div>
  )
}

function ChatPanel() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; time: string }>>([])

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const handleSend = () => {
    if (!message.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: message, time: formatTime() }])
    setMessage('')
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: "I'm analyzing your request. LYNKS will have a response ready soon.", time: formatTime() }])
    }, 1000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-[13px] text-[#8B898E]">Ask LYNKS anything about your career journey.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'rounded-2xl px-3 py-2 text-[13px] max-w-[85%]',
                  msg.role === 'user' ? 'bg-[#6B26EA] text-white' : 'bg-[#F7F3FE] text-[#1E1E1E]'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-[#EDE3FF]">
        <div className="flex items-center gap-2 rounded-xl border border-[#EDE3FF] bg-[#F9F5FF] px-3 py-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-[13px] text-[#0D0026] placeholder:text-[rgba(0,0,0,0.31)] focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 shrink-0"
          >
            <MessageSquare size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function StepsPanel() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getRoadmap()
      .then((data) => { if (!cancelled) setRoadmap(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load steps') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (roadmap?.steps && roadmap.steps.length > 0 && !activeStep) {
      const sorted = [...roadmap.steps].sort((a, b) => a.order - b.order)
      const inProgress = sorted.find(s => s.status === 'pending' && s.tasks?.some(t => t.status === 'pending'))
      setActiveStep(inProgress?.step_id || sorted[0].step_id)
    }
  }, [roadmap, activeStep])

  const sortedSteps = roadmap?.steps ? [...roadmap.steps].sort((a, b) => a.order - b.order) : []
  const allTasks = sortedSteps.flatMap(s => s.tasks || [])
  const completedTasks = allTasks.filter(t => t.status === 'complete').length
  const totalTasks = allTasks.length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <Loader2 size={20} className="text-[#6B26EA] animate-spin mb-2" />
        <p className="text-[12px] text-[#8B898E]">Loading steps...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-[12px] text-[#D14444] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">{error}</p>
      </div>
    )
  }

  if (!roadmap || sortedSteps.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-3">
            <ListChecks size={18} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] text-[#8B898E]">No steps yet. Generate a roadmap first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#EDE3FF] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-[#0D0026]">Steps</h3>
          <span className="text-[11px] font-bold text-[#6B26EA] bg-[#EADFFF] px-2.5 py-0.5 rounded-full">
            {completedTasks}/{totalTasks} DONE
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#EDE3FF] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#6B26EA] transition-all duration-500"
            style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sortedSteps.map((step, index) => {
          const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
          const totalCount = step.tasks?.length || 0
          const allComplete = totalCount > 0 && completedCount === totalCount
          const isActive = activeStep === step.step_id

          return (
            <div key={step.step_id}>
              <button
                onClick={() => setActiveStep(isActive ? null : step.step_id)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all',
                  isActive ? 'bg-[#F7F3FE]' : 'hover:bg-[#FAFAFA]'
                )}
              >
                <span className={cn(
                  'text-[12px] font-semibold w-5 shrink-0',
                  allComplete ? 'text-[#22C55E]' : isActive ? 'text-[#6B26EA]' : 'text-[#8B898E]'
                )}>
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-[12px] font-semibold',
                    allComplete ? 'text-[#22C55E]' : 'text-[#0D0026]'
                  )}>
                    {step.title}
                  </p>
                </div>
                {allComplete && (
                  <CheckCircle2 size={13} className="text-[#22C55E] shrink-0" />
                )}
              </button>

              {isActive && (
                <div className="ml-4 mt-1 mb-2 space-y-1 pl-3 border-l-2 border-[#EDE3FF]">
                  {step.tasks
                    ?.sort((a, b) => a.order - b.order)
                    .map((task) => (
                      <div
                        key={task.task_id}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-lg',
                          task.status === 'complete' ? 'bg-[#F0FDF4]' : 'bg-[#FAFAFA]'
                        )}
                      >
                        {task.status === 'complete' ? (
                          <CheckCircle2 size={12} className="text-[#22C55E] shrink-0 mt-0.5" />
                        ) : (
                          <Circle size={12} className="text-[#D1D5DB] shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-[11px] font-medium leading-snug',
                            task.status === 'complete' ? 'text-[#8B898E] line-through' : 'text-[#0D0026]'
                          )}>
                            {task.title}
                          </p>
                          <p className="text-[10px] text-[#8B898E] mt-0.5 leading-snug">
                            {task.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  {(!step.tasks || step.tasks.length === 0) && (
                    <p className="text-[11px] text-[#8B898E] py-1.5">No tasks yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResumePanel() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resume.get()
      .then(data => {
        if (data?.content) setResumeData(data.content as ResumeData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hasContent = resumeData && (
    resumeData.name || resumeData.education?.length || resumeData.experience?.length || resumeData.skills?.length
  )

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="bg-[#F9F5FF] rounded-2xl border border-[#EDE3FF] p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center">
            <User size={14} className="text-[#6B26EA]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0D0026]">{resumeData?.name || 'Resume'}</p>
            <p className="text-[10px] text-[#8B898E]">{resumeData?.email || ''}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="text-[#6B26EA] animate-spin" />
          </div>
        ) : hasContent ? (
          <div className="space-y-2.5" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Objective */}
            {resumeData?.objective && (
              <p className="text-[10px] text-[#4A3572] leading-relaxed line-clamp-2 italic">
                {resumeData.objective}
              </p>
            )}

            {/* Education */}
            {resumeData?.education?.length > 0 && (
              <div>
                <h4 className="text-[9px] font-bold text-[rgba(0,0,0,0.45)] tracking-widest mb-1">EDUCATION</h4>
                {resumeData.education.slice(0, 2).map((edu, i) => (
                  <p key={i} className="text-[10px] text-[#4A3572] leading-snug">
                    <span className="font-semibold">{edu.institution}</span>
                    {edu.level && <span className="text-[#8B898E]"> — {edu.level}</span>}
                  </p>
                ))}
              </div>
            )}

            {/* Experience */}
            {resumeData?.experience?.length > 0 && (
              <div>
                <h4 className="text-[9px] font-bold text-[rgba(0,0,0,0.45)] tracking-widest mb-1">EXPERIENCE</h4>
                {resumeData.experience.slice(0, 3).map((exp, i) => (
                  <p key={i} className="text-[10px] text-[#4A3572] leading-snug">
                    <span className="font-semibold">{exp.title}</span>
                    {exp.organization && <span className="text-[#8B898E]"> at {exp.organization}</span>}
                  </p>
                ))}
              </div>
            )}

            {/* Skills */}
            {resumeData?.skills?.length > 0 && (
              <div>
                <h4 className="text-[9px] font-bold text-[rgba(0,0,0,0.45)] tracking-widest mb-1">SKILLS</h4>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(resumeData.skills) ? resumeData.skills : String(resumeData.skills).split(',').map(s => s.trim())).slice(0, 8).map((skill, i) => (
                    <span key={i} className="text-[9px] bg-white border border-[#EDE3FF] text-[#6B26EA] px-1.5 py-0.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                  {(Array.isArray(resumeData.skills) ? resumeData.skills : String(resumeData.skills).split(',')).length > 8 && (
                    <span className="text-[9px] text-[#8B898E] py-0.5">+{(Array.isArray(resumeData.skills) ? resumeData.skills : String(resumeData.skills).split(',')).length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Certifications */}
            {resumeData?.certifications?.length > 0 && (
              <div>
                <h4 className="text-[9px] font-bold text-[rgba(0,0,0,0.45)] tracking-widest mb-1">CERTIFICATIONS</h4>
                {resumeData.certifications.slice(0, 3).map((cert, i) => (
                  <p key={i} className="text-[10px] text-[#4A3572] leading-snug">• {cert}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-[#A8A8A8]">No resume yet. Complete your profile and generate one.</p>
        )}
      </div>

      <Link
        href="/resume"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#6B26EA] text-[12px] font-semibold text-white hover:bg-[#5A1FD0] transition-colors"
      >
        View & Edit Resume
      </Link>
    </div>
  )
}

function RoadmapPanel() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getRoadmap()
      .then((data) => { if (!cancelled) setRoadmap(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load roadmap') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const sortedSteps = roadmap?.steps ? [...roadmap.steps].sort((a, b) => a.order - b.order) : []
  const allTasks = sortedSteps.flatMap(s => s.tasks || [])
  const completedTasks = allTasks.filter(t => t.status === 'complete').length
  const totalTasks = allTasks.length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <Loader2 size={20} className="text-[#6B26EA] animate-spin mb-2" />
        <p className="text-[12px] text-[#8B898E]">Loading roadmap...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-[12px] text-[#D14444] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">{error}</p>
      </div>
    )
  }

  if (!roadmap || sortedSteps.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-3">
            <Map size={18} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] text-[#8B898E]">No roadmap yet. Ask LYNKS to generate one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#EDE3FF] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-[#0D0026]">Roadmap</h3>
          <span className="text-[11px] font-bold text-[#6B26EA] bg-[#EADFFF] px-2.5 py-0.5 rounded-full">
            {completedTasks}/{totalTasks} DONE
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#EDE3FF] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#6B26EA] transition-all duration-500"
            style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sortedSteps.map((step, index) => {
          const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
          const totalCount = step.tasks?.length || 0
          const allComplete = totalCount > 0 && completedCount === totalCount
          const isExpanded = expandedStep === step.step_id

          return (
            <div key={step.step_id}>
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.step_id)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all',
                  isExpanded ? 'bg-[#F7F3FE]' : 'hover:bg-[#FAFAFA]'
                )}
              >
                <span className={cn(
                  'text-[12px] font-semibold w-5 shrink-0',
                  allComplete ? 'text-[#22C55E]' : isExpanded ? 'text-[#6B26EA]' : 'text-[#8B898E]'
                )}>
                  {index + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-[12px] font-semibold truncate',
                    allComplete ? 'text-[#22C55E]' : 'text-[#0D0026]'
                  )}>
                    {step.title}
                  </p>
                  {!isExpanded && totalCount > 0 && (
                    <p className="text-[10px] text-[#8B898E] mt-0.5">
                      {completedCount}/{totalCount} tasks
                    </p>
                  )}
                </div>
                {allComplete && (
                  <CheckCircle2 size={13} className="text-[#22C55E] shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 mt-1 mb-2 space-y-1 pl-3 border-l-2 border-[#EDE3FF]">
                  {step.tasks
                    ?.sort((a, b) => a.order - b.order)
                    .map((task) => (
                      <div
                        key={task.task_id}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-lg',
                          task.status === 'complete' ? 'bg-[#F0FDF4]' : 'bg-[#FAFAFA]'
                        )}
                      >
                        {task.status === 'complete' ? (
                          <CheckCircle2 size={12} className="text-[#22C55E] shrink-0 mt-0.5" />
                        ) : (
                          <Circle size={12} className="text-[#D1D5DB] shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-[11px] font-medium leading-snug',
                            task.status === 'complete' ? 'text-[#8B898E] line-through' : 'text-[#0D0026]'
                          )}>
                            {task.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  {(!step.tasks || step.tasks.length === 0) && (
                    <p className="text-[11px] text-[#8B898E] py-1.5">No tasks yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
