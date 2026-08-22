'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try { await signUp(email, password); router.push('/onboarding') }
    catch (err: any) { setError(err.message ?? 'Signup failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-0.5 text-xl font-bold mb-6"><span className="text-black">LYNK</span><span className="text-purple-600 font-black">S</span><span className="text-purple-600 text-sm -ml-0.5">∞</span></div>
          <h1 className="text-2xl font-bold text-gray-900">Sign Up</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account to get started</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div><Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="mt-1" /></div>
          <div><Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="mt-1" /></div>
          <div><Label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirm Password</Label><Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required className="mt-1" /></div>
          <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5">{loading ? 'Creating account...' : 'Continue'}</Button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">Already have an account? <a href="/" className="text-purple-600 font-medium hover:text-purple-700">Log in</a></p>
      </div>
    </div>
  )
}
