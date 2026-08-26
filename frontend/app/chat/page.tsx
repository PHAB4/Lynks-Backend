'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Plus, MessageSquare, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import {
  sendMessage,
  listConversations,
  getConversationMessages,
  deleteChatHistory,
  type ChatMessage,
  type ConversationItem,
} from '@/lib/chat-api'

const TOOL_LABELS: Record<string, string> = {
  generate_roadmap: 'Generating your roadmap...',
  get_portfolio: 'Looking up your portfolio...',
  find_opportunities: 'Searching for opportunities...',
  complete_task: 'Updating your task...',
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('lynks_user')
      if (cached) {
        try { return JSON.parse(cached).name || 'there' } catch { /* ignore */ }
      }
    }
    return 'there'
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    const loadUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).single()
        if (data?.name) {
          setUserName(data.name)
          localStorage.setItem('lynks_user', JSON.stringify({ name: data.name }))
        }
      }
    }
    loadUserName()
  }, [])

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const result = await listConversations()
      setConversations(result.conversations || [])
    } catch {
      // Ignore errors on initial load
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true)
    setError('')
    try {
      const result = await getConversationMessages(conversationId)
      setMessages(result.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId)
    loadMessages(conversationId)
  }

  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setError('')
    inputRef.current?.focus()
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
        tool_calls: result.tool_calls ? { calls: result.tool_calls } : null,
      }
      setMessages(prev => [...prev, aiMessage])

      if (result.summary_updated) {
        loadConversations()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
      if (errorMsg === 'Not authenticated') {
        setError('Session expired. Please refresh the page.')
      } else {
        setError(errorMsg || 'Something went wrong. Please try again.')
      }
    } finally {
      setSending(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#F7F3FE]">

        {/* Conversation sidebar */}
        <div className={cn(
          'hidden md:flex flex-col shrink-0 bg-white border-r border-[#EDE3FF] transition-all duration-200',
          sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'
        )}>
          <div className="p-3 border-b border-[#EDE3FF]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                Conversations
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-6 h-6 rounded-md hover:bg-[#F7F3FE] flex items-center justify-center text-[#8B898E]"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#6B26EA] text-white text-[13px] font-medium hover:bg-[#5A1FD0] transition-colors"
            >
              <Plus size={14} />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingConversations && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="text-[#6B26EA] animate-spin" />
              </div>
            )}
            {!loadingConversations && conversations.length === 0 && (
              <p className="text-[12px] text-[#8B898E] text-center py-8">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.conversation_id}
                onClick={() => handleSelectConversation(conv.conversation_id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-xl text-[13px] transition-colors truncate',
                  conv.conversation_id === activeConversationId
                    ? 'bg-[#EADFFF] text-[#6B26EA] font-medium'
                    : 'text-[#0D0026] hover:bg-[#F7F3FE]'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={12} className="shrink-0 opacity-50" />
                  <span className="truncate">{conv.title || 'New conversation'}</span>
                </div>
              </button>
            ))}
          </div>

          {conversations.length > 0 && (
            <div className="p-3 border-t border-[#EDE3FF]">
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 text-[12px] text-[#8B898E] hover:text-[#D14444] transition-colors"
              >
                <Trash2 size={12} />
                Clear all history
              </button>
            </div>
          )}
        </div>

        {/* Sidebar toggle for mobile */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden md:flex absolute left-0 top-4 z-10 w-8 h-8 rounded-r-lg bg-white border border-l-0 border-[#EDE3FF] items-center justify-center text-[#8B898E] hover:text-[#6B26EA] transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        )}

        {/* Chat main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
            {!hasMessages && !loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full max-w-[600px] mx-auto">
                <p className="text-2xl md:text-[32px] font-semibold leading-tight text-center text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  Welcome {userName}<br />How can LYNKS help you today?
                </p>
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
              </div>
            ) : (
              <div className="space-y-4 max-w-[600px] mx-auto">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-xs font-bold">L</span>
                      </div>
                    )}
                    <div className="flex-1">
                      {msg.tool_calls?.calls && msg.tool_calls.calls.length > 0 && (
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <Loader2 size={12} className="text-[#6B26EA] animate-spin" />
                          <span className="text-[11px] text-[#6B26EA]" style={{ fontFamily: "'Inter', sans-serif" }}>
                            {TOOL_LABELS[msg.tool_calls.calls[0]] || 'Working on it...'}
                          </span>
                        </div>
                      )}
                      <div className={cn(
                        'rounded-2xl px-4 py-3 text-sm shadow-[0_4px_12px_rgba(107,38,234,0.07)]',
                        msg.role === 'user'
                          ? 'bg-[#6B26EA] text-white ml-auto max-w-[85%]'
                          : 'bg-white text-[#1E1E1E] max-w-[85%]'
                      )}>
                        <p style={{ fontFamily: "'Inter', sans-serif", whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                      {msg.created_at && (
                        <p className="text-[11px] text-[rgba(30,30,30,0.50)] mt-1 px-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                ))}

                {sending && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                      <span className="text-[#6B26EA] text-xs font-bold">L</span>
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 shadow-[0_4px_12px_rgba(107,38,234,0.07)]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[#6B26EA] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <p className="text-[13px] text-[#D14444] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-2">
                      {error}
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="flex items-center gap-3 bg-white border border-[#B1AEAE] rounded-xl px-4 py-3 max-w-[600px] mx-auto shadow-[0_0_5px_rgba(0,0,0,0.05)]">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Lynks anything..."
                disabled={sending}
                className="flex-1 bg-transparent text-sm text-[#0D0026] placeholder:text-[rgba(30,30,30,0.31)] focus:outline-none disabled:opacity-50"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 shrink-0"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
