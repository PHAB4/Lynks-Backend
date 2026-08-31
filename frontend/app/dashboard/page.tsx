'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Map, Briefcase, MessageSquare, FileText, Bell, ChevronRight, Sparkles, ArrowRight, TrendingUp, BookOpen } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

interface UserProfile {
  name: string
  email: string
  interests: string[]
  employment_status: string
  phone: string
}

const RECENT_OPPORTUNITIES = [
  { id: 1, title: 'Senior Frontend Developer', company: 'TechCorp Inc.', location: 'San Francisco, CA', salary: '$120k - $160k', category: 'Software Engineering' },
  { id: 2, title: 'Data Scientist', company: 'DataFlow Analytics', location: 'New York, NY (Remote)', salary: '$100k - $130k', category: 'Data Science' },
  { id: 3, title: 'UX Designer', company: 'DesignStudio', location: 'Los Angeles, CA (Remote)', salary: '$85k - $110k', category: 'UX Design' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        router.push('/login')
        return
      }
      const user = session.user
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (data) {
        setProfile({
          name: data.name || user.email?.split('@')[0] || 'there',
          email: data.email || user.email || '',
          interests: data.interests || [],
          employment_status: data.employment_status || '',
          phone: data.phone || '',
        })
      } else {
        setProfile({ name: user.email?.split('@')[0] || 'there', email: user.email || '', interests: [], employment_status: '', phone: '' })
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen bg-[#F7F3FE]">
          <div className="w-8 h-8 border-2 border-[#6B26EA] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const initials = (profile?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE] overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="mb-8">
            <p className="text-sm text-[#8B898E] mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>{greeting}</p>
            <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Welcome, {profile?.name}
            </h1>
            <p className="text-sm text-[#8B898E] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              Here&apos;s what&apos;s happening in your career journey.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: MessageSquare, label: 'Chat with LYNKS', desc: 'Ask anything', href: '/chat', color: 'bg-[#EADFFF] text-[#6B26EA]' },
              { icon: Map, label: 'Your Roadmap', desc: 'Track progress', href: '/roadmap', color: 'bg-[#E0F2FE] text-[#0369A1]' },
              { icon: Briefcase, label: 'Opportunities', desc: 'Browse jobs', href: '/opportunities', color: 'bg-[#ECFDF5] text-[#059669]' },
              { icon: FileText, label: 'Your Resume', desc: 'View & export', href: '/resume', color: 'bg-[#FFF7ED] text-[#C2410C]' },
            ].map((action) => (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-[#EDE3FF] hover:shadow-[0_4px_16px_rgba(107,38,234,0.08)] hover:border-[#D4C4F7] transition-all text-left group"
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', action.color)}>
                  <action.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0D0026] truncate">{action.label}</p>
                  <p className="text-[11px] text-[#8B898E]">{action.desc}</p>
                </div>
                <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#6B26EA] transition-colors shrink-0" />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#EADFFF] flex items-center justify-center shrink-0">
                    <span className="text-[#6B26EA] font-bold text-sm">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#0D0026] truncate">{profile?.name}</p>
                    <p className="text-[12px] text-[#8B898E] truncate">{profile?.email}</p>
                  </div>
                </div>
                {profile?.employment_status && (
                  <div className="mb-3">
                    <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-1">Role</p>
                    <p className="text-[13px] text-[#0D0026]">{profile.employment_status}</p>
                  </div>
                )}
                {profile?.interests && profile.interests.length > 0 && (
                  <div>
                    <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-2">Interests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map((interest: string) => (
                        <span key={interest} className="py-1 px-2.5 rounded-full bg-[#F7F3FE] text-[11px] text-[#6B26EA] font-medium">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full mt-4 py-2 rounded-xl border border-[#EDE3FF] text-[13px] text-[#6B26EA] font-semibold hover:bg-[#F7F3FE] transition-colors"
                >
                  Edit Profile
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
                <p className="text-[13px] font-semibold text-[#0D0026] mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-[#6B26EA]" />
                  Quick Stats
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'Roadmap Progress', value: '0%', sub: 'Start your journey' },
                    { label: 'Tasks Completed', value: '0', sub: 'Complete your first task' },
                    { label: 'Opportunities Viewed', value: '0', sub: 'Browse opportunities' },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between py-2 border-b border-[rgba(30,30,30,0.05)] last:border-0">
                      <div>
                        <p className="text-[13px] text-[#0D0026] font-medium">{stat.label}</p>
                        <p className="text-[11px] text-[#8B898E]">{stat.sub}</p>
                      </div>
                      <span className="text-[18px] font-bold text-[#6B26EA]">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
                <p className="text-[13px] font-semibold text-[#0D0026] mb-3 flex items-center gap-2">
                  <Bell size={14} className="text-[#6B26EA]" />
                  Notifications
                </p>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-2">
                    <Bell size={16} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] text-[#8B898E]">No new notifications</p>
                  <p className="text-[11px] text-[#D1D5DB] mt-0.5">We&apos;ll let you know when something comes up</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gradient-to-br from-[#6B26EA] to-[#4C1D95] rounded-2xl p-6 text-white">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold mb-0.5">Getting Started with LYNKS</p>
                    <p className="text-[13px] text-white/70">Complete these steps to unlock your personalized experience</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Complete your onboarding profile', done: !!profile?.employment_status },
                    { label: 'Start a conversation with LYNKS AI', done: false },
                    { label: 'Generate your career roadmap', done: false },
                    { label: 'Browse available opportunities', done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/10">
                      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                        step.done ? 'bg-white text-[#6B26EA]' : 'border border-white/30 text-white/60'
                      )}>
                        {step.done ? '✓' : i + 1}
                      </div>
                      <p className={cn('text-[13px]', step.done ? 'text-white/60 line-through' : 'text-white')}>{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-[#0D0026] flex items-center gap-2">
                    <Briefcase size={14} className="text-[#6B26EA]" />
                    Recent Opportunities
                  </p>
                  <button
                    onClick={() => router.push('/opportunities')}
                    className="text-[12px] text-[#6B26EA] font-semibold flex items-center gap-1 hover:underline"
                  >
                    View all <ArrowRight size={12} />
                  </button>
                </div>
                <div className="space-y-3">
                  {RECENT_OPPORTUNITIES.map((opp) => (
                    <div key={opp.id} className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(30,30,30,0.05)] hover:bg-[#F7F3FE] transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <Briefcase size={16} className="text-[#6B26EA]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0D0026] truncate">{opp.title}</p>
                        <p className="text-[11px] text-[#8B898E]">{opp.company} · {opp.location}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold text-[#6B26EA]">{opp.salary}</p>
                        <p className="text-[10px] text-[#D1D5DB]">{opp.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EADFFF] flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="text-[#6B26EA]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0D0026] mb-1">Career Tip</p>
                    <p className="text-[13px] text-[#8B898E] leading-relaxed">
                      Start by chatting with LYNKS AI — it can help you identify your strengths, map out a career path, and find opportunities tailored to your goals. Just click &quot;Chat with LYNKS&quot; above to begin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
