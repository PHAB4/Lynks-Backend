'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!form.email) newErrors.email = 'Email is required'
    if (!form.password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) router.push('/dashboard')
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8"><h1 className="text-3xl font-bold text-primary">LYNKS</h1><p className="text-text-secondary text-sm">Welcome back</p></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div><label className="text-xs font-medium text-text-secondary mb-1 block">Email</label><input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={cn('w-full py-3 px-4 rounded-xl border bg-surface text-sm text-text-primary focus:outline-none focus:border-primary transition-colors', errors.email ? 'border-red-400' : 'border-border')} placeholder="john@example.com" />{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}</div>
          <div><label className="text-xs font-medium text-text-secondary mb-1 block">Password</label><div className="relative"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} className={cn('w-full py-3 px-4 pr-10 rounded-xl border bg-surface text-sm text-text-primary focus:outline-none focus:border-primary transition-colors', errors.password ? 'border-red-400' : 'border-border')} placeholder="••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}</div>
          <button type="submit" className="py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors mt-2">Sign In</button>
        </form>
        <p className="text-center text-sm text-text-secondary mt-6">Don&apos;t have an account? <Link href="/signup" className="text-primary font-semibold hover:underline">Get Started</Link></p>
      </div>
    </div>
  )
}