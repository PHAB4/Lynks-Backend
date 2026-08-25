'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Phone, Briefcase, Save, X, Plus } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

const ALL_INTERESTS = ['Technology', 'Design', 'Business', 'Healthcare', 'Education', 'Finance', 'Marketing', 'Engineering', 'Data Science', 'AI/ML']

export default function SettingsPage() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', role: '' })
  const [interests, setInterests] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        if (data) {
          setProfile({
            name: data.name || '',
            email: data.email || user.email || '',
            phone: data.phone || '',
            role: data.employment_status || '',
          })
          setInterests(data.interests || [])
        }
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({
        name: profile.name,
        phone: profile.phone,
        employment_status: profile.role,
        interests: interests,
      }).eq('id', user.id)
    }
    localStorage.setItem('lynks_user', JSON.stringify({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      interests,
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const removeInterest = (interest: string) => {
    setInterests(prev => prev.filter(i => i !== interest))
  }

  const addInterest = (interest: string) => {
    if (interest && !interests.includes(interest)) {
      setInterests(prev => [...prev, interest])
      setNewInterest('')
    }
  }

  return (
    <AppLayout>
      <div className="flex min-h-screen bg-[#F9F5FF]">
        <div className="flex-1 pt-8 md:pt-12 px-4 md:px-36 pb-20">
          <div className="mb-8 md:mb-10">
            <h1 className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Settings</h1>
            <p className="text-sm text-[#8B898E]">Manage your account and career preferences</p>
          </div>
          <div className="max-w-[600px]">
            <p className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-6">PROFILE</p>
            <div className="space-y-5">
              {[{ icon: User, label: 'Full Name', key: 'name' as const, type: 'text' }, { icon: Mail, label: 'Email Address', key: 'email' as const, type: 'email' }, { icon: Phone, label: 'Phone Number', key: 'phone' as const, type: 'tel' }, { icon: Briefcase, label: 'Current Role', key: 'role' as const, type: 'text' }].map(({ icon: Icon, label, key, type }) => (
                <div key={key}>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#8B898E] mb-2"><Icon size={14} /> {label}</label>
                  <input type={type} value={profile[key]} onChange={(e) => setProfile(p => ({ ...p, [key]: e.target.value }))} className="w-full py-3 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors" />
                </div>
              ))}
              <button onClick={handleSave} className="flex items-center gap-2 py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors">
                <Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>

            {/* Editable interests */}
            <div className="mt-12">
              <p className="text-xs font-bold text-[rgba(0,0,0,0.50)] tracking-widest mb-6">CAREER INTERESTS</p>

              {/* Current interests */}
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {interests.map((interest, i) => (
                    <span key={i} className="flex items-center gap-1.5 py-2 px-4 rounded-full bg-[#6B26EA] text-white text-sm font-semibold">
                      {interest}
                      <button onClick={() => removeInterest(interest)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add from presets */}
              <p className="text-xs text-[#8B898E] mb-3">Add interests:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_INTERESTS.filter(i => !interests.includes(i)).map((interest) => (
                  <button key={interest} onClick={() => addInterest(interest)} className="flex items-center gap-1 py-2 px-4 rounded-full border border-[#EDE3FF] bg-white text-sm text-[#0D0026] hover:border-[#6B26EA] hover:text-[#6B26EA] transition-colors">
                    <Plus size={12} /> {interest}
                  </button>
                ))}
              </div>

              {/* Add custom interest */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(newInterest) } }}
                  placeholder="Add custom interest..."
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors"
                />
                <button onClick={() => addInterest(newInterest)} disabled={!newInterest.trim()} className="py-2.5 px-4 rounded-xl bg-[#EADFFF] text-[#6B26EA] text-sm font-semibold hover:bg-[#D4C4F7] transition-colors disabled:opacity-40">
                  Add
                </button>
              </div>

              <p className="text-xs text-[#A8A8A8] mt-3">These interests are used by our AI to match you with relevant opportunities.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
