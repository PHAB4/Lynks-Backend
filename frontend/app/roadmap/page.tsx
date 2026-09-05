'use client'

import { useState, useEffect } from 'react'
import { Map, Loader2, Sparkles } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'
import { getRoadmap, generateRoadmap, type Roadmap } from '@/lib/roadmap-api'
import { fetchAPI } from '@/lib/api'

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState<string | null>(null)

  useEffect(() => {
    loadRoadmap()
  }, [])

  useEffect(() => {
    if (roadmap?.steps && roadmap.steps.length > 0 && !activeStep) {
      const sorted = [...roadmap.steps].sort((a, b) => a.order - b.order)
      const inProgress = sorted.find(s => s.status === 'pending' && s.tasks?.some(t => t.status === 'pending'))
      setActiveStep(inProgress?.step_id || sorted[0].step_id)
    }
  }, [roadmap, activeStep])

  const loadRoadmap = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getRoadmap()
      setRoadmap(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      try {
        const profile = await fetchAPI<{ career_path?: string; education_level?: string; country?: string }>('/profile')
        const missing: string[] = []
        if (!profile.career_path) missing.push('career path')
        if (!profile.education_level) missing.push('education level')
        if (!profile.country) missing.push('country')
        if (missing.length > 0) {
          setError(`Your profile is missing: ${missing.join(', ')}. Please complete your onboarding or update your profile in Settings.`)
          setGenerating(false)
          return
        }
      } catch {}

      const data = await generateRoadmap()
      setRoadmap(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate roadmap'
      if (msg.includes('profile_incomplete') || msg.includes('Not authenticated')) {
        setError('Your profile is missing required fields (career path, education level, and/or country). Please complete your onboarding or update your profile in Settings.')
      } else {
        setError(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const sortedSteps = roadmap?.steps ? [...roadmap.steps].sort((a, b) => a.order - b.order) : []

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE] overflow-hidden">
        <div className="flex h-[calc(100vh-64px)]">
          {/* Left panel — winding path */}
          <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
            <div className="flex flex-col items-center py-8 px-4">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  Roadmap
                </h1>
                <p className="text-[13px] text-[#8B898E] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Tap a step to see what's inside
                </p>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 mb-6 max-w-md">
                  <p className="text-[13px] text-[#D14444]">{error}</p>
                </div>
              )}

              {!loading && !roadmap && !generating && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center mb-4">
                    <Map size={24} className="text-[#6B26EA]" />
                  </div>
                  <p className="text-lg font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    No roadmap yet
                  </p>
                  <p className="text-sm text-[#8B898E] max-w-md mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Let LYNKS AI create a personalized career roadmap based on your profile.
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 py-3 px-8 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors"
                  >
                    <Sparkles size={16} />
                    Generate My Roadmap
                  </button>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 size={32} className="text-[#6B26EA] animate-spin mb-4" />
                  <p className="text-[15px] font-semibold text-[#0D0026] mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Generating your roadmap...
                  </p>
                  <p className="text-[13px] text-[#8B898E]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    This takes 5-15 seconds. LYNKS is creating a personalized plan for you.
                  </p>
                </div>
              )}

              {!loading && roadmap && !generating && (
                <div className="relative w-full max-w-[540px] mt-8">
                  <div className="relative">
                    {(() => {
                      let globalIndex = 0
                      return sortedSteps.map((step, stepIndex) => {
                        const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
                        const totalCount = step.tasks?.length || 0
                        const allComplete = totalCount > 0 && completedCount === totalCount
                        const isActive = activeStep === step.step_id
                        const isPast = allComplete
                        const sortedTasks = step.tasks ? [...step.tasks].sort((a, b) => a.order - b.order) : []

                        const nodes: React.ReactNode[] = []

                        // Step title ABOVE the node
                        const stepGlobalIdx = globalIndex
                        const stepIsLeft = stepGlobalIdx % 2 === 0
                        const stepMarginLeft = stepIsLeft ? '0%' : '25%'
                        const stepMarginRight = stepIsLeft ? '25%' : '0%'
                        globalIndex++

                        nodes.push(
                          <div key={`step-title-${step.step_id}`} style={{ marginLeft: stepMarginLeft, marginRight: stepMarginRight }} className="flex justify-center mb-1.5">
                            <span className={cn(
                              'text-[12px] font-semibold text-center leading-tight',
                              isActive ? 'text-[#6B26EA]' : isPast ? 'text-[#22C55E]' : 'text-[#8B898E]'
                            )}>
                              {step.title}
                            </span>
                          </div>
                        )

                        // Step node (big 3D ellipse)
                        nodes.push(
                          <div key={`step-node-${step.step_id}`} style={{ marginLeft: stepMarginLeft, marginRight: stepMarginRight }} className="flex justify-center mb-1">
                            <button
                              onClick={() => setActiveStep(step.step_id)}
                              className={cn(
                                'relative flex items-center justify-center transition-all duration-300 cursor-pointer group',
                                isActive && 'scale-110',
                              )}
                              style={{
                                width: '100px',
                                height: '38px',
                                borderRadius: '50%',
                                background: isPast
                                  ? 'linear-gradient(180deg, #34D673 0%, #1BA84E 100%)'
                                  : 'linear-gradient(180deg, #9B5CFF 0%, #6B26EA 50%, #4A10B8 100%)',
                                boxShadow: isPast
                                  ? '0 4px 0 #148A3D, 0 6px 12px rgba(34,197,94,0.35), inset 0 1px 1px rgba(255,255,255,0.25)'
                                  : '0 4px 0 #3A0E8C, 0 6px 12px rgba(107,38,234,0.4), inset 0 1px 1px rgba(255,255,255,0.3)',
                                transform: isActive ? 'scale(1.1) translateY(-2px)' : 'none',
                              }}
                            >
                              <span className="text-white text-[14px] font-bold drop-shadow-sm" style={{ fontFamily: "'Inter', sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                                {stepIndex + 1}
                              </span>
                            </button>
                          </div>
                        )

                        // Task nodes (smaller circles)
                        sortedTasks.forEach((task, taskIndex) => {
                          const taskDone = task.status === 'complete'
                          const taskGlobalIdx = globalIndex
                          const taskIsLeft = taskGlobalIdx % 2 === 0
                          const taskMarginLeft = taskIsLeft ? '5%' : '20%'
                          const taskMarginRight = taskIsLeft ? '20%' : '5%'
                          globalIndex++

                          nodes.push(
                            <div key={`task-${task.task_id}`} className="relative" style={{ marginBottom: taskIndex < sortedTasks.length - 1 ? '10px' : '0' }}>
                              {/* Connector line from above */}
                              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-10px', height: '10px' }}>
                                <svg width="2" height="10" className="overflow-visible">
                                  <line x1="1" y1="0" x2="1" y2="10" stroke={taskDone ? '#22C55E' : '#EDE3FF'} strokeWidth="1.5" strokeDasharray={taskDone ? 'none' : '3 3'} />
                                </svg>
                              </div>

                              <div style={{ marginLeft: taskMarginLeft, marginRight: taskMarginRight }} className={cn('flex items-center gap-3', taskIsLeft ? 'justify-start' : 'justify-end')}>
                                {!taskIsLeft && (
                                  <span className={cn('text-[13px] font-medium leading-snug text-right', taskDone ? 'text-[#22C55E]' : 'text-[#4A3572]')}>
                                    {task.title}
                                  </span>
                                )}
                                <div
                                  className="shrink-0 flex items-center justify-center rounded-full"
                                  style={{
                                    width: '46px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: taskDone
                                      ? 'linear-gradient(180deg, #34D673 0%, #22C55E 100%)'
                                      : 'linear-gradient(180deg, #C8B0FF 0%, #9B7AD8 100%)',
                                    boxShadow: taskDone
                                      ? '0 3px 0 #148A3D, 0 4px 8px rgba(34,197,94,0.25), inset 0 1px 0 rgba(255,255,255,0.3)'
                                      : '0 3px 0 #7A5AB0, 0 4px 8px rgba(155,122,216,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
                                  }}
                                >
                                  {taskDone ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.15)' }}>✓</span>
                                  )}
                                </div>
                                {taskIsLeft && (
                                  <span className={cn('text-[13px] font-medium leading-snug text-left', taskDone ? 'text-[#22C55E]' : 'text-[#4A3572]')}>
                                    {task.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })

                        // Connector line to next step
                        if (stepIndex < sortedSteps.length - 1) {
                          nodes.push(
                            <div key={`connector-${step.step_id}`} className="flex justify-center" style={{ marginTop: '10px', marginBottom: '10px' }}>
                              <svg width="2" height="40" className="overflow-visible">
                                <line x1="1" y1="0" x2="1" y2="40" stroke={isPast ? '#22C55E' : '#EDE3FF'} strokeWidth="2" strokeDasharray={isPast ? 'none' : '4 4'} />
                              </svg>
                            </div>
                          )
                        }

                        return nodes
                      })
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
