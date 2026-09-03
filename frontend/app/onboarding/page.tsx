'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({
    name: '',
    country: '',
    age: '',
    employment: '',
    education: '',
    interests: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const steps = ['welcome', 'name', 'country', 'age', 'employment', 'education', 'interests']
  const totalSteps = steps.length

  const handleFinish = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({
        name: profile.name,
        country: profile.country,
        age: profile.age ? parseInt(profile.age) : null,
        employment_status: profile.employment,
        education_level: profile.education,
        interests: profile.interests,
      }).eq('id', user.id)
    }
    localStorage.setItem('lynks_user', JSON.stringify({
      name: profile.name,
      email: user?.email || '',
      country: profile.country,
      age: profile.age,
      employment: profile.employment,
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
    if (step === 4) return profile.employment.length > 0
    if (step === 5) return profile.education.length > 0
    if (step === 6) return profile.interests.length > 0
    return false
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F3FE]">
      {/* Logo */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-1">
          <img src="/lynks-full-logo.png" alt="LYNKS" className="h-6 w-auto object-contain" />
          <span className="text-[#6B26EA] text-lg font-bold">&raquo;</span>
        </div>
      </div>

      {/* Main content — centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Welcome to LYNKS</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">Tell LYNKS about yourself so it can give you the most appropriate guidance.</p>
              </div>
            </>
          )}

          {/* Step 1: Name */}
          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What is your name?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">Tell LYNKS what it should call you.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="What is your name"
                  className="w-full py-3.5 px-5 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors"
                />
              </div>
            </>
          )}

          {/* Step 2: Country */}
          {step === 2 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What country are you from?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">This gives LYNKS the knowledge it needs to grant you opportunities in your area.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <select
                  value={profile.country}
                  onChange={(e) => setProfile(p => ({ ...p, country: e.target.value }))}
                  className="w-full py-3.5 px-5 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors appearance-none"
                >
                  <option value="">State your current country of residence...</option>
                  <option value="TT">Trinidad and Tobago</option>
                  <option value="JM">Jamaica</option>
                  <option value="BB">Barbados</option>
                  <option value="BS">Bahamas</option>
                  <option value="GY">Guyana</option>
                  <option value="OTHER">Other</option>
                </select>
                {profile.country && <p className="text-xs text-[#8B898E] mt-2">Selected: {profile.country}</p>}
              </div>
            </>
          )}

          {/* Step 3: Age */}
          {step === 3 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>How old are you?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">This helps us tailor opportunities to your career stage.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <input
                  type="number"
                  min="13"
                  max="100"
                  value={profile.age}
                  onChange={(e) => setProfile(p => ({ ...p, age: e.target.value }))}
                  placeholder="Enter your age"
                  className="w-full py-3.5 px-5 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors"
                />
              </div>
            </>
          )}

          {/* Step 4: Employment Status */}
          {step === 4 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What is your current employment status?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">Where you are in life gives LYNKS a better idea as to how it can guide you.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <select
                  value={profile.employment}
                  onChange={(e) => setProfile(p => ({ ...p, employment: e.target.value }))}
                  className="w-full py-3.5 px-5 rounded-xl border border-[#EDE3FF] bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors appearance-none"
                >
                  <option value="">State your employment status...</option>
                  <option value="student">Student</option>
                  <option value="employed">Employed</option>
                  <option value="self-employed">Self-Employed</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="intern">Intern</option>
                  <option value="freelance">Freelance</option>
                </select>
                {profile.employment && <p className="text-xs text-[#8B898E] mt-2">Selected: {profile.employment}</p>}
              </div>
            </>
          )}

          {/* Step 5: Education */}
          {step === 5 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What is your education level?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">This helps us match opportunities to your qualifications.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <div className="flex flex-col gap-2">
                  {['High School', "Associate's Degree", "Bachelor's Degree", "Master's Degree", 'PhD', 'Self-taught'].map((level) => (
                    <label key={level} onClick={() => setProfile(p => ({ ...p, education: level }))} className={cn('flex items-center gap-3 p-3.5 rounded-xl border bg-white cursor-pointer transition-colors', profile.education === level ? 'border-[#6B26EA] bg-[#F9F5FF]' : 'border-[#EDE3FF]')}>
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

          {/* Step 6: Interests */}
          {step === 6 && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold text-[#0D0026] mb-3 leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>What career are you most interested in?</h1>
                <p className="text-[16px] text-[#0D0026] leading-relaxed">Be as specific as possible so LYNKS can give you the most appropriate response.</p>
              </div>
              <div className="max-w-md mx-auto mb-8">
                <div className="flex flex-wrap gap-2">
                  {['Technology', 'Design', 'Business', 'Healthcare', 'Education', 'Finance', 'Marketing', 'Engineering', 'Data Science', 'AI/ML'].map((interest) => {
                    const selected = profile.interests.includes(interest)
                    return (
                      <button key={interest} onClick={() => {
                        setProfile(p => ({ ...p, interests: selected ? p.interests.filter(i => i !== interest) : [...p.interests, interest] }))
                      }} className={cn('py-2.5 px-5 rounded-full text-sm border transition-colors', selected ? 'bg-[#6B26EA] text-white border-[#6B26EA]' : 'border-[#EDE3FF] bg-white text-[#0D0026] hover:border-[#6B26EA]')}>
                        {interest}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Back / Continue buttons — matches Framer design */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="py-3 px-12 rounded-full border border-[#EDE3FF] bg-white text-sm font-medium text-[#0D0026] hover:bg-[#F9F5FF] transition-colors disabled:opacity-30"
            >
              Back
            </button>
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="py-3 px-12 rounded-full bg-gradient-to-r from-[#EADFFF] to-[#D4C4F7] border border-[rgba(0,0,0,0.1)] text-sm font-medium text-[#0D0026] hover:from-[#D4C4F7] hover:to-[#C0A8F0] transition-colors disabled:opacity-40"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canNext() || saving}
                className="py-3 px-12 rounded-full bg-gradient-to-r from-[#EADFFF] to-[#D4C4F7] border border-[rgba(0,0,0,0.1)] text-sm font-medium text-[#0D0026] hover:from-[#D4C4F7] hover:to-[#C0A8F0] transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Get Started'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
