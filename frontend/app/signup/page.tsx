'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const passwordRules = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
    { label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ]
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!form.name) newErrors.name = 'Name is required'
    if (!form.email) newErrors.email = 'Email is required'
    if (!passwordRules.every(r => r.test(form.password))) newErrors.password = 'Password does not meet requirements'
    if (form.password !== form.confirm) newErrors.confirm = 'Passwords do not match'
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) router.push('/onboarding')
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F7F3FE] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8"><h1 className="text-3xl font-bold text-[#6B26EA]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>LYNKS</h1><p className="text-[#8B898E] text-sm">Create your account</p></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="text-xs font-medium text-[#8B898E] mb-1 block">Full Name</label><input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className={cn('w-full py-3 px-4 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.name ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="John Doe" />{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}</div>
          <div><label className="text-xs font-medium text-[#8B898E] mb-1 block">Email</label><input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={cn('w-full py-3 px-4 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.email ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="john@example.com" />{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}</div>
          <div><label className="text-xs font-medium text-[#8B898E] mb-1 block">Password</label><div className="relative"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className={cn('w-full py-3 px-4 pr-10 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.password ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A8] hover:text-[#0D0026] transition-colors">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}{form.password && (<div className="flex flex-col gap-1 mt-2">{passwordRules.map((rule, i) => (<div key={i} className="flex items-center gap-1.5">{rule.test(form.password) ? <Check size={12} className="text-green-500" /> : <X size={12} className="text-red-400" />}<span className={cn('text-[11px]', rule.test(form.password) ? 'text-green-600' : 'text-[#8B898E]')}>{rule.label}</span></div>))}</div>)}</div>
          <div><label className="text-xs font-medium text-[#8B898E] mb-1 block">Confirm Password</label><input type="password" value={form.confirm} onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))} className={cn('w-full py-3 px-4 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors', errors.confirm ? 'border-red-400' : 'border-[#EDE3FF]')} placeholder="••••••••" />{errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}</div>
          <button type="submit" className="py-3 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors mt-2">Create Account</button>
        </form>
        <p className="text-center text-sm text-[#8B898E] mt-6">Already have an account? <Link href="/login" className="text-[#6B26EA] font-semibold hover:underline">Sign In</Link></p>
      </div>
    </div>
  )
}