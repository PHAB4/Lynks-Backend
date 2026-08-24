'use client'

import { FileText } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useEffect, useState } from 'react'

export default function ResumePage() {
  const [user, setUser] = useState({ name: '', email: '' })

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lynks_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUser({ name: u.name || '', email: u.email || '' })
      }
    } catch {}
  }, [])

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-[#F9F5FF]">
        <div className="flex-1 p-10">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="text-[#6B26EA]" size={24} />
            <h1 className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Resume</h1>
          </div>
          <div className="bg-white rounded-2xl border border-[#EDE3FF] p-8 max-w-[800px]">
            <h2 className="text-xl font-bold text-[#0D0026] mb-4">{user.name || 'Your Name'}</h2>
            <p className="text-sm text-[#8B898E] mb-2">{user.email || 'your@email.com'}</p>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">EXPERIENCE</h3>
              <p className="text-sm text-[#A8A8A8]">No experience added yet. Complete tasks on your roadmap to build your resume automatically.</p>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">EDUCATION</h3>
              <p className="text-sm text-[#A8A8A8]">No education added yet. Add this during onboarding.</p>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">SKILLS</h3>
              <p className="text-sm text-[#A8A8A8]">No skills added yet. Your AI will suggest skills based on your career journey.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
