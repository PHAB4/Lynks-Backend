'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Map, Loader2, Sparkles, Check, Lock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'
import { getRoadmap, generateRoadmap, completeTask, uncompleteTask, type Roadmap, type RoadmapStep } from '@/lib/roadmap-api'
import { fetchAPI } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [startedSteps, setStartedSteps] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [tasksPanelOpen, setTasksPanelOpen] = useState(true)
  const [togglingTasks, setTogglingTasks] = useState<Set<string>>(new Set())
  const stepsPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const stored = localStorage.getItem(`lynks_started_steps_${user.id}`)
        if (stored) {
          try { setStartedSteps(new Set(JSON.parse(stored))) } catch {}
        }
      }
      loadRoadmap()
    }
    init()
  }, [])

  const markStepStarted = (stepId: string) => {
    if (!userId) return
    setStartedSteps(prev => {
      const next = new Set(prev)
      next.add(stepId)
      localStorage.setItem(`lynks_started_steps_${userId}`, JSON.stringify([...next]))
      return next
    })
  }

  const sortedSteps = roadmap?.steps ? [...roadmap.steps].sort((a, b) => a.order - b.order) : []

  const getCurrentStepIndex = useCallback((): number => {
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]
      const tasks = step.tasks || []
      const allComplete = tasks.length > 0 && tasks.every(t => t.status === 'complete')
      if (!allComplete) return i
    }
    return sortedSteps.length - 1
  }, [sortedSteps])

  const currentStepIndex = getCurrentStepIndex()
  const isAllComplete = roadmap && sortedSteps.length > 0 && sortedSteps.every(s =>
    (s.tasks || []).length > 0 && (s.tasks || []).every(t => t.status === 'complete')
  )

  useEffect(() => {
    if (roadmap?.steps && roadmap.steps.length > 0 && !activeStep) {
      const sorted = [...roadmap.steps].sort((a, b) => a.order - b.order)
      const idx = getCurrentStepIndex()
      setActiveStep(sorted[idx]?.step_id || sorted[0].step_id)
    }
  }, [roadmap, activeStep, getCurrentStepIndex])

  useEffect(() => {
    if (activeStep && stepsPanelRef.current) {
      const activeEl = stepsPanelRef.current.querySelector(`[data-step-id="${activeStep}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [activeStep])

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
      } else if (msg.includes('rate_limited') || msg.includes('429')) {
        setError('The AI is temporarily busy. Please wait a minute and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    if (togglingTasks.has(taskId)) return
    setTogglingTasks(prev => new Set(prev).add(taskId))

    const newStatus = currentStatus === 'complete' ? 'pending' : 'complete'

    setRoadmap(prev => {
      if (!prev) return prev
      return {
        ...prev,
        steps: prev.steps.map(s => ({
          ...s,
          tasks: (s.tasks || []).map(t =>
            t.task_id === taskId ? { ...t, status: newStatus as 'pending' | 'complete' } : t
          ),
        })),
      }
    })

    try {
      if (newStatus === 'complete') {
        await completeTask(taskId)
      } else {
        await uncompleteTask(taskId)
      }
    } catch {
      setRoadmap(prev => {
        if (!prev) return prev
        return {
          ...prev,
          steps: prev.steps.map(s => ({
            ...s,
            tasks: (s.tasks || []).map(t =>
              t.task_id === taskId ? { ...t, status: currentStatus as 'pending' | 'complete' } : t
            ),
          })),
        }
      })
    } finally {
      setTogglingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const handleNavigateToChat = (step: RoadmapStep, stepIndex: number) => {
    markStepStarted(step.step_id)
    const sortedTasks = step.tasks ? [...step.tasks].sort((a, b) => a.order - b.order) : []
    const taskList = sortedTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')
    const hasStarted = startedSteps.has(step.step_id)
    const prompt = hasStarted
      ? `I want to continue working on Step ${stepIndex + 1}: "${step.title}"\n\nHere are the tasks I need to complete:\n${taskList}\n\nPlease help me pick up where I left off and continue with the next task.`
      : `I want to begin working on Step ${stepIndex + 1}: "${step.title}"\n\nHere are the tasks I need to complete:\n${taskList}\n\nPlease help me get started. Break down the first task into actionable steps and guide me through it.`
    const params = new URLSearchParams({ roadmap_step: prompt })
    window.location.href = `/chat?${params.toString()}`
  }

  const totalTasks = sortedSteps.reduce((sum, s) => sum + (s.tasks?.length || 0), 0)
  const totalDone = sortedSteps.reduce((sum, s) => sum + (s.tasks?.filter(t => t.status === 'complete').length || 0), 0)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE] overflow-hidden">
        <div className="flex h-[calc(100vh-64px)]">
          {/* Left panel — winding path */}
          <div className="flex-1 relative overflow-y-auto overflow-x-hidden roadmap-scroll">
            <div className="flex flex-col items-center py-8 px-4">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                  Roadmap
                </h1>
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
                <div className="relative w-full max-w-[600px] mt-4">
                  <style>{`
                    .roadmap-scroll::-webkit-scrollbar { width: 4px; }
                    .roadmap-scroll::-webkit-scrollbar-track { background: transparent; }
                    .roadmap-scroll::-webkit-scrollbar-thumb { background: rgba(107,38,234,0.15); border-radius: 4px; }
                    .roadmap-scroll { scrollbar-width: thin; scrollbar-color: rgba(107,38,234,0.15) transparent; }
                  `}</style>

                  <div className="flex flex-col items-center">
                    {sortedSteps.map((step, stepIndex) => {
                      const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
                      const totalCount = step.tasks?.length || 0
                      const allComplete = totalCount > 0 && completedCount === totalCount
                      const isCurrentStep = stepIndex === currentStepIndex && !isAllComplete
                      const isPast = allComplete
                      const isFuture = stepIndex > currentStepIndex
                      const isActive = activeStep === step.step_id
                      const sortedTasks = step.tasks ? [...step.tasks].sort((a, b) => a.order - b.order) : []
                      const stepIsLeft = stepIndex % 2 === 0
                      const stepOffsetX = stepIsLeft ? -100 : 100
                      const hasStarted = startedSteps.has(step.step_id)

                      return (
                        <div key={step.step_id} className="w-full" style={{ marginBottom: stepIndex < sortedSteps.length - 1 ? '48px' : '0' }}>
                          {/* Step title + progress */}
                          <div style={{ transform: `translateX(${stepOffsetX}px)` }} className="flex flex-col items-center mb-3">
                            <span className={cn(
                              'text-[13px] font-semibold text-center leading-tight mb-1',
                              isPast ? 'text-[#22C55E]' : isFuture ? 'text-[#D1D5DB]' : 'text-[#6B26EA]'
                            )}>
                              {step.title}
                            </span>
                            {totalCount > 0 && (
                              <span className={cn(
                                'text-[11px] font-medium',
                                allComplete ? 'text-[#22C55E]' : isFuture ? 'text-[#D1D5DB]' : 'text-[#B1AEAE]'
                              )}>
                                {completedCount}/{totalCount} tasks complete
                              </span>
                            )}
                          </div>

                          {/* Step node + Begin/Continue button */}
                          <div style={{ transform: `translateX(${stepOffsetX}px)` }} className="flex flex-col items-center mb-4">
                            <button
                              onClick={() => {
                                if (isFuture) return
                                setActiveStep(isActive ? null : step.step_id)
                              }}
                              className={cn('relative flex items-center justify-center transition-all duration-300', isFuture ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
                              style={{
                                width: '100px',
                                height: '38px',
                                borderRadius: '50%',
                                background: isPast
                                  ? 'linear-gradient(180deg, #34D673 0%, #1BA84E 100%)'
                                  : isFuture
                                    ? 'linear-gradient(180deg, #E5E7EB 0%, #D1D5DB 100%)'
                                    : 'linear-gradient(180deg, #9B5CFF 0%, #6B26EA 50%, #4A10B8 100%)',
                                boxShadow: isPast
                                  ? '0 4px 0 #148A3D, 0 6px 12px rgba(34,197,94,0.35), inset 0 1px 1px rgba(255,255,255,0.25)'
                                  : isFuture
                                    ? '0 4px 0 #B8BCC4, inset 0 1px 1px rgba(255,255,255,0.5)'
                                    : '0 4px 0 #3A0E8C, 0 6px 12px rgba(107,38,234,0.4), inset 0 1px 1px rgba(255,255,255,0.3)',
                                transform: isActive && !isFuture ? 'scale(1.1) translateY(-2px)' : 'none',
                              }}
                            >
                              {isPast ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : isFuture ? (
                                <Lock size={14} className="text-white/70" />
                              ) : (
                                <span className="text-white text-[14px] font-bold drop-shadow-sm" style={{ fontFamily: "'Inter', sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                                  {stepIndex + 1}
                                </span>
                              )}
                            </button>

                            {/* Begin / Continue button — always visible next to current step node */}
                            {isCurrentStep && (
                              <button
                                onClick={() => handleNavigateToChat(step, stepIndex)}
                                className="flex items-center gap-2 mt-3 py-2.5 px-5 rounded-xl bg-[#6B26EA] text-white text-[12px] font-semibold hover:bg-[#5A1FD0] transition-all shadow-[0_4px_12px_rgba(107,38,234,0.3)] hover:shadow-[0_6px_16px_rgba(107,38,234,0.4)]"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                {hasStarted ? 'Continue with this step' : 'Begin this step'}
                              </button>
                            )}
                          </div>

                          {/* Task nodes — only shown for non-future steps when active */}
                          {!isFuture && isActive && sortedTasks.length > 0 && (
                            <div className="flex flex-col" style={{ gap: '16px' }}>
                              {sortedTasks.map((task, taskIndex) => {
                                const taskDone = task.status === 'complete'
                                const taskIsLeft = stepIsLeft ? (taskIndex % 2 !== 0) : (taskIndex % 2 === 0)
                                const taskOffsetX = taskIsLeft ? -50 : 50
                                const isToggling = togglingTasks.has(task.task_id)

                                return (
                                  <div key={task.task_id} style={{ transform: `translateX(${taskOffsetX}px)` }}>
                                    <div className={cn('flex items-center gap-3', taskIsLeft ? 'justify-end' : 'justify-start')}>
                                      {!taskIsLeft && (
                                        <span className={cn('text-[13px] font-medium leading-snug text-left max-w-[200px]', taskDone ? 'text-[#22C55E]' : 'text-[#4A3572]')}>
                                          {task.title}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleToggleTask(task.task_id, task.status)}
                                        disabled={isToggling}
                                        className="shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 hover:scale-110 disabled:opacity-60"
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
                                        {isToggling ? (
                                          <Loader2 size={12} className="text-white animate-spin" />
                                        ) : taskDone ? (
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        ) : (
                                          <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.15)' }}>✓</span>
                                        )}
                                      </button>
                                      {taskIsLeft && (
                                        <span className={cn('text-[13px] font-medium leading-snug text-right max-w-[200px]', taskDone ? 'text-[#22C55E]' : 'text-[#4A3572]')}>
                                          {task.title}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* All complete celebration */}
                    {isAllComplete && (
                      <div className="flex flex-col items-center mt-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#E8FBF0] flex items-center justify-center mb-3">
                          <Check size={28} className="text-[#22C55E]" />
                        </div>
                        <p className="text-[16px] font-semibold text-[#22C55E] mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                          All steps complete!
                        </p>
                        <p className="text-[13px] text-[#8B898E]">
                          You&apos;ve completed your entire roadmap. Great work!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel — Steps list */}
          {roadmap && sortedSteps.length > 0 && (
            <div className="w-[340px] shrink-0 bg-white border-l border-[#E9E3F5] flex flex-col h-full">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-[#E9E3F5]">
                <div className="flex items-center justify-between">
                  <h2 className="text-[20px] font-semibold text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                    Steps
                  </h2>
                  {totalTasks > 0 && (
                    <span className="text-[11px] font-bold text-[#22C55E] bg-[#E8FBF0] px-2.5 py-1 rounded-full">
                      {totalDone}/{totalTasks} DONE
                    </span>
                  )}
                </div>
              </div>

              {/* Steps list */}
              <div ref={stepsPanelRef} className="flex-1 overflow-y-auto">
                {sortedSteps.map((step, stepIndex) => {
                  const completedCount = step.tasks?.filter(t => t.status === 'complete').length || 0
                  const totalCount = step.tasks?.length || 0
                  const allComplete = totalCount > 0 && completedCount === totalCount
                  const isCurrentStep = stepIndex === currentStepIndex && !isAllComplete
                  const isFuture = stepIndex > currentStepIndex
                  const isPast = allComplete
                  const isActive = activeStep === step.step_id
                  const sortedTasks = step.tasks ? [...step.tasks].sort((a, b) => a.order - b.order) : []
                  const hasStarted = startedSteps.has(step.step_id)

                  return (
                    <div key={step.step_id} data-step-id={step.step_id}>
                      <button
                        onClick={() => {
                          if (isFuture) return
                          setActiveStep(isActive ? null : step.step_id)
                        }}
                        className={cn(
                          'w-full px-5 py-3.5 flex items-center gap-3 transition-colors text-left border-b border-[#F3EFFC]',
                          isFuture ? 'opacity-50 cursor-not-allowed' : isActive ? 'bg-[#F7F3FE]' : 'hover:bg-[#FAFAFE] cursor-pointer'
                        )}
                      >
                        <span className={cn(
                          'text-[13px] font-medium w-6 text-center shrink-0',
                          isPast ? 'text-[#22C55E]' : isFuture ? 'text-[#D1D5DB]' : isActive ? 'text-[#6B26EA]' : 'text-[#8B898E]'
                        )}>
                          {stepIndex + 1}.
                        </span>
                        <span className={cn(
                          'text-[14px] font-medium flex-1 leading-tight',
                          isPast ? 'text-[#22C55E]' : isFuture ? 'text-[#D1D5DB]' : isActive ? 'text-[#6B26EA]' : 'text-[#4A3572]'
                        )} style={{ fontFamily: "'Inter', sans-serif" }}>
                          {step.title}
                        </span>
                        {isPast ? (
                          <Check size={16} className="text-[#22C55E] shrink-0" />
                        ) : isFuture ? (
                          <Lock size={13} className="text-[#D1D5DB] shrink-0" />
                        ) : isActive ? (
                          <div className="w-2 h-2 rounded-full bg-[#6B26EA] shrink-0" />
                        ) : null}
                      </button>

                      {/* Expanded tasks when step is active */}
                      {isActive && sortedTasks.length > 0 && (
                        <div className="bg-[#FAFAFE] border-b border-[#F3EFFC] px-5 pb-3">
                          <div className="ml-6 space-y-1.5 pt-1">
                            {sortedTasks.map((task) => {
                              const taskDone = task.status === 'complete'
                              const isToggling = togglingTasks.has(task.task_id)
                              return (
                                <button
                                  key={task.task_id}
                                  onClick={() => handleToggleTask(task.task_id, task.status)}
                                  disabled={isToggling}
                                  className="flex items-center gap-2.5 py-1.5 w-full text-left hover:bg-white/60 rounded px-1 transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  <div className={cn(
                                    'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors',
                                    taskDone
                                      ? 'bg-[#22C55E]'
                                      : 'border-2 border-[#C8B0FF]'
                                  )}>
                                    {isToggling ? (
                                      <Loader2 size={10} className="text-white animate-spin" />
                                    ) : taskDone && (
                                      <Check size={10} className="text-white" strokeWidth={3} />
                                    )}
                                  </div>
                                  <span className={cn(
                                    'text-[12px] leading-snug',
                                    taskDone ? 'text-[#22C55E] line-through' : 'text-[#4A3572]'
                                  )}>
                                    {task.title}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                          {/* Begin / Continue button in sidebar */}
                          {isCurrentStep && (
                            <div className="ml-6 mt-3">
                              <button
                                onClick={() => handleNavigateToChat(step, stepIndex)}
                                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#6B26EA] text-white text-[11px] font-semibold hover:bg-[#5A1FD0] transition-colors"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                {hasStarted ? 'Continue in Chat' : 'Begin in Chat'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
