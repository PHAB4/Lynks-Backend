'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, LogOut, Settings,
  Loader2, Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { useAuthGate } from '@/lib/use-auth'
import {
  listConversations,
  deleteChatHistory,
  type ConversationItem,
} from '@/lib/chat-api'

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
    setSidebarExpanded(prev => !prev)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('lynks_user')
    router.push('/')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  if (!authChecked) return (
    <div className="flex h-screen bg-[#F7F3FE] items-center justify-center">
      <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
    </div>
  )

  const collapsedSidebar = (
    <div className="hidden md:flex flex-col items-center w-[75px] shrink-0 bg-[#F9F5FF] border-r border-[#EDE3FF] py-4 h-screen sticky top-0 z-20">
      <button
        onClick={handleSidebarExpand}
        className="w-10 h-10 rounded-2xl bg-[#EADFFF] flex items-center justify-center mb-6 hover:bg-[#D4C4F7] transition-colors cursor-pointer"
      >
        <svg viewBox="0 0 64 20" className="w-8 h-5" fill="#6B26EA"><path d="M33.7891 3.49091H35.5461C37.0206 3.49091 37.805 4.36364 37.805 6.00436V7.85455C37.805 8.02909 37.7265 8.13382 37.554 8.13382H35.9225C35.7657 8.13382 35.6716 8.02909 35.6716 7.85455V6.49309C35.6716 6.03927 35.4676 5.79491 35.0441 5.79491H34.2911C33.8989 5.79491 33.6636 6.03927 33.6636 6.49309V8.90182L37.3971 10.2633C37.6638 10.3855 37.805 10.5775 37.805 10.9091V14.9411C37.805 16.5818 37.0206 17.4545 35.5461 17.4545H33.7891C32.3302 17.4545 31.5302 16.5818 31.5302 14.9411V13.1084C31.5302 12.9164 31.6243 12.8291 31.7812 12.8291H33.4126C33.5852 12.8291 33.6636 12.9164 33.6636 13.1084V14.4524C33.6636 14.9236 33.8989 15.1505 34.2911 15.1505H35.0441C35.4519 15.1505 35.6716 14.9236 35.6716 14.4524V12.1309L31.9537 10.7695C31.6714 10.6647 31.5302 10.4553 31.5302 10.1236V6.00436C31.5302 4.36364 32.3302 3.49091 33.7891 3.49091Z"/><path d="M29.8339 17.4545H28.1711C27.9829 17.4545 27.873 17.3673 27.8103 17.1927L25.8337 12.0087L25.2533 13.248V17.1055C25.2533 17.3324 25.1435 17.4545 24.9396 17.4545H23.4336C23.2297 17.4545 23.1199 17.3324 23.1199 17.1055V3.84C23.1199 3.61309 23.2297 3.49091 23.4336 3.49091H24.9396C25.1435 3.49091 25.2533 3.61309 25.2533 3.84V9.25091L27.6691 3.75273C27.7476 3.57818 27.8574 3.49091 28.0299 3.49091H29.677C29.9124 3.49091 30.0065 3.66545 29.8967 3.90982L27.2299 10.0015L30.0692 17.0531C30.179 17.28 30.0849 17.4545 29.8339 17.4545Z"/><path d="M19.6634 3.49091H21.2948C21.4517 3.49091 21.5458 3.59564 21.5458 3.77018V17.1753C21.5458 17.3498 21.4517 17.4545 21.2948 17.4545H19.7418C19.6006 17.4545 19.5065 17.3847 19.4594 17.2276L17.0593 9.77454H16.9809V17.1753C16.9809 17.3498 16.9025 17.4545 16.7299 17.4545H15.0985C14.9416 17.4545 14.8475 17.3498 14.8475 17.1753V3.77018C14.8475 3.59564 14.9416 3.49091 15.0985 3.49091H16.6515C16.7927 3.49091 16.8868 3.56073 16.9338 3.71782L19.3183 11.136H19.4124V3.77018C19.4124 3.59564 19.4908 3.49091 19.6634 3.49091Z"/><path d="M11.8999 3.49091H13.4686C13.7039 3.49091 13.8137 3.648 13.7196 3.89236L10.8489 11.6596V17.1055C10.8489 17.3324 10.7391 17.4545 10.5351 17.4545H9.0292C8.82527 17.4545 8.71546 17.3324 8.71546 17.1055V11.6596L5.84474 3.89236C5.75062 3.648 5.86043 3.49091 6.09574 3.49091H7.66443C7.85268 3.49091 7.96249 3.57818 8.02523 3.77018L9.78217 8.77964L11.5391 3.77018C11.6019 3.57818 11.7117 3.49091 11.8999 3.49091Z"/><path d="M2.13343 14.9324H5.86693C6.03948 14.9324 6.11792 15.0371 6.11792 15.2116V16.9571C6.11792 17.1491 6.03948 17.2364 5.86693 17.2364H0.250991C0.09412 17.2364 0 17.1491 0 16.9571V3.552C0 3.37745 0.09412 3.27273 0.250991 3.27273H1.88244C2.05499 3.27273 2.13343 3.37745 2.13343 3.552V14.9324Z"/></svg>
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
        <div className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
          {children}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-[#EDE3FF] px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors min-w-[48px]',
              isActive(item.href) ? 'text-[#6B26EA]' : 'text-[rgba(0,0,0,0.50)]'
            )}
          >
            <item.icon size={18} strokeWidth={isActive(item.href) ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
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
