'use client'

import { useState } from 'react'
import { Map, ArrowLeft, ArrowRight, CheckCircle2, Clock, Zap } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'

const ROADMAP_DATA = [
  { phase: 'Phase 1', title: 'Foundation Building', status: 'completed', weeks: 'Weeks 1-4', tasks: ['Complete career assessment', 'Build professional resume', 'Set up LinkedIn profile', 'Identify target companies'] },
  { phase: 'Phase 2', title: 'Skill Development', status: 'current', weeks: 'Weeks 5-8', tasks: ['Complete online certifications', 'Build portfolio projects', 'Practice interview questions', 'Network with professionals'] },
  { phase: 'Phase 3', title: 'Active Job Search', status: 'upcoming', weeks: 'Weeks 9-12', tasks: ['Apply to target positions', 'Prepare for interviews', 'Follow up on applications', 'Negotiate offers'] },
  { phase: 'Phase 4', title: 'Career Launch', status: 'upcoming', weeks: 'Weeks 13-16', tasks: ['Onboard at new company', 'Set 90-day goals', 'Build internal network', 'Plan first year milestones'] },
]

export default function RoadmapPage() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-surface-alt">
        <div className="flex-1 p-10">
          <div className="flex items-center gap-3 mb-8"><Map className="text-primary" size={24} /><h1 className="text-[40px] font-semibold leading-[50px] text-text-primary">Career Roadmap</h1></div>
          <div className="flex flex-col gap-6 max-w-[900px]">
            {ROADMAP_DATA.map((phase, i) => (
              <div key={i} className={cn('flex gap-6 p-6 rounded-2xl border transition-all', phase.status === 'completed' ? 'border-green-200 bg-green-50/50' : phase.status === 'current' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-surface')}>
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', phase.status === 'completed' ? 'bg-green-100 text-green-600' : phase.status === 'current' ? 'bg-primary text-white' : 'bg-surface-alt text-text-muted')}>
                    {phase.status === 'completed' ? <CheckCircle2 size={20} /> : phase.status === 'current' ? <Zap size={20} /> : <Clock size={20} />}
                  </div>
                  {i < ROADMAP_DATA.length - 1 && <div className={cn('w-0.5 h-full min-h-[40px] mt-2', phase.status === 'completed' ? 'bg-green-200' : 'bg-border')} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-text-faint tracking-widest">{phase.phase}</span><span className="text-xs text-text-muted">• {phase.weeks}</span></div>
                  <h3 className="text-lg font-semibold text-text-primary mb-3">{phase.title}</h3>
                  <div className="flex flex-col gap-2">{phase.tasks.map((task, j) => (
                    <div key={j} className="flex items-center gap-2"><div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', phase.status === 'completed' ? 'border-green-400 bg-green-400' : 'border-border')}>{phase.status === 'completed' && <CheckCircle2 size={12} className="text-white" />}</div><span className={cn('text-sm', phase.status === 'completed' ? 'text-text-muted line-through' : 'text-text-primary')}>{task}</span></div>
                  ))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}