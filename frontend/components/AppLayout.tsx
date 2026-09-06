'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, ChevronRight, LogOut, Settings, User,
  Loader2, Plus, Trash2, ListChecks, Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { useAuthGate } from '@/lib/use-auth'
import {
  listConversations,
  deleteChatHistory,
  type ConversationItem,
} from '@/lib/chat-api'

export type PanelId = 'chat' | 'steps' | 'resume' | 'roadmap'

const PANEL_ICONS: { id: PanelId; icon: typeof MessageSquare; label: string }[] = [
  { id: 'steps', icon: ListChecks, label: 'Steps' },
  { id: 'roadmap', icon: Map, label: 'Roadmap' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'resume', icon: FileText, label: 'Resume' },
]

const PANEL_ROUTES: Partial<Record<PanelId, string>> = {
  roadmap: '/roadmap',
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: { user: { id: string; email?: string } } | null) => {
      if (session?.user) {
        try {
          const { data } = await supabase.from('users').select('name').eq('id', session.user.id).single()
          const name = data?.name || session.user.email?.split('@')[0] || 'User'
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

  const handleClearConversations = async () => {
    try {
      await deleteChatHistory()
      setConversations([])
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
          className="flex items-center justify-center w-[48px] h-[48px] rounded-xl text-[rgba(0,0,0,0.40)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA] transition-colors"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
        <div className="w-[48px] h-[48px] rounded-full bg-[#EADFFF] flex items-center justify-center">
          <span className="text-[#6B26EA] text-sm font-semibold">{initials}</span>
        </div>
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
        <div className="flex items-center gap-1">
          {conversations.length > 0 && (
            <button
              onClick={handleClearConversations}
              className="flex items-center justify-center w-5 h-5 rounded text-[rgba(0,0,0,0.25)] hover:text-[#D14444] transition-colors"
              title="Clear all"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center w-5 h-5 rounded bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors"
            title="New chat"
          >
            <Plus size={10} />
          </button>
        </div>
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
          <button
            key={conv.conversation_id}
            onClick={() => handleSelectConversation(conv.conversation_id)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)] transition-all truncate"
          >
            <div className="flex items-center gap-1.5 truncate">
              <MessageSquare size={10} className="shrink-0 opacity-40" />
              <span className="truncate">{conv.title || 'New conversation'}</span>
            </div>
          </button>
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
          {PANEL_ICONS.map((item) => {
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
        {PANEL_ICONS.map((item) => {
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
      return <ResumePanel openPanel={openPanel} />
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
  return (
    <div className="p-4">
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-3">
          <ListChecks size={18} className="text-[#D1D5DB]" />
        </div>
        <p className="text-[13px] text-[#8B898E]">Steps will appear here once your roadmap is generated.</p>
      </div>
    </div>
  )
}

function ResumePanel({ openPanel }: { openPanel?: (id: PanelId) => void }) {
  return (
    <div className="p-4">
      <div className="bg-[#F9F5FF] rounded-2xl border border-[#EDE3FF] p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#EADFFF] flex items-center justify-center">
            <User size={16} className="text-[#6B26EA]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0D0026]">Your Resume</p>
            <p className="text-[11px] text-[#8B898E]">AI-generated resume</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-1">EXPERIENCE</h4>
            <p className="text-[11px] text-[#A8A8A8]">Complete tasks on your roadmap to build your resume.</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-1">EDUCATION</h4>
            <p className="text-[11px] text-[#A8A8A8]">Add during onboarding.</p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-1">SKILLS</h4>
            <p className="text-[11px] text-[#A8A8A8]">AI will suggest skills based on your career journey.</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <button className="w-full py-2.5 rounded-xl border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] text-[12px] font-medium text-[#000] hover:bg-[#D4C4F7] transition-colors">
          Word
        </button>
        <button className="w-full py-2.5 rounded-xl bg-[#6B26EA] text-[12px] font-semibold text-white hover:bg-[#5A1FD0] transition-colors">
          PDF
        </button>
        <button
          onClick={() => {
            if (openPanel) openPanel('chat')
          }}
          className="w-full py-2.5 rounded-xl border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] text-[12px] font-medium text-[#000] hover:bg-[#D4C4F7] transition-colors"
        >
          Edit resume
        </button>
      </div>
    </div>
  )
}

function RoadmapPanel() {
  return (
    <div className="p-4">
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-3">
          <Map size={18} className="text-[#D1D5DB]" />
        </div>
        <p className="text-[13px] text-[#8B898E]">Your roadmap will appear here once generated by LYNKS AI.</p>
      </div>
    </div>
  )
}
