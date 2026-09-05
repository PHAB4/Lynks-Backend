'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
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

export default function ChatPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex h-screen bg-[#F7F3FE] items-center justify-center">
          <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
        </div>
      </AppLayout>
    }>
      <ChatContent />
    </Suspense>
  )
}

function ChatContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('lynks_user')
      if (cached) {
        try { return JSON.parse(cached).name || 'there' } catch { /* ignore */ }
      }
    }
    return 'there'
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).single()
        setUserName(data?.name || user.email?.split('@')[0] || 'there')
      }
    }
    loadUser()
    loadConversations()

    const urlConversationId = searchParams.get('conversation')
    if (urlConversationId) {
      setActiveConversationId(urlConversationId)
      loadMessages(urlConversationId)
    }
  }, [searchParams])

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
    router.replace(`/chat?conversation=${conversationId}`, { scroll: false })
  }

  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setError('')
    router.replace('/chat', { scroll: false })
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
        tool_calls: result.tool_calls ? result.tool_calls.map((tc: { name: string }) => tc.name) : null,
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
      <AppLayout>
      <div className="flex h-screen bg-[#F7F3FE]">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sidebar toggle — conversation list when no active chat */}
          {!activeConversationId && messages.length === 0 ? (
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
              {/* New Chat + Clear buttons */}
              <div className="max-w-[600px] mx-auto flex items-center justify-between mb-6">
                <p className="text-[11px] text-[rgba(0,0,0,0.30)] font-semibold uppercase tracking-wider">Conversations</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 text-[10px] text-[#8B898E] hover:text-[#D14444] transition-colors"
                  >
                    <Trash2 size={10} />
                    Clear
                  </button>
                </div>
              </div>

              {loadingConversations && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-[#6B26EA] animate-spin" />
                </div>
              )}

              {!loadingConversations && conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center max-w-[600px] mx-auto">
                  <p className="text-2xl md:text-[32px] font-semibold leading-tight text-center text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    Welcome {userName}<br />How can LYNKS help you today?
                  </p>
                </div>
              )}

              {!loadingConversations && conversations.length > 0 && (
                <div className="max-w-[600px] mx-auto space-y-2">
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#EDE3FF] text-[13px] text-[#6B26EA] hover:bg-[#F9F5FF] transition-colors"
                  >
                    <Plus size={14} />
                    New conversation
                  </button>
                  {conversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => handleSelectConversation(conv.conversation_id)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white border border-[#EDE3FF] hover:border-[#D4C4F7] hover:shadow-[0_2px_8px_rgba(107,38,234,0.08)] transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={12} className="text-[#6B26EA] shrink-0" />
                        <p className="text-[13px] font-medium text-[#0D0026] truncate">{conv.title || 'New conversation'}</p>
                      </div>
                      <p className="text-[11px] text-[#8B898E] pl-5">{conv.message_count} messages</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Active chat — messages */
            <>
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#EDE3FF] bg-white shrink-0">
                <button
                  onClick={handleNewChat}
                  className="text-[12px] text-[#6B26EA] hover:text-[#5A1FD0] transition-colors"
                >
                  ← New conversation
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="text-[#6B26EA] animate-spin" />
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
                          {msg.tool_calls && msg.tool_calls.length > 0 && (
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <Loader2 size={10} className="text-[#6B26EA] animate-spin" />
                              <span className="text-[11px] text-[#6B26EA]">
                                {TOOL_LABELS[msg.tool_calls[0]] || 'Working on it...'}
                              </span>
                            </div>
                          )}
                          <div className={`rounded-2xl px-4 py-3 text-sm shadow-[0_4px_12px_rgba(107,38,234,0.07)] ${msg.role === 'user' ? 'bg-[#6B26EA] text-white ml-auto max-w-[85%]' : 'bg-white text-[#1E1E1E] max-w-[85%]'}`}>
                            <p style={{ whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" }}>{msg.content}</p>
                          </div>
                          {msg.created_at && (
                            <p className="text-[11px] text-[rgba(30,30,30,0.50)] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
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
                        <p className="text-[12px] text-[#D14444] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2">
                          {error}
                        </p>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Chat input */}
          <div className="px-4 md:px-6 pb-4 md:pb-6 shrink-0">
            <div className="flex items-center gap-3 bg-white border border-[#B1AEAE] rounded-xl px-4 py-3 max-w-[600px] mx-auto shadow-[0_0_5px_rgba(0,0,0,0.05)]">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
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
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
