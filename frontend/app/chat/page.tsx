'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import {
  sendMessage,
  getConversationMessages,
  type ChatMessage,
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
  const roadmapStep = searchParams.get('roadmap_step')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
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

    const urlConversationId = searchParams.get('conversation')
    if (urlConversationId) {
      setActiveConversationId(urlConversationId)
      loadMessages(urlConversationId)
    }
  }, [searchParams])

  useEffect(() => {
    if (roadmapStep && !sending && messages.length === 0) {
      const autoSend = async () => {
        const userMessage: ChatMessage = { role: 'user', content: roadmapStep }
        setMessages([userMessage])
        setSending(true)
        setError('')
        try {
          const result = await sendMessage(roadmapStep)
          const aiMessage: ChatMessage = {
            role: 'assistant',
            content: result.response,
            tool_calls: result.tool_calls ? result.tool_calls.map(tc => tc.name) : null,
          }
          setMessages([userMessage, aiMessage])
          if (result.conversation_id) {
            setActiveConversationId(result.conversation_id)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to send message')
        } finally {
          setSending(false)
          window.history.replaceState({}, '', '/chat')
        }
      }
      autoSend()
    }
  }, [roadmapStep])

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
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        tool_calls: result.tool_calls ? result.tool_calls.map(tc => tc.name) : null,
      }
      setMessages(prev => [...prev, aiMessage])
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

  const hasMessages = messages.length > 0

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#F7F3FE]">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages area */}
          {loadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={20} className="text-[#6B26EA] animate-spin" />
            </div>
          ) : hasMessages ? (
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
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
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm prose-purple max-w-none break-words
                            prose-headings:font-semibold prose-headings:text-[#1E1E1E] prose-headings:mt-3 prose-headings:mb-1.5
                            prose-p:my-1.5 prose-p:leading-relaxed
                            prose-strong:text-[#1E1E1E] prose-strong:font-semibold
                            prose-a:text-[#6B26EA] prose-a:no-underline hover:prose-a:underline
                            prose-code:bg-[#F5F0FF] prose-code:text-[#6B26EA] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                            prose-pre:bg-[#1E1E1E] prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:border prose-pre:border-[#EDE3FF]
                            prose-li:my-0.5
                            prose-ul:my-2 prose-ol:my-2
                            prose-table:border-collapse prose-table:w-full prose-table:text-sm
                            prose-th:bg-[#F5F0FF] prose-th:text-[#6B26EA] prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-[#EDE3FF] prose-th:text-left
                            prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-[#EDE3FF]
                            prose-blockquote:border-l-[#6B26EA] prose-blockquote:bg-[#F9F7FE] prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                            prose-hr:border-[#EDE3FF]
                          ">
                            <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                          </div>
                        ) : (
                          <p style={{ whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" }}>{msg.content}</p>
                        )}
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
            </div>
          ) : (
            /* Empty state — welcome centered above input */
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className="flex flex-col items-center max-w-[480px] mb-8">
                <div className="w-14 h-14 rounded-full bg-[#EADFFF] flex items-center justify-center mb-5">
                  <Sparkles size={24} className="text-[#6B26EA]" />
                </div>
                <p className="text-2xl md:text-[32px] font-semibold leading-tight text-center text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  Hi {userName}
                </p>
                <p className="text-[14px] text-[#8B898E] text-center">
                  How can I help with your career today?
                </p>
              </div>
            </div>
          )}

          <div className="px-4 md:px-6 pb-4 md:pb-6 shrink-0">
            <div className="flex items-end gap-3 bg-white border border-[#B1AEAE] rounded-xl px-4 py-3 max-w-[600px] mx-auto shadow-[0_0_5px_rgba(0,0,0,0.05)]">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sending) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask Lynks anything..."
                disabled={sending}
                rows={1}
                className="flex-1 bg-transparent text-sm text-[#0D0026] placeholder:text-[rgba(30,30,30,0.31)] focus:outline-none disabled:opacity-50 resize-none max-h-[120px] min-h-[20px]"
                style={{ fontFamily: "'Inter', sans-serif", height: 'auto', overflowY: message.split('\n').length > 4 ? 'auto' : 'hidden' }}
                onInput={(e) => {
                  const target = e.currentTarget
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                }}
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
