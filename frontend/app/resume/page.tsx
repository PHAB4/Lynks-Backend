'use client'

import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { useAuthGate } from '@/lib/use-auth'

export default function ResumePage() {
  const authChecked = useAuthGate()
  const [user, setUser] = useState({ name: '', email: '', education: '', interests: [] as string[] })

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data } = await supabase.from('users').select('name, email, education_level, interests').eq('id', authUser.id).single()
        if (data) {
          setUser({
            name: data.name || '',
            email: data.email || authUser.email || '',
            education: data.education_level || '',
            interests: data.interests || [],
          })
        }
      }
    }
    load()
  }, [])

  if (!authChecked) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen bg-[#F7F3FE]">
          <div className="w-8 h-8 border-2 border-[#6B26EA] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#F0EFF2]">
        {/* Resume preview */}
        <div className="flex-1 flex items-start justify-center pt-8 px-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-sm w-[600px] min-h-[800px] p-10 border border-[#EDE3FF]">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#EDE3FF]">
              <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center">
                <span className="text-[#6B26EA] font-bold text-2xl">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0D0026]">{user.name || 'Your Name'}</h2>
                <p className="text-sm text-[#8B898E]">{user.email || 'your@email.com'}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">EXPERIENCE</h3>
                <p className="text-sm text-[#A8A8A8]">No experience added yet. Complete tasks on your roadmap to build your resume automatically.</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">EDUCATION</h3>
                {user.education ? (
                  <p className="text-sm text-[#0D0026]">{user.education}</p>
                ) : (
                  <p className="text-sm text-[#A8A8A8]">No education added yet.</p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-3">SKILLS</h3>
                {user.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map((skill, i) => (
                      <span key={i} className="py-1.5 px-3 rounded-full bg-[#F9F5FF] border border-[#EDE3FF] text-xs font-semibold text-[#6B26EA]">{skill}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#A8A8A8]">No skills added yet. AI will suggest skills based on your career journey.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Export sidebar */}
        <div className="hidden lg:flex flex-col w-[280px] bg-[#F0EFF2] shrink-0 p-4">
          <div className="flex-1" />
          <div className="space-y-3">
            <div className="h-px bg-[#918E8E]" />
            <button className="w-full py-3 rounded-[10px] border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] text-sm font-medium text-[#000] hover:bg-[#D4C4F7] transition-colors flex items-center justify-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
              <FileText size={14} /> Word
            </button>
            <button className="w-full py-3 rounded-xl bg-[#6B26EA] text-sm font-semibold text-white hover:bg-[#5A1FD0] transition-colors flex items-center justify-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
              <FileText size={14} /> PDF
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
