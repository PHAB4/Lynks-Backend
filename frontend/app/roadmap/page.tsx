'use client'

import { useState, useEffect } from 'react'
import { Map } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

const phases = [
  { name: 'Self Assessment', color: '#9E97C9' },
  { name: 'Skill Building', color: '#9E97C9' },
  { name: 'Resume Polish', color: '#000', status: 'In Progress' },
  { name: 'Networking', color: '#62598F' },
  { name: 'Apply & Interview', color: '#62598F' },
]

const steps = [
  { id: 1, phase: 0, label: 'Career Assessment' },
  { id: 2, phase: 0, label: 'Skills Inventory' },
  { id: 3, phase: 0, label: 'Interest Mapping' },
  { id: 4, phase: 1, label: 'Learn Fundamentals' },
  { id: 5, phase: 1, label: 'Build Projects' },
  { id: 6, phase: 1, label: 'Get Certified' },
  { id: 7, phase: 2, label: 'Draft Resume' },
  { id: 8, phase: 2, label: 'Portfolio Review' },
  { id: 9, phase: 3, label: 'Build Network' },
  { id: 10, phase: 3, label: 'Attend Events' },
  { id: 11, phase: 3, label: 'Find Mentors' },
  { id: 12, phase: 4, label: 'Apply to Jobs' },
  { id: 13, phase: 4, label: 'Interview Prep' },
  { id: 14, phase: 4, label: 'Negotiate Offer' },
]

export default function RoadmapPage() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [userName, setUserName] = useState('')
  const totalSteps = steps.length

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('name').eq('id', user.id).single()
        if (data?.name) setUserName(data.name)
      }
    }
    load()
  }, [])

  const toggleStep = (id: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const currentPhase = phases.findIndex(p => p.status === 'In Progress')

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#F9F5FF]">
        {/* Main roadmap area */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="flex items-start justify-center min-h-full py-12 px-8">
            {/* Roadmap path container */}
            <div className="relative w-full max-w-[700px] min-h-[700px]">
              {steps.map((step, i) => {
                const row = Math.floor(i / 2)
                const isRight = i % 2 === 1
                const done = completedSteps.has(step.id)

                const positions = [
                  { left: '15%', top: '92%' },
                  { left: '65%', top: '84%' },
                  { left: '15%', top: '75%' },
                  { left: '65%', top: '67%' },
                  { left: '15%', top: '58%' },
                  { left: '65%', top: '50%' },
                  { left: '15%', top: '42%' },
                  { left: '65%', top: '34%' },
                  { left: '15%', top: '25%' },
                  { left: '65%', top: '18%' },
                  { left: '15%', top: '10%' },
                  { left: '65%', top: '3%' },
                  { left: '35%', top: '-5%' },
                  { left: '65%', top: '-12%' },
                ]

                const pos = positions[i] || { left: '50%', top: `${90 - i * 7}%` }

                return (
                  <button
                    key={step.id}
                    onClick={() => toggleStep(step.id)}
                    style={{ left: pos.left, top: pos.top }}
                    className={cn(
                      'absolute flex flex-col items-center gap-1 transition-all duration-300 group',
                      done && 'opacity-70'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300',
                      done
                        ? 'bg-[#6B26EA] border-[#6B26EA] text-white'
                        : 'bg-white border-[#EDE3FF] text-[#0D0026] group-hover:border-[#6B26EA]'
                    )}>
                      {step.id}
                    </div>
                    <p className={cn(
                      'text-[10px] font-semibold whitespace-nowrap transition-colors',
                      done ? 'text-[#6B26EA]' : 'text-[#0D0026] group-hover:text-[#6B26EA]'
                    )}>
                      {step.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Steps sidebar */}
        <div className="hidden lg:flex flex-col w-[300px] bg-[#F0EFF2] shrink-0 p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-lg font-semibold text-[#000]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Steps</p>
            <div className="py-0.5 px-2 rounded bg-[rgba(139,92,246,0.13)]">
              <p className="text-[#8B5CF6] text-[9px] font-bold">{completedSteps.size}/{totalSteps} DONE</p>
            </div>
          </div>
          <div className="h-px bg-[#2C224D] mb-3 w-full" />
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {phases.map((phase, i) => (
              <div key={i}>
                <div className={cn(
                  'py-2.5 px-2 rounded-lg',
                  i === currentPhase && 'bg-white'
                )}>
                  <p className={cn(
                    'text-xs line-clamp-1',
                    i < currentPhase && 'text-[#9E97C9] font-medium',
                    i === currentPhase && 'text-[#000] font-bold',
                    i > currentPhase && 'text-[#62598F] font-medium'
                  )}>
                    {i + 1}. {phase.name}
                  </p>
                  {phase.status && (
                    <p className="text-[#8B5CF6] text-[9px] font-semibold mt-0.5">{phase.status}</p>
                  )}
                </div>
                {i < phases.length - 1 && <div className="opacity-50 h-px bg-[#2C224D] w-full my-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
