'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home, Briefcase, MessageSquare, Map, FileText,
  ChevronLeft, LogOut, Settings,
  Loader2, Plus, Trash2, ListChecks,
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
        {pathname !== '/dashboard' && pathname !== '/settings' && pathname !== '/onboarding' && (
          <div className="hidden md:flex items-center justify-end gap-1 px-4 py-2 border-b border-[#EDE3FF] bg-white shrink-0">
            {[
              { icon: ListChecks, label: 'Steps', href: '/roadmap' },
              { icon: Map, label: 'Roadmap', href: '/roadmap' },
              { icon: MessageSquare, label: 'Chat', href: '/chat' },
              { icon: FileText, label: 'Resume', href: '/resume' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex items-center justify-center w-[36px] h-[36px] rounded-lg transition-all',
                  isActive(item.href)
                    ? 'bg-[#EADFFF] text-[#6B26EA]'
                    : 'text-[rgba(0,0,0,0.35)] hover:bg-[rgba(107,38,234,0.06)] hover:text-[#6B26EA]'
                )}
                title={item.label}
              >
                <item.icon size={16} strokeWidth={isActive(item.href) ? 2 : 1.5} />
              </button>
            ))}
          </div>
        )}
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
