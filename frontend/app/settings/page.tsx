'use client'

import { useState } from 'react'
import { User, Mail, Phone, Briefcase, Save } from 'lucide-react'
import AppLayout from '@/components/AppLayout'

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: 'John Doe', email: 'john@example.com', phone: '+1 (555) 123-4567', role: 'Software Engineer' })
  const [interests] = useState(['Technology', 'AI/ML', 'Product Design', 'Data Science'])
  return (
    <AppLayout>
      <div className="flex min-h-screen bg-[#F9F5FF]">
        <div className="flex-1 pt-8 md:pt-12 px-4 md:px-36 pb-20">
          <div className="mb-8 md:mb-10"><h1 className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Settings</h1><p className="text-sm text-[#8B898E]">Manage your account and career preferences</p></div>
          <div className="max-w-[600px]">
            <p className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-6">PROFILE</p>
            <div className="space-y-5">
              {[{ icon: User, label: 'Full Name', key: 'name' as const, type: 'text' }, { icon: Mail, label: 'Email Address', key: 'email' as const, type: 'email' }, { icon: Phone, label: 'Phone Number', key: 'phone' as const, type: 'tel' }, { icon: Briefcase, label: 'Current Role', key: 'role' as const, type: 'text' }].map(({ icon: Icon, label, key, type }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#8B898E] mb-2"><Icon size={14} /> {label}</label>
                  <input type={type} value={profile[key]} onChange={(e) => setProfile(p => ({ ...p, [key]: e.target.value }))} className="w-full py-3 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors" />
                </div>
              ))}
              <button className="flex items-center gap-2 py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors"><Save size={16} /> Save Changes</button>
            </div>
            <div className="mt-12">
              <p className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-6">CAREER INTERESTS</p>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, i) => (<span key={i} className="py-2 px-4 rounded-full bg-[#F9F5FF] border border-[#EDE3FF] text-sm font-semibold text-[#6B26EA]">{interest}</span>))}
              </div>
              <p className="text-xs text-[#A8A8A8] mt-3">These interests are used by our AI to match you with relevant opportunities.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}