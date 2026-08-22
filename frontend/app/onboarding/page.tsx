'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { submitOnboarding, ONBOARDING_STEPS, type OnboardingData } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({ name: user?.name ?? '', country: user?.country ?? '', employment_status: user?.employment_status ?? '', career_path: user?.career_path ?? '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const current = ONBOARDING_STEPS[step]
  const isLast = step === ONBOARDING_STEPS.length - 1

  const goNext = () => { if (!data[current.field]) return; if (step < ONBOARDING_STEPS.length - 1) setStep(step + 1) }
  const goBack = () => { if (step > 0) setStep(step - 1) }
  const handleSubmit = async () => { setLoading(true); setError(''); try { await submitOnboarding(data); router.push('/dashboard') } catch (err: any) { setError(err.message ?? 'Something went wrong') } finally { setLoading(false) } }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        {step > 0 && <button onClick={goBack} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium mb-6"><ArrowLeft className="w-4 h-4" /> Back</button>}
        <div className="flex gap-2 mb-8">{ONBOARDING_STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-purple-600' : 'bg-gray-200'}`} />)}</div>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{current.question}</h1>
          <p className="text-sm text-gray-500 mb-6">{current.subtitle}</p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {current.type === 'text' ? (
            <Input value={data[current.field]} onChange={e => setData({ ...data, [current.field]: e.target.value })} placeholder="Type here..." className="mb-6" />
          ) : (
            <select value={data[current.field]} onChange={e => setData({ ...data, [current.field]: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-purple-400 mb-6"><option value="">Select...</option>{current.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
          )}
          {isLast ? (<Button onClick={handleSubmit} disabled={loading || !data[current.field]} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5">{loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{loading ? 'Generating your roadmap...' : 'Finish'}</Button>) : (<Button onClick={goNext} disabled={!data[current.field]} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5">Continue</Button>)}
        </div>
        <p className="text-center text-sm text-gray-400 mt-4">Step {step + 1} of {ONBOARDING_STEPS.length}</p>
      </div>
    </div>
  )
}
