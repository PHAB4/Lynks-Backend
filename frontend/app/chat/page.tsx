'use client'

import { useState, useEffect } from 'react'
import { Send, Paperclip } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [userName, setUserName] = useState('')

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

  const handleSend = () => {
    if (!message.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setMessage('')
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-screen bg-[#F7F3FE]">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8 md:py-12">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 md:gap-[57px] max-w-[880px] mx-auto">
              <p className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-center text-[#0D0026] px-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                Welcome {userName}<br />How can LYNKS help you today?
              </p>
            </div>
          ) : (
            <div className="max-w-[880px] mx-auto space-y-4 py-8">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-[#6B26EA] text-white' : 'bg-white border border-[#EDE3FF] text-[#0D0026]'}`}>{msg.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-center px-4 md:px-6 pb-4 md:pb-6">
          <div className="flex items-center gap-3 bg-white border border-[#EDE3FF] rounded-2xl px-4 py-3 w-full max-w-[880px] shadow-sm">
            <button className="text-[#A8A8A8] hover:text-[#6B26EA] transition-colors shrink-0"><Paperclip size={18} /></button>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type your message..." className="flex-1 bg-transparent text-sm text-[#0D0026] placeholder:text-[rgba(0,0,0,0.30)] focus:outline-none min-w-0" />
            <button onClick={handleSend} disabled={!message.trim()} className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#6B26EA] text-white hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 shrink-0"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
