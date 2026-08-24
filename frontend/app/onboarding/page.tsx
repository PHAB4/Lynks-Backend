'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEPS = [
  { title: 'Welcome to Lynks', subtitle: "Let's set up your profile to personalize your career journey.", content: (<div className="flex flex-col items-center gap-6 py-8"><div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-4xl">🚀</span></div><p className="text-center text-text-secondary max-w-sm">We&apos;ll ask you a few questions to understand your career goals and interests.</p></div>) },
  { title: "What's your name?", subtitle: "We'll use this to personalize your experience.", content: (<div className="py-8 max-w-sm mx-auto"><input type="text" placeholder="Enter your full name" className="w-full py-3 px-4 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-primary transition-colors" /></div>) },
  { title: 'Where are you located?', subtitle: 'This helps us find opportunities near you.', content: (<div className="py-8 max-w-sm mx-auto"><select className="w-full py-3 px-4 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-primary transition-colors appearance-none"><option value="">Select your country</option><option value="TT">Trinidad and Tobago</option><option value="JM">Jamaica</option><option value="BB">Barbados</option><option value="BS">Bahamas</option><option value="GY">Guyana</option><option value="OTHER">Other</option></select></div>) },
  { title: "What's your education level?", subtitle: 'This helps us match opportunities to your qualifications.', content: (<div className="py-8 max-w-sm mx-auto"><div className="flex flex-col gap-2">{['High School', "Associate's Degree", "Bachelor's Degree", "Master's Degree", 'PhD', 'Self-taught'].map((level) => (<label key={level} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface cursor-pointer hover:border-primary transition-colors"><input type="radio" name="education" className="accent-primary" /><span className="text-sm text-text-primary">{level}</span></label>))}</div></div>) },
  { title: 'What are your career interests?', subtitle: 'Select all that apply.', content: (<div className="py-8 max-w-sm mx-auto"><div className="flex flex-wrap gap-2">{['Technology', 'Design', 'Business', 'Healthcare', 'Education', 'Finance', 'Marketing', 'Engineering', 'Data Science', 'AI/ML'].map((interest) => (<label key={interest} className="flex items-center gap-2 py-2 px-4 rounded-full border border-border bg-surface cursor-pointer hover:border-primary transition-colors"><input type="checkbox" className="accent-primary" /><span className="text-sm text-text-primary">{interest}</span></label>))}</div></div>) },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const current = STEPS[step]
  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 mb-8">{STEPS.map((_, i) => (<div key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === step ? 'bg-primary flex-1' : i < step ? 'bg-primary/40 flex-1' : 'bg-border flex-1')} />))}</div>
        <div className="text-center mb-8"><h1 className="text-2xl font-semibold text-text-primary mb-2">{current.title}</h1><p className="text-sm text-text-secondary">{current.subtitle}</p></div>
        {current.content}
        <div className="flex justify-between items-center mt-8">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="flex items-center gap-1 py-2 px-4 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"><ChevronLeft size={16} /> Back</button>
          {step < STEPS.length - 1 ? (<button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1 py-3 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">Continue <ChevronRight size={16} /></button>) : (<button onClick={() => router.push('/dashboard')} className="flex items-center gap-1 py-3 px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">Get Started <ChevronRight size={16} /></button>)}
        </div>
      </div>
    </div>
  )
}