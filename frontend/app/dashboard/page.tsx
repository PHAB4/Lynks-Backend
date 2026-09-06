'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Map, Briefcase, Bell, ArrowRight, TrendingUp, BookOpen } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { getDashboardSummary, DashboardSummary } from '@/lib/dashboard-api'

export default function DashboardPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboardSummary()
        setSummary(data)
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

  const profile = summary?.profile
  const roadmap = summary?.roadmap
  const opps = summary?.opportunities
  const notifs = summary?.notifications
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
                {profile?.role && (
                  <div className="mb-3">
                    <p className="text-[11px] text-[#8B898E] uppercase tracking-wider font-semibold mb-1">Role</p>
                    <p className="text-[13px] text-[#0D0026]">{profile.role}</p>
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
                    { label: 'Roadmap Progress', value: `${roadmap?.progress_percent ?? 0}%`, sub: (roadmap?.total_tasks ?? 0) > 0 ? `${roadmap?.completed_tasks}/${roadmap?.total_tasks} tasks` : 'Start your journey' },
                    { label: 'Tasks Completed', value: String(roadmap?.completed_tasks ?? 0), sub: (roadmap?.total_tasks ?? 0) > 0 ? `of ${roadmap?.total_tasks} total` : 'Complete your first task' },
                    { label: 'Opportunities Available', value: String(opps?.new_count ?? 0), sub: 'Browse opportunities' },
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
                  {(notifs?.unread_count ?? 0) > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-[#6B26EA] text-white rounded-full w-5 h-5 flex items-center justify-center">{notifs?.unread_count}</span>
                  )}
                </p>
                {(notifs?.unread_count ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F7F3FE] flex items-center justify-center mb-2">
                    <Bell size={16} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] text-[#8B898E]">No new notifications</p>
                  <p className="text-[11px] text-[#D1D5DB] mt-0.5">We&apos;ll let you know when something comes up</p>
                </div>
                ) : (
                <div className="space-y-2">
                  {notifs?.recent?.slice(0, 3).map((n) => (
                    <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg bg-[#F9F5FF]">
                      <div className="w-2 h-2 rounded-full bg-[#6B26EA] mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#0D0026] truncate">{n.title}</p>
                        <p className="text-[11px] text-[#8B898E] truncate">{n.body}</p>
                      </div>
                    </div>
                  ))}
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
                    <p className="text-[13px] text-white/70">{(roadmap?.total_tasks ?? 0) > 0 ? `${roadmap?.completed_tasks} of ${roadmap?.total_tasks} tasks completed` : 'No roadmap yet — generate one to get started'}</p>
                  </div>
                </div>
                {(roadmap?.total_tasks ?? 0) > 0 ? (
                  <div>
                    <div className="w-full bg-white/20 rounded-full h-2.5 mb-3">
                      <div className="bg-white rounded-full h-2.5 transition-all" style={{ width: `${roadmap?.progress_percent ?? 0}%` }} />
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
                  {(!opps?.recent || opps.recent.length === 0) ? (
                    <div className="text-center py-6">
                      <p className="text-[13px] text-[#8B898E]">No opportunities found yet.</p>
                      <button onClick={() => router.push('/opportunities')} className="text-[12px] text-[#6B26EA] font-semibold mt-1 hover:underline">Browse opportunities</button>
                    </div>
                  ) : opps.recent.map((opp) => (
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
                            {opp.currency || '$'}{opp.salary_min.toLocaleString()}
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
