'use client'

import { useState } from 'react'
import { Send, Paperclip } from 'lucide-react'
import AppLayout from '@/components/AppLayout'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const handleSend = () => { if (!message.trim()) return; setMessages(prev => [...prev, { role: 'user', content: message }]); setMessage('') }
  return (
    <AppLayout>
      <div className="flex flex-col h-screen bg-background">
        <div className="flex-1 overflow-y-auto px-6 py-12">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-[57px] max-w-[880px] mx-auto"><p className="text-[40px] font-semibold leading-[50px] text-center text-text-primary">Welcome Human<br />Are you ready to move forward in your career journey?</p></div>
          ) : (
            <div className="max-w-[880px] mx-auto space-y-4 py-8">{messages.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface border border-border text-text-primary'}`}>{msg.content}</div></div>))}</div>
          )}
        </div>
        <div className="flex justify-center px-6 pb-6">
          <div className="flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 w-full max-w-[880px] shadow-sm">
            <button className="text-text-muted hover:text-primary transition-colors"><Paperclip size={18} /></button>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Type your message..." className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-input focus:outline-none" />
            <button onClick={handleSend} disabled={!message.trim()} className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}