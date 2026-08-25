'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; time: string }>>([])
  const [userName, setUserName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).single()
        setUserName(data?.name || user.email?.split('@')[0] || 'there')
      }
    }
    load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = () => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const handleSend = () => {
    if (!message.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: message, time: formatTime() }])
    setMessage('')
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: "I'm analyzing your request. LYNKS will have a response ready soon — our AI career assistant is being built to help with this.", time: formatTime() }])
    }, 1000)
  }

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#F7F3FE]">
        {/* Chat section */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full max-w-[600px] mx-auto">
                <p className="text-2xl md:text-[32px] font-semibold leading-tight text-center text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  Welcome {userName}<br />How can LYNKS help you today?
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-[600px] mx-auto">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    {msg.role === 'ai' && (
                      <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-xs font-bold">L</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className={`rounded-2xl px-4 py-3 text-sm shadow-[0_4px_12px_rgba(107,38,234,0.07)] ${msg.role === 'user' ? 'bg-[#6B26EA] text-white ml-auto max-w-[85%]' : 'bg-white text-[#1E1E1E] max-w-[85%]'}`}>
                        <p style={{ fontFamily: "'Inter', sans-serif" }}>{msg.content}</p>
                      </div>
                      <p className="text-[11px] text-[rgba(30,30,30,0.50)] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>{msg.time}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <span className="text-[#6B26EA] text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {/* Chat input */}
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="flex items-center gap-3 bg-white border border-[#B1AEAE] rounded-xl px-4 py-3 max-w-[600px] shadow-[0_0_5px_rgba(0,0,0,0.05)]">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Lynks anything..."
                className="flex-1 bg-transparent text-sm text-[#0D0026] placeholder:text-[rgba(30,30,30,0.31)] focus:outline-none"
                style={{ fontFamily: "'Inter', sans-serif" }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Resume panel — right side */}
        <div className="hidden lg:flex flex-col w-[420px] bg-[#F0EFF2] shrink-0">
          <div className="flex-1 p-4 flex items-start justify-center pt-8">
            <div className="bg-white rounded-lg shadow-sm w-[340px] min-h-[450px] p-6 border border-[#EDE3FF]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#EADFFF] flex items-center justify-center">
                  <span className="text-[#6B26EA] font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-bold text-[#0D0026] text-base">{userName || 'Your Name'}</p>
                  <p className="text-xs text-[#8B898E]">Career Profile</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-2">EXPERIENCE</h4>
                  <p className="text-xs text-[#A8A8A8]">No experience yet. Complete tasks on your roadmap to build your resume.</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-2">EDUCATION</h4>
                  <p className="text-xs text-[#A8A8A8]">Add during onboarding.</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-2">SKILLS</h4>
                  <p className="text-xs text-[#A8A8A8]">AI will suggest skills based on your career journey.</p>
                </div>
              </div>
            </div>
          </div>
          {/* Export buttons */}
          <div className="p-4 space-y-3">
            <div className="h-px bg-[#918E8E]" />
            <button className="w-full py-3 rounded-[10px] border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] text-sm font-medium text-[#000] hover:bg-[#D4C4F7] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>
              Word
            </button>
            <button className="w-full py-3 rounded-xl bg-[#6B26EA] text-sm font-semibold text-white hover:bg-[#5A1FD0] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>
              PDF
            </button>
            <button className="w-full py-3 rounded-[10px] border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] text-sm font-medium text-[#000] hover:bg-[#D4C4F7] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>
              Edit resume
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
