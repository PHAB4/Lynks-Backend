'use client'

import { useState, useEffect, useRef } from 'react'
import { Map, Loader2, RefreshCw, CheckCircle2, Circle, Sparkles, ChevronDown, ChevronRight, Lock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'
import { getRoadmap, generateRoadmap, regenerateRoadmap, type Roadmap, type RoadmapStep } from '@/lib/roadmap-api'
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
        const profile = await fetchAPI('/profile')
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

  const handleRegenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const data = await regenerateRoadmap()
      setRoadmap(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate roadmap')
    } finally {
      setGenerating(false)
    }
  }

  const allTasks = roadmap?.steps?.flatMap((s) => s.tasks || []) || []
  const completedTasks = allTasks.filter((t) => t.status === 'complete').length
  const totalTasks = allTasks.length

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
                  Steps
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
                <div className="relative w-full max-w-[500px]">
                  {/* Winding path visualization */}
                  <div className="relative">
                    {sortedSteps.map((step, index) => {
                      const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
                      const totalCount = step.tasks?.length || 0
                      const allComplete = totalCount > 0 && completedCount === totalCount
                      const isActive = activeStep === step.step_id
                      const isPast = allComplete

                      // Alternate left/right positioning for winding effect
                      const isLeft = index % 2 === 0
                      const marginLeft = isLeft ? '0%' : '25%'
                      const marginRight = isLeft ? '25%' : '0%'

                      return (
                        <div key={step.step_id} className="relative" style={{ marginBottom: index < sortedSteps.length - 1 ? '16px' : '0' }}>
                          {/* Connection line to next step */}
                          {index < sortedSteps.length - 1 && (
                            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '40px', height: '32px' }}>
                              <svg width="2" height="32" className="overflow-visible">
                                <line
                                  x1="1" y1="0" x2="1" y2="32"
                                  stroke={isPast ? '#22C55E' : '#EDE3FF'}
                                  strokeWidth="2"
                                  strokeDasharray={isPast ? 'none' : '4 4'}
                                />
                              </svg>
                            </div>
                          )}

                          <div
                            style={{ marginLeft, marginRight }}
                            className="flex justify-center"
                          >
                            <button
                              onClick={() => setActiveStep(step.step_id)}
                              className={cn(
                                'relative flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer group',
                                isActive && 'scale-110 ring-4 ring-[#EADFFF]',
                                isPast ? 'bg-[#22C55E]' : 'bg-[#6B26EA]',
                              )}
                              style={{ width: '80px', height: '40px', borderRadius: '20px' }}
                            >
                              <span className="text-white text-[13px] font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>
                                {index + 1}
                              </span>
                            </button>
                          </div>

                          {/* Step label below */}
                          <div
                            style={{ marginLeft, marginRight }}
                            className="flex justify-center mt-1"
                          >
                            <span className={cn(
                              'text-[11px] font-medium text-center max-w-[100px] leading-tight',
                              isActive ? 'text-[#6B26EA]' : isPast ? 'text-[#22C55E]' : 'text-[#8B898E]'
                            )}>
                              {step.title.length > 15 ? step.title.slice(0, 15) + '...' : step.title}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel — step details */}
          <div className="w-[340px] bg-white border-l border-[#EDE3FF] flex flex-col overflow-hidden shrink-0">
            {!loading && roadmap && !generating && (
              <>
                {/* Panel header */}
                <div className="p-5 border-b border-[#EDE3FF]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[20px] font-semibold text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                      Steps
                    </h2>
                    <span className="text-[12px] font-bold text-[#6B26EA] bg-[#EADFFF] px-3 py-1 rounded-full">
                      {completedTasks}/{totalTasks} DONE
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#EDE3FF] mt-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#6B26EA] transition-all duration-500"
                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Step list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                  {sortedSteps.map((step, index) => {
                    const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
                    const totalCount = step.tasks?.length || 0
                    const allComplete = totalCount > 0 && completedCount === totalCount
                    const isActive = activeStep === step.step_id
                    const isInProgress = !allComplete && step.tasks?.some(t => t.status === 'pending')

                    return (
                      <div key={step.step_id}>
                        <button
                          onClick={() => setActiveStep(isActive ? null : step.step_id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                            isActive ? 'bg-[#F7F3FE]' : 'hover:bg-[#FAFAFA]'
                          )}
                        >
                          <span className={cn(
                            'text-[13px] font-semibold w-5 shrink-0',
                            allComplete ? 'text-[#22C55E]' : isActive ? 'text-[#6B26EA]' : 'text-[#8B898E]'
                          )}>
                            {index + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-[13px] font-semibold truncate',
                              allComplete ? 'text-[#22C55E]' : isActive ? 'text-[#0D0026]' : 'text-[#0D0026]'
                            )}>
                              {step.title}
                            </p>
                          </div>
                          {isInProgress && !allComplete && (
                            <span className="text-[10px] font-bold text-[#6B26EA] bg-[#EADFFF] px-2 py-0.5 rounded-full shrink-0">
                              IN PROGRESS
                            </span>
                          )}
                          {allComplete && (
                            <CheckCircle2 size={14} className="text-[#22C55E] shrink-0" />
                          )}
                        </button>

                        {/* Expanded task list */}
                        {isActive && (
                          <div className="ml-5 mt-1 mb-2 space-y-1.5 pl-3 border-l-2 border-[#EDE3FF]">
                            {step.tasks
                              ?.sort((a, b) => a.order - b.order)
                              .map((task) => (
                                <div
                                  key={task.task_id}
                                  className={cn(
                                    'flex items-start gap-2.5 p-2.5 rounded-lg',
                                    task.status === 'complete' ? 'bg-[#F0FDF4]' : 'bg-[#FAFAFA]'
                                  )}
                                >
                                  {task.status === 'complete' ? (
                                    <CheckCircle2 size={14} className="text-[#22C55E] shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle size={14} className="text-[#D1D5DB] shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      'text-[12px] font-medium leading-snug',
                                      task.status === 'complete' ? 'text-[#8B898E] line-through' : 'text-[#0D0026]'
                                    )}>
                                      {task.title}
                                    </p>
                                    <p className="text-[11px] text-[#8B898E] mt-0.5 leading-snug">
                                      {task.description}
                                    </p>
                                  </div>
                                </div>
                              ))
                            }
                            {(!step.tasks || step.tasks.length === 0) && (
                              <p className="text-[12px] text-[#8B898E] py-2">No tasks in this step yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-[#EDE3FF]">
                  <button
                    onClick={handleRegenerate}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#EDE3FF] text-[13px] text-[#6B26EA] font-semibold hover:bg-[#F7F3FE] transition-colors"
                  >
                    <RefreshCw size={14} />
                    Regenerate Roadmap
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
