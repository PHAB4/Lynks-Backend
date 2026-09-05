'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Camera, X, Plus, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import SecurityTab from '@/components/SecurityTab'
import { useAuthGate } from '@/lib/use-auth'

const CAREER_INTERESTS = [
  'Frontend Engineering',
  'Backend Engineering',
  'AI & Machine Learning',
  'Data Analytics',
  'Career Strategy',
  'UX Design',
  'Product Management',
  'DevOps',
]

export default function SettingsPage() {
  const router = useRouter()
  const authChecked = useAuthGate()
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    careerPath: '',
  })
  const [interests, setInterests] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile')

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
            careerPath: data.career_path || '',
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
        career_path: profile.careerPath,
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

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const sidebarItems = [
    { key: 'profile', label: 'Profile' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
  ]

  if (!authChecked) return null

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F9F5FF]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex gap-10">

            {/* Sidebar Navigation */}
            <div className="w-[280px] shrink-0">
              <p className="text-xs text-[rgba(30,30,30,0.40)] mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Settings
              </p>
              <div className="space-y-1">
                {sidebarItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key as typeof activeTab)}
                    className={cn(
                      'flex items-center gap-3 w-full py-3 px-4 rounded-xl text-sm transition-all',
                      activeTab === item.key
                        ? 'bg-[rgba(107,38,234,0.08)] text-[#6B26EA]'
                        : 'text-[rgba(30,30,30,0.60)] hover:bg-[rgba(107,38,234,0.04)]'
                    )}
                  >
                    <div className="w-5 h-5">
                      {item.key === 'profile' && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M15.834 17.5V15.8333C15.834 14.9493 15.4828 14.1014 14.8576 13.4763C14.2324 12.8512 13.3845 12.5 12.5003 12.5H7.49973C6.61557 12.5 5.76763 12.8512 5.14244 13.4763C4.51725 14.1014 4.16602 14.9493 4.16602 15.8333V17.5M13.3337 5.83333C13.3337 7.67428 11.8412 9.16667 10 9.16667C8.15886 9.16667 6.6663 7.67428 6.6663 5.83333C6.6663 3.99238 8.15886 2.5 10 2.5C11.8412 2.5 13.3337 3.99238 13.3337 5.83333Z"
                            stroke={activeTab === item.key ? '#6B26EA' : 'rgba(30,30,30,0.4)'}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {item.key === 'notifications' && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M10 1.66699C6.5 1.66699 4.16667 4.16699 4.16667 7.50033V11.667L2.5 13.3337V14.167H17.5V13.3337L15.8333 11.667V7.50033C15.8333 4.16699 13.5 1.66699 10 1.66699Z"
                            stroke={activeTab === item.key ? '#6B26EA' : 'rgba(30,30,30,0.4)'}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {item.key === 'security' && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M10 1.66699L3.33333 5.00033V9.16699C3.33333 13.0003 6.125 16.5417 10 17.5003C13.875 16.5417 16.6667 13.0003 16.6667 9.16699V5.00033L10 1.66699Z"
                            stroke={activeTab === item.key ? '#6B26EA' : 'rgba(30,30,30,0.4)'}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {item.label}
                    </span>
                    {activeTab === item.key && (
                      <div className="ml-auto w-1 h-4 rounded-sm bg-[#6B26EA]" />
                    )}
                  </button>
                ))}
              </div>
              <div className="h-px bg-[rgba(30,30,30,0.07)] my-4" />
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 py-3 px-4 text-[#6B26EA] text-sm font-semibold hover:bg-[rgba(107,38,234,0.04)] rounded-xl transition-colors"
              >
                <ArrowLeft size={16} />
                <span style={{ fontFamily: "'Inter', sans-serif" }}>Back to Dashboard</span>
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-10 rounded-3xl bg-white shadow-[0_12px_32px_rgba(107,38,234,0.04)]">

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-[28px] font-semibold text-[#1E1E1E] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Profile Settings
                    </h1>
                    <p className="text-[15px] text-[rgba(30,30,30,0.60)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                      Update your personal details, professional biography, and target
                      career interests to fine-tune your roadmap.
                    </p>
                    <div className="h-px bg-[rgba(30,30,30,0.07)] mt-6" />
                  </div>

                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full bg-[rgba(154,152,152,0.20)] flex items-center justify-center overflow-hidden">
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="16" r="8" stroke="#9A9898" strokeWidth="2" />
                        <path d="M4 36C4 29.3726 9.37258 24 16 24H24C30.6274 24 36 29.3726 36 36V38H4V36Z" stroke="#9A9898" strokeWidth="2" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        <button className="py-2.5 px-4 rounded-[10px] bg-[#6B26EA] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#5A1FD0] transition-colors">
                          <Camera size={16} />
                          Upload new photo
                        </button>
                        <button className="py-2.5 px-4 rounded-[10px] border border-[rgba(30,30,30,0.12)] text-[rgba(30,30,30,0.80)] text-sm font-medium hover:bg-gray-50 transition-colors">
                          Remove
                        </button>
                      </div>
                      <p className="text-xs text-[rgba(30,30,30,0.40)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        JPG, GIF or PNG. Max size of 800K.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 mb-8">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                          className="w-full py-3.5 px-4 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                          className="w-full py-3.5 px-4 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                          className="w-full py-3.5 px-4 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                          placeholder="Enter your phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Current Role
                        </label>
                        <input
                          type="text"
                          value={profile.role}
                          onChange={(e) => setProfile(p => ({ ...p, role: e.target.value }))}
                          className="w-full py-3.5 px-4 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                          placeholder="Enter your current role"
                        />
                      </div>
                    </div>
                  </div>
                    <div>
                      <label className="block text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Career Path
                      </label>
                      <p className="text-[13px] text-[rgba(30,30,30,0.40)] mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Your target career direction — used to generate your personalized roadmap.
                      </p>
                      <input
                        type="text"
                        value={profile.careerPath}
                        onChange={(e) => setProfile(p => ({ ...p, careerPath: e.target.value }))}
                        className="w-full py-3.5 px-4 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                        placeholder="e.g. Software Engineering, UX Design, Data Science"
                      />
                    </div>

                    <div className="mb-8">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-[rgba(30,30,30,0.80)] mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Career of interest
                      </p>
                      <p className="text-[13px] text-[rgba(30,30,30,0.40)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        These tags help Lynk suggest tailored mentorships, tasks, and
                        opportunities in your backyard.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {CAREER_INTERESTS.map((interest) => {
                        const isActive = interests.includes(interest)
                        return (
                          <button
                            key={interest}
                            onClick={() => toggleInterest(interest)}
                            className={cn(
                              'flex items-center gap-2 py-2 px-4 rounded-[20px] text-[13px] font-medium transition-all',
                              isActive
                                ? 'bg-[#EDE3FF] text-[#6B26EA]'
                                : 'bg-[rgba(30,30,30,0.04)] text-[rgba(30,30,30,0.60)] hover:bg-[#EDE3FF] hover:text-[#6B26EA]'
                            )}
                            style={{ fontFamily: "'Inter', sans-serif" }}
                          >
                            {interest}
                            {isActive ? (
                              <X size={14} className="text-[#6B26EA]" />
                            ) : (
                              <Plus size={14} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="h-px bg-[rgba(30,30,30,0.07)] mb-6" />
                  <div className="flex justify-end gap-3">
                    <button className="py-3 px-6 rounded-[50px] border border-[rgba(30,30,30,0.20)] text-[rgba(30,30,30,0.80)] text-sm font-medium hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className={cn(
                        'py-3 px-6 rounded-[20px] text-sm font-semibold transition-all',
                        saved
                          ? 'bg-green-500 text-white'
                          : 'bg-[#EADFFF] text-[#000] border border-[rgba(0,0,0,0.43)] hover:bg-[#D4C4F7]'
                      )}
                    >
                      {saved ? (
                        <span className="flex items-center gap-2">
                          <Check size={16} />
                          Saved!
                        </span>
                      ) : 'Continue'}
                    </button>
                  </div>
                </>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && <SecurityTab />}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div>
                  <h1 className="text-[28px] font-semibold text-[#1E1E1E] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Notification Settings
                  </h1>
                  <p className="text-[15px] text-[rgba(30,30,30,0.60)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Manage how and when you receive notifications from Lynks.
                  </p>
                  <div className="h-px bg-[rgba(30,30,30,0.07)] mt-6 mb-8" />
                  <p className="text-sm text-[rgba(30,30,30,0.40)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Notification settings coming soon.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
