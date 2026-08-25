'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({
    name: '',
    country: '',
    age: '',
    education: '',
    interests: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const totalSteps = 6

  const handleFinish = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({
        name: profile.name,
        country: profile.country,
        age: profile.age ? parseInt(profile.age) : null,
        education_level: profile.education,
        interests: profile.interests,
      }).eq('id', user.id)
    }
    localStorage.setItem('lynks_user', JSON.stringify({
      name: profile.name,
      email: user?.email || '',
      country: profile.country,
      age: profile.age,
      education: profile.education,
      interests: profile.interests,
    }))
    setSaving(false)
    router.push('/dashboard')
  }

  const canNext = () => {
    if (step === 0) return true
    if (step === 1) return profile.name.trim().length > 0
    if (step === 2) return profile.country.length > 0
    if (step === 3) return profile.age.length > 0
    if (step === 4) return profile.education.length > 0
    if (step === 5) return profile.interests.length > 0
    return false
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F7F3FE] px-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-1 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={cn('h-1.5 rounded-full transition-all duration-300 flex-1', i === step ? 'bg-[#6B26EA]' : i < step ? 'bg-[#6B26EA]/40' : 'bg-[#EDE3FF]')} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Welcome to Lynks</h1>
              <p className="text-sm text-[#8B898E]">Let&apos;s set up your profile to personalize your career journey.</p>
            </div>
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-24 h-24 rounded-full bg-[#6B26EA]/10 flex items-center justify-center"><span className="text-4xl">🚀</span></div>
              <p className="text-center text-[#8B898E] max-w-sm">We&apos;ll ask you a few questions to understand your career goals and interests. This helps our AI match you with the best opportunities.</p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What&apos;s your name?</h1>
              <p className="text-sm text-[#8B898E]">We&apos;ll use this to personalize your experience.</p>
            </div>
            <div className="py-8 max-w-sm mx-auto">
              <input type="text" value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Enter your full name" className="w-full py-3 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors" />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Where are you located?</h1>
              <p className="text-sm text-[#8B898E]">This helps us find opportunities near you.</p>
            </div>
            <div className="py-8 max-w-sm mx-auto">
              <select value={profile.country} onChange={(e) => setProfile(p => ({ ...p, country: e.target.value }))} className="w-full py-3 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors appearance-none">
                <option value="">Select your country</option>
                <option value="TT">Trinidad and Tobago</option>
                <option value="JM">Jamaica</option>
                <option value="BB">Barbados</option>
                <option value="BS">Bahamas</option>
                <option value="GY">Guyana</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>How old are you?</h1>
              <p className="text-sm text-[#8B898E]">This helps us tailor opportunities to your career stage.</p>
            </div>
            <div className="py-8 max-w-sm mx-auto">
              <input type="number" min="13" max="100" value={profile.age} onChange={(e) => setProfile(p => ({ ...p, age: e.target.value }))} placeholder="Enter your age" className="w-full py-3 px-4 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors" />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What&apos;s your education level?</h1>
              <p className="text-sm text-[#8B898E]">This helps us match opportunities to your qualifications.</p>
            </div>
            <div className="py-8 max-w-sm mx-auto">
              <div className="flex flex-col gap-2">
                {['High School', "Associate's Degree", "Bachelor's Degree", "Master's Degree", 'PhD', 'Self-taught'].map((level) => (
                  <label key={level} onClick={() => setProfile(p => ({ ...p, education: level }))} className={cn('flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer hover:border-[#6B26EA] transition-colors', profile.education === level ? 'border-[#6B26EA] bg-[#F9F5FF]' : 'border-[#EDE3FF]')}>
                    <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center', profile.education === level ? 'border-[#6B26EA]' : 'border-[#EDE3FF]')}>
                      {profile.education === level && <div className="w-2 h-2 rounded-full bg-[#6B26EA]" />}
                    </div>
                    <span className="text-sm text-[#0D0026]">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What are your career interests?</h1>
              <p className="text-sm text-[#8B898E]">Select all that apply. We&apos;ll use this to find relevant opportunities.</p>
            </div>
            <div className="py-8 max-w-sm mx-auto">
              <div className="flex flex-wrap gap-2">
                {['Technology', 'Design', 'Business', 'Healthcare', 'Education', 'Finance', 'Marketing', 'Engineering', 'Data Science', 'AI/ML'].map((interest) => {
                  const selected = profile.interests.includes(interest)
                  return (
                    <button key={interest} onClick={() => {
                      setProfile(p => ({ ...p, interests: selected ? p.interests.filter(i => i !== interest) : [...p.interests, interest] }))
                    }} className={cn('py-2 px-4 rounded-full text-sm border transition-colors', selected ? 'bg-[#6B26EA] text-white border-[#6B26EA]' : 'border-[#EDE3FF] bg-white text-[#0D0026] hover:border-[#6B26EA]')}>
                      {interest}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between items-center mt-8">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="flex items-center gap-1 py-2 px-4 text-sm text-[#8B898E] hover:text-[#0D0026] disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          {step < totalSteps - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex items-center gap-1 py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors disabled:opacity-40">
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={!canNext() || saving} className="flex items-center gap-1 py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors disabled:opacity-40">
              {saving ? 'Saving...' : 'Get Started'} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
