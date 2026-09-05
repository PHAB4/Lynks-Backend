'use client'

import { useState, useEffect } from 'react'
import { Map, Loader2, RefreshCw, CheckCircle2, Circle, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'
import { getRoadmap, generateRoadmap, regenerateRoadmap, type Roadmap, type RoadmapStep } from '@/lib/roadmap-api'
import { useAuthGate } from '@/lib/use-auth'

export default function RoadmapPage() {
  const authChecked = useAuthGate()
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadRoadmap()
  }, [])

  const loadRoadmap = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getRoadmap()
      setRoadmap(data)
      if (data?.steps) {
        setExpandedSteps(new Set(data.steps.map((s) => s.step_id)))
      }
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
      const data = await generateRoadmap()
      setRoadmap(data)
      if (data?.steps) {
        setExpandedSteps(new Set(data.steps.map((s) => s.step_id)))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate roadmap'
      if (msg.includes('profile_incomplete')) {
        setError('Please complete your profile (career path, education level, and country) before generating a roadmap.')
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
      if (data?.steps) {
        setExpandedSteps(new Set(data.steps.map((s) => s.step_id)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate roadmap')
    } finally {
      setGenerating(false)
    }
  }

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  const allTasks = roadmap?.steps?.flatMap((s) => s.tasks || []) || []
  const completedTasks = allTasks.filter((t) => t.status === 'complete').length
  const totalTasks = allTasks.length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  if (!authChecked) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen bg-[#F7F3FE]">
          <div className="w-8 h-8 border-2 border-[#6B26EA] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE] overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="mb-8">
            <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Your Career Roadmap
            </h1>
            <p className="text-sm text-[#8B898E] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              A personalized, step-by-step plan to reach your career goals.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-[#6B26EA] animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 mb-6">
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
                Let LYNKS AI create a personalized career roadmap based on your profile, career path, and education level.
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
            <>
              {/* Progress bar */}
              <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-semibold text-[#0D0026]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Overall Progress
                  </p>
                  <p className="text-[13px] font-bold text-[#6B26EA]">{progressPercent}%</p>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#EDE3FF] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6B26EA] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[12px] text-[#8B898E] mt-2">
                  {completedTasks} of {totalTasks} tasks completed
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {roadmap.steps
                  .sort((a, b) => a.order - b.order)
                  .map((step, index) => (
                    <StepCard
                      key={step.step_id}
                      step={step}
                      index={index}
                      expanded={expandedSteps.has(step.step_id)}
                      onToggle={() => toggleStep(step.step_id)}
                    />
                  ))}
              </div>

              {/* Regenerate */}
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-2 py-2.5 px-6 rounded-xl border border-[#EDE3FF] text-[13px] text-[#6B26EA] font-semibold hover:bg-[#F7F3FE] transition-colors"
                >
                  <RefreshCw size={14} />
                  Regenerate Roadmap
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function StepCard({ step, index, expanded, onToggle }: { step: RoadmapStep; index: number; expanded: boolean; onToggle: () => void }) {
  const completedCount = step.tasks?.filter((t) => t.status === 'complete').length || 0
  const totalCount = step.tasks?.length || 0
  const allComplete = totalCount > 0 && completedCount === totalCount

  return (
    <div className={cn('bg-white rounded-2xl border overflow-hidden transition-all', allComplete ? 'border-[#BBF7D0]' : 'border-[#EDE3FF]')}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-5 text-left"
      >
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0',
          allComplete ? 'bg-[#22C55E] text-white' : 'bg-[#EADFFF] text-[#6B26EA]'
        )}>
          {allComplete ? <CheckCircle2 size={16} /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#0D0026]">{step.title}</p>
          <p className="text-[12px] text-[#8B898E] mt-0.5">
            {completedCount}/{totalCount} tasks · {step.description.slice(0, 80)}{step.description.length > 80 ? '...' : ''}
          </p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-[#8B898E] shrink-0" /> : <ChevronRight size={16} className="text-[#8B898E] shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0">
          <p className="text-[13px] text-[#8B898E] mb-3 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            {step.description}
          </p>
          <div className="space-y-2">
            {step.tasks
              ?.sort((a, b) => a.order - b.order)
              .map((task) => (
                <div
                  key={task.task_id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border',
                    task.status === 'complete' ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FAFAFA] border-[rgba(30,30,30,0.06)]'
                  )}
                >
                  {task.status === 'complete' ? (
                    <CheckCircle2 size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-[#D1D5DB] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={cn('text-[13px] font-medium', task.status === 'complete' ? 'text-[#8B898E] line-through' : 'text-[#0D0026]')}>
                      {task.title}
                    </p>
                    <p className="text-[12px] text-[#8B898E] mt-0.5">{task.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
