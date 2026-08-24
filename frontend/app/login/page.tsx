'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { auth } from '@/lib/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    const newErrors: Record<string, string> = {}
    if (!form.email) newErrors.email = 'Email is required'
    if (!form.password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email, form.password)
      const user = cred.user
      localStorage.setItem('lynks_user', JSON.stringify({ name: user.displayName || user.email?.split('@')[0] || 'User', email: user.email }))
      router.push('/dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found') setServerError('No account found with this email.')
      else if (code === 'auth/wrong-password') setServerError('Incorrect password.')
      else if (code === 'auth/invalid-email') setServerError('Invalid email address.')
      else if (code === 'auth/invalid-credential') setServerError('Invalid email or password.')
      else setServerError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F7F3FE] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <h1 className="text-3xl font-bold text-[#6B26EA]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>LYNKS</h1>
          <p className="text-[#8B898E] text-sm">Welcome back</p>
        </div>
        {serverError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">{serverError}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[#8B898E] mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={cn('w-full py-3 px-4 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.email ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="john@example.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-[#8B898E] mb-1 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className={cn('w-full py-3 px-4 pr-10 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.password ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A8] hover:text-[#0D0026] transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <button type="submit" disabled={loading} className="py-3 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors mt-2 disabled:opacity-50">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-[#8B898E] mt-6">Don&apos;t have an account? <Link href="/signup" className="text-[#6B26EA] font-semibold hover:underline">Get Started</Link></p>
      </div>
    </div>
  )
}
