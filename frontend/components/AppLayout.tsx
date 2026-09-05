'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, ChevronRight, LogOut, Settings, User,
  ListChecks, Loader2, Maximize2, Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import {
  sendMessage,
  listConversations,
  getConversationMessages,
  deleteChatHistory,
  type ChatMessage,
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

export type PanelSide = 'left' | 'right'

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('users').select('name').eq('id', session.user.id).single()
        const name = data?.name || session.user.email?.split('@')[0] || 'User'
        setUserName(name)
        localStorage.setItem('lynks_user', JSON.stringify({ name }))
      } else if (event === 'SIGNED_OUT') {
        setUserName('User')
        localStorage.removeItem('lynks_user')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const initials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

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

  const openPanel = useCallback((id: PanelId) => {
    setOpenPanels(prev => {
      if (prev.includes(id)) return prev
      if (prev.length >= 2) {
        return [prev[1], id]
      }
      return [...prev, id]
    })
    startLoading(id)
  }, [startLoading])

  const closePanel = useCallback((id: PanelId) => {
    setOpenPanels(prev => prev.filter(p => p !== id))
  }, [])

  const closeAllPanels = useCallback(() => {
    setOpenPanels([])
  }, [])

  const expandPanel = useCallback((id: PanelId) => {
    const route = PANEL_ROUTES[id]
    setOpenPanels([])
    if (route) {
      router.push(route)
    }
  }, [router])

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

  const handleLogout = () => {
    localStorage.removeItem('lynks_user')
    router.push('/')
  }

  const { left: leftPanels, right: rightPanels } = sortPanelsBySide(openPanels)

  return (
    <div className="flex h-screen bg-[#F7F3FE] overflow-hidden">

      {/* Icon sidebar (collapsed) */}
      {!sidebarExpanded && (
        <div className="hidden md:flex flex-col items-center w-[75px] shrink-0 bg-[#F9F5FF] border-r border-[#EDE3FF] py-4 h-screen sticky top-0 z-20">
          <button
            onClick={handleSidebarExpand}
            className="w-10 h-10 rounded-2xl bg-[#EADFFF] flex items-center justify-center mb-6 hover:bg-[#D4C4F7] transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 64 20" className="w-8 h-5" fill="#6B26EA"><path d="M33.7891 3.49091H35.5461C37.0206 3.49091 37.805 4.36364 37.805 6.00436V7.85455C37.805 8.02909 37.7265 8.13382 37.554 8.13382H35.9225C35.7657 8.13382 35.6716 8.02909 35.6716 7.85455V6.49309C35.6716 6.03927 35.4676 5.79491 35.0441 5.79491H34.2911C33.8989 5.79491 33.6636 6.03927 33.6636 6.49309V8.90182L37.3971 10.2633C37.6638 10.3855 37.805 10.5775 37.805 10.9091V14.9411C37.805 16.5818 37.0206 17.4545 35.5461 17.4545H33.7891C32.3302 17.4545 31.5302 16.5818 31.5302 14.9411V13.1084C31.5302 12.9164 31.6243 12.8291 31.7812 12.8291H33.4126C33.5852 12.8291 33.6636 12.9164 33.6636 13.1084V14.4524C33.6636 14.9236 33.8989 15.1505 34.2911 15.1505H35.0441C35.4519 15.1505 35.6716 14.9236 35.6716 14.4524V12.1309L31.9537 10.7695C31.6714 10.6647 31.5302 10.4553 31.5302 10.1236V6.00436C31.5302 4.36364 32.3302 3.49091 33.7891 3.49091Z"/><path d="M29.8339 17.4545H28.1711C27.9829 17.4545 27.873 17.3673 27.8103 17.1927L25.8337 12.0087L25.2533 13.248V17.1055C25.2533 17.3324 25.1435 17.4545 24.9396 17.4545H23.4336C23.2297 17.4545 23.1199 17.3324 23.1199 17.1055V3.84C23.1199 3.61309 23.2297 3.49091 23.4336 3.49091H24.9396C25.1435 3.49091 25.2533 3.61309 25.2533 3.84V9.25091L27.6691 3.75273C27.7476 3.57818 27.8574 3.49091 28.0299 3.49091H29.677C29.9124 3.49091 30.0065 3.66545 29.8967 3.90982L27.2299 10.0015L30.0692 17.0531C30.179 17.28 30.0849 17.4545 29.8339 17.4545Z"/><path d="M19.6634 3.49091H21.2948C21.4517 3.49091 21.5458 3.59564 21.5458 3.77018V17.1753C21.5458 17.3498 21.4517 17.4545 21.2948 17.4545H19.7418C19.6006 17.4545 19.5065 17.3847 19.4594 17.2276L17.0593 9.77454H16.9809V17.1753C16.9809 17.3498 16.9025 17.4545 16.7299 17.4545H15.0985C14.9416 17.4545 14.8475 17.3498 14.8475 17.1753V3.77018C14.8475 3.59564 14.9416 3.49091 15.0985 3.49091H16.6515C16.7927 3.49091 16.8868 3.56073 16.9338 3.71782L19.3183 11.136H19.4124V3.77018C19.4124 3.59564 19.4908 3.49091 19.6634 3.49091Z"/><path d="M11.8999 3.49091H13.4686C13.7039 3.49091 13.8137 3.648 13.7196 3.89236L10.8489 11.6596V17.1055C10.8489 17.3324 10.7391 17.4545 10.5351 17.4545H9.0292C8.82527 17.4545 8.71546 17.3324 8.71546 17.1055V11.6596L5.84474 3.89236C5.75062 3.648 5.86043 3.49091 6.09574 3.49091H7.66443C7.85268 3.49091 7.96249 3.57818 8.02523 3.77018L9.78217 8.77964L11.5391 3.77018C11.6019 3.57818 11.7117 3.49091 11.8999 3.49091Z"/><path d="M2.13343 14.9324H5.86693C6.03948 14.9324 6.11792 15.0371 6.11792 15.2116V16.9571C6.11792 17.1491 6.03948 17.2364 5.86693 17.2364H0.250991C0.09412 17.2364 0 17.1491 0 16.9571V3.552C0 3.37745 0.09412 3.27273 0.250991 3.27273H1.88244C2.05499 3.27273 2.13343 3.37745 2.13343 3.552V14.9324Z"/></svg>
          </button>

          <div className="flex flex-col items-center gap-0.5 flex-1 mt-2">
            <button
              onClick={() => { router.push('/dashboard'); setSidebarExpanded(false) }}
              className={cn(
                'flex items-center justify-center w-[48px] h-[48px] rounded-xl transition-all',
                pathname === '/dashboard'
                  ? 'bg-[#EADFFF] text-[#6B26EA]'
                  : 'text-[rgba(0,0,0,0.40)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
              )}
            >
              <Home size={18} strokeWidth={pathname === '/dashboard' ? 2.5 : 1.5} />
            </button>
            <button
              onClick={() => { router.push('/opportunities'); setSidebarExpanded(false) }}
              className={cn(
                'flex items-center justify-center w-[48px] h-[48px] rounded-xl transition-all',
                pathname === '/opportunities'
                  ? 'bg-[#EADFFF] text-[#6B26EA]'
                  : 'text-[rgba(0,0,0,0.40)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
              )}
            >
              <Briefcase size={18} strokeWidth={pathname === '/opportunities' ? 2.5 : 1.5} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 mt-auto">
            <button
              onClick={() => { router.push('/settings'); setSidebarExpanded(false) }}
              className="flex items-center justify-center w-[48px] h-[48px] rounded-xl text-[rgba(0,0,0,0.40)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA] transition-colors"
            >
              <User size={18} strokeWidth={1.5} />
            </button>
            <div className="w-[48px] h-[48px] rounded-full bg-[#EADFFF] flex items-center justify-center">
              <span className="text-[#6B26EA] text-sm font-semibold">{initials}</span>
            </div>
          </div>
        </div>
      )}

      {/* Full sidebar (expanded) */}
      {sidebarExpanded && (
        <div className="hidden md:flex flex-col w-[305px] shrink-0 bg-[#F9F5FF] border-r border-[#EDE3FF] py-2.5 px-[11px] h-screen sticky top-0 z-20">
          <div className="flex items-center justify-between w-full h-10 mb-2.5 shrink-0">
            <Link href="/dashboard" onClick={() => setSidebarExpanded(false)}>
              <img src="/lynks-full-logo.png" alt="LYNKS" className="h-6 w-auto object-contain" />
            </Link>
            <button
              onClick={handleSidebarExpand}
              className="flex items-center justify-center w-6 h-6 rounded-full border border-[#EDE3FF] bg-white hover:bg-[#F7F3FE] transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
          </div>

          <div className="flex flex-col gap-0.5 mt-1">
            <button
              onClick={() => { router.push('/dashboard'); setSidebarExpanded(false) }}
              className={cn(
                'flex items-center gap-[5px] rounded-2xl p-2.5 w-full transition-all',
                pathname === '/dashboard' ? 'text-[#6B26EA] font-medium' : 'text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)]'
              )}
            >
              <Home size={14} strokeWidth={pathname === '/dashboard' ? 2.5 : 1.5} />
              <span className="text-[13px]">Home</span>
            </button>
            <button
              onClick={() => { router.push('/opportunities'); setSidebarExpanded(false) }}
              className={cn(
                'flex items-center gap-[5px] rounded-2xl p-2.5 w-full transition-all',
                pathname === '/opportunities' ? 'text-[#6B26EA] font-medium' : 'text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)]'
              )}
            >
              <Briefcase size={14} strokeWidth={pathname === '/opportunities' ? 2.5 : 1.5} />
              <span className="text-[13px]">Opportunities</span>
            </button>
          </div>

          <div className="h-px bg-[#EDE3FF] my-3" />

          {recentProjects.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-[rgba(0,0,0,0.30)] font-semibold uppercase tracking-wider px-2.5 mb-1.5">Projects</p>
              {recentProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { router.push('/chat'); setSidebarExpanded(false) }}
                  className="flex items-center gap-2.5 p-2.5 w-full rounded-2xl text-[13px] text-[rgba(0,0,0,0.50)] hover:text-[#0D0026] hover:bg-[rgba(0,0,0,0.03)] transition-all"
                >
                  <MessageSquare size={14} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />

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
      )}

      {/* Main area: top icon bar + panels + page content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top icon bar — 4 split-screen icons (hidden on dashboard) */}
        {pathname !== '/dashboard' && (
        <div className="hidden md:flex items-center justify-end gap-1 px-4 py-2 border-b border-[#EDE3FF] bg-white shrink-0">
          {PANEL_ICONS.map((item) => {
            const isActive = openPanels.includes(item.id)
            return (
              <button
                key={item.id}
                onClick={() => togglePanel(item.id)}
                className={cn(
                  'flex items-center justify-center w-[36px] h-[36px] rounded-lg transition-all',
                  isActive
                    ? 'bg-[#EADFFF] text-[#6B26EA]'
                    : 'text-[rgba(0,0,0,0.35)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
                )}
                title={item.label}
              >
                <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            )
          })}
        </div>
        )}

        {/* Panels + page content row */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {openPanels.length >= 2 ? (
            /* 2 panels open: fill full width, center them */
            <>
              {leftPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col flex-1 border-r border-[#EDE3FF] bg-white h-full overflow-hidden min-w-0">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={openPanel} />}
                  </div>
                </div>
              ))}
              {rightPanels.map(id => (
                <div key={id} className="hidden md:flex flex-col flex-1 border-l border-[#EDE3FF] bg-white h-full overflow-hidden min-w-0">
                  <PanelHeader panelId={id} onClose={() => closePanel(id)} onExpand={() => expandPanel(id)} />
                  <div className="flex-1 overflow-y-auto">
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={openPanel} />}
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
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={openPanel} />}
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
                    {loadingPanels.has(id) ? <LoadingPanel /> : <PanelContent panelId={id} openPanel={openPanel} />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-[#EDE3FF] px-2 py-2">
        {PANEL_ICONS.map((item) => {
          const isActive = openPanels.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => togglePanel(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors min-w-[48px]',
                isActive ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)]'
              )}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
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
          <span className="text-[10px] font-medium">Profile</span>
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
  const route = PANEL_ROUTES[panelId]
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE3FF] shrink-0">
      <p className="text-[13px] font-semibold text-[#0D0026]">{titles[panelId]}</p>
      <div className="flex items-center gap-1">
        {route && (
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const result = await listConversations()
      setConversations(result.conversations || [])
    } catch { /* ignore */ }
    finally { setLoadingConversations(false) }
  }

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true)
    setError('')
    try {
      const result = await getConversationMessages(conversationId)
      setMessages(result.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally { setLoadingMessages(false) }
  }

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId)
    loadMessages(conversationId)
  }

  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setError('')
  }

  const handleClearHistory = async () => {
    try {
      await deleteChatHistory()
      setConversations([])
      setMessages([])
      setActiveConversationId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history')
    }
  }

  const handleSend = async () => {
    if (!message.trim() || sending) return

    const userMessage: ChatMessage = { role: 'user', content: message.trim() }
    setMessages(prev => [...prev, userMessage])
    const currentMessage = message.trim()
    setMessage('')
    setSending(true)
    setError('')

    try {
      const result = await sendMessage(currentMessage, activeConversationId || undefined)

      if (!activeConversationId && result.conversation_id) {
        setActiveConversationId(result.conversation_id)
        loadConversations()
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        tool_calls: result.tool_calls || null,
      }
      setMessages(prev => [...prev, aiMessage])

      if (result.summary_updated) loadConversations()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
      if (errorMsg === 'Not authenticated') {
        setError('Session expired. Please refresh the page.')
      } else {
        setError(errorMsg || 'Something went wrong.')
      }
    } finally { setSending(false) }
  }

  const TOOL_LABELS: Record<string, string> = {
    generate_roadmap: 'Generating your roadmap...',
    get_portfolio: 'Looking up your portfolio...',
    find_opportunities: 'Searching for opportunities...',
    complete_task: 'Updating your task...',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversation list header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#EDE3FF] shrink-0">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#6B26EA] text-white text-[11px] font-medium hover:bg-[#5A1FD0] transition-colors"
        >
          <Plus size={12} />
          New Chat
        </button>
        {conversations.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-[10px] text-[#8B898E] hover:text-[#D14444] transition-colors"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      {/* Conversation list */}
      {!activeConversationId && messages.length === 0 && (
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loadingConversations && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={14} className="text-[#6B26EA] animate-spin" />
            </div>
          )}
          {!loadingConversations && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-[13px] text-[#8B898E]">Ask LYNKS anything about your career journey.</p>
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.conversation_id}
              onClick={() => handleSelectConversation(conv.conversation_id)}
              className="w-full text-left px-3 py-2 rounded-lg text-[12px] text-[#0D0026] hover:bg-[#F7F3FE] transition-colors truncate"
            >
              <div className="flex items-center gap-1.5 truncate">
                <MessageSquare size={10} className="shrink-0 opacity-50" />
                <span className="truncate">{conv.title || 'New conversation'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      {(activeConversationId || messages.length > 0) && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={16} className="text-[#6B26EA] animate-spin" />
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-2">
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-[9px] font-bold">L</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {msg.tool_calls?.calls && msg.tool_calls.calls.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                          <Loader2 size={10} className="text-[#6B26EA] animate-spin" />
                          <span className="text-[10px] text-[#6B26EA]">
                            {TOOL_LABELS[msg.tool_calls.calls[0]] || 'Working on it...'}
                          </span>
                        </div>
                      )}
                      <div className={cn(
                        'rounded-2xl px-3 py-2 text-[12px] max-w-[90%]',
                        msg.role === 'user'
                          ? 'bg-[#6B26EA] text-white ml-auto'
                          : 'bg-[#F7F3FE] text-[#1E1E1E]'
                      )}>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                      {msg.created_at && (
                        <p className="text-[9px] text-[rgba(30,30,30,0.4)] mt-0.5 px-0.5">
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-[9px] font-bold">U</span>
                      </div>
                    )}
                  </div>
                ))}

                {sending && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                      <span className="text-[#6B26EA] text-[9px] font-bold">L</span>
                    </div>
                    <div className="bg-[#F7F3FE] rounded-2xl px-3 py-2">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <p className="text-[11px] text-[#D14444] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-1.5">
                      {error}
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Back to conversations */}
          {activeConversationId && (
            <div className="px-3 pb-1 shrink-0">
              <button
                onClick={handleNewChat}
                className="text-[10px] text-[#6B26EA] hover:text-[#5A1FD0] transition-colors"
              >
                ← New conversation
              </button>
            </div>
          )}
        </>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#EDE3FF] shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-[#EDE3FF] bg-[#F9F5FF] px-3 py-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
            placeholder="Ask anything..."
            disabled={sending}
            className="flex-1 bg-transparent text-[12px] text-[#0D0026] placeholder:text-[rgba(0,0,0,0.31)] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 shrink-0"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
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
            if (openPanel) {
              openPanel('chat')
            }
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
