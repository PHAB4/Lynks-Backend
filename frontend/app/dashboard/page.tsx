'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Map, Briefcase, MessageSquare, FileText, Bell, ChevronRight, ArrowRight, TrendingUp, BookOpen } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'
import { getProfile, getOpportunities, getUnreadNotificationCount, getPortfolio, DashboardProfile } from '@/lib/dashboard-api'
import { getRoadmap, Roadmap } from '@/lib/roadmap-api'
import { supabase } from '@/lib/supabase'
export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roadmapProgress, setRoadmapProgress] = useState({ percent: 0, total: 0, completed: 0 })
  const [recentOpportunities, setRecentOpportunities] = useState<Array<{ id: string; title: string; company: string; location: string; category: string; salary_min: number | null; salary_max: number | null; salary_currency: string | null }>>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [portfolioTasks, setPortfolioTasks] = useState(0)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [profileData, roadmap, opps, notifications, portfolio] = await Promise.allSettled([
          getProfile(),
          getRoadmap(),
          getOpportunities({ limit: 3 }),
          getUnreadNotificationCount(),
          getPortfolio(),
        ])

        if (profileData.status === 'fulfilled') {
          setProfile(profileData.value as DashboardProfile)
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            router.push('/login')
            return
          }
          setProfile({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            age: null,
            country: null,
            education_level: null,
            career_path: null,
            employment_status: null,
            interests: null,
            created_at: new Date().toISOString(),
          })
        }

        if (roadmap.status === 'fulfilled' && roadmap.value) {
          const roadmapData = roadmap.value as Roadmap
          const allTasks = roadmapData.steps?.flatMap((s) => s.tasks ?? []) ?? []
          const completedTasks = allTasks.filter((t) => t.status === 'complete').length
          setRoadmapProgress({
            percent: allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0,
            total: allTasks.length,
            completed: completedTasks,
          })
        }

        if (opps.status === 'fulfilled') {
          setRecentOpportunities(opps.value.opportunities?.slice(0, 3) || [])
        }

        if (notifications.status === 'fulfilled') {
          setUnreadCount(notifications.value.unread_count || 0)
        }

        if (portfolio.status === 'fulfilled') {
          setPortfolioTasks(Array.isArray(portfolio.value) ? portfolio.value.length : 0)
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Not authenticated') {
          router.push('/login')
          return
        }
      }
      setLoading(false)
    }

    loadDashboard()
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
  const initials = (profile?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE] overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="mb-8">
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
                <div className="mb-3">
                  <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-1">Career Path</p>
                  {profile?.career_path ? (
                    <p className="text-[13px] text-[#0D0026] font-medium">{profile.career_path}</p>
                  ) : (
                    <button onClick={() => router.push('/settings')} className="text-[13px] text-[#6B26EA] hover:underline cursor-pointer">
                      + Add career path
                    </button>
                  )}
                </div>
                {profile?.employment_status && (
                  <div className="mb-3">
                    <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-1">Role</p>
                    <p className="text-[13px] text-[#0D0026]">{profile.employment_status}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-2">Interests</p>
                  {profile?.interests && profile.interests.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map((interest: string) => (
                        <span key={interest} className="py-1 px-2.5 rounded-full bg-[#F7F3FE] text-[11px] text-[#6B26EA] font-medium">
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => router.push('/settings')} className="text-[13px] text-[#6B26EA] hover:underline cursor-pointer">
                      + Add interests
                    </button>
                  )}
                </div>
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
                    { label: 'Roadmap Progress', value: `${roadmapProgress.percent}%`, sub: roadmapProgress.total > 0 ? `${roadmapProgress.completed}/${roadmapProgress.total} tasks` : 'Start your journey' },
                    { label: 'Tasks Completed', value: String(roadmapProgress.completed), sub: roadmapProgress.total > 0 ? `of ${roadmapProgress.total} total` : 'Complete your first task' },
                    { label: 'Opportunities Saved', value: String(portfolioTasks), sub: 'Browse opportunities' },
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
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-[#6B26EA] text-white rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
                  )}
                </p>
                {unreadCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-2">
                    <Bell size={16} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] text-[#8B898E]">No new notifications</p>
                  <p className="text-[11px] text-[#D1D5DB] mt-0.5">We&apos;ll let you know when something comes up</p>
                </div>
                ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-2">
                    <Bell size={16} className="text-[#6B26EA]" />
                  </div>
                  <p className="text-[13px] text-[#0D0026] font-medium">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
                </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gradient-to-br from-[#6B26EA] to-[#4C1D95] rounded-2xl p-6 text-white">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Map size={18} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold mb-0.5">Your Roadmap</p>
                    <p className="text-[13px] text-white/70">{roadmapProgress.total > 0 ? `${roadmapProgress.completed} of ${roadmapProgress.total} tasks completed` : 'No roadmap yet — generate one to get started'}</p>
                  </div>
                </div>
                {roadmapProgress.total > 0 ? (
                  <div>
                    <div className="w-full bg-white/20 rounded-full h-2.5 mb-3">
                      <div className="bg-white rounded-full h-2.5 transition-all" style={{ width: `${roadmapProgress.percent}%` }} />
                    </div>
                    <button onClick={() => router.push('/roadmap')} className="text-[13px] font-semibold text-white/90 hover:text-white flex items-center gap-1 transition-colors">
                      View roadmap <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => router.push('/roadmap')} className="text-[13px] font-semibold text-white/90 hover:text-white flex items-center gap-1 transition-colors">
                    Generate roadmap <ArrowRight size={14} />
                  </button>
                )}
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
                  {recentOpportunities.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-[13px] text-[#8B898E]">No opportunities found yet.</p>
                      <button onClick={() => router.push('/opportunities')} className="text-[12px] text-[#6B26EA] font-semibold mt-1 hover:underline">Browse opportunities</button>
                    </div>
                  ) : recentOpportunities.map((opp) => (
                    <div key={opp.id} onClick={() => router.push('/opportunities')} className="flex items-center gap-3 p-3 rounded-xl border border-[rgba(30,30,30,0.05)] hover:bg-[#F7F3FE] transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-[#EADFFF] flex items-center justify-center shrink-0">
                        <Briefcase size={16} className="text-[#6B26EA]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0D0026] truncate">{opp.title}</p>
                        <p className="text-[11px] text-[#8B898E]">{opp.company} · {opp.location}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {opp.salary_min && (
                          <p className="text-[12px] font-semibold text-[#6B26EA]">
                            {opp.salary_currency || '$'}{opp.salary_min.toLocaleString()}
                            {opp.salary_max ? ` - ${opp.salary_max.toLocaleString()}` : ''}
                          </p>
                        )}
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
