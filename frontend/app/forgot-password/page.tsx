'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setLoading(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F7F3FE] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/lynks-full-logo.png" alt="LYNKS" className="h-72 w-auto object-contain" />
          <p className="text-[#8B898E] text-sm">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="text-lg font-semibold text-[#0D0026] mb-2">Check your email</h2>
            <p className="text-sm text-[#8B898E] mb-6">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
            </p>
            <Link
              href="/login"
              className="inline-block py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-[#8B898E] mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    'w-full py-3 px-4 rounded-xl border bg-white text-sm text-[#0D0026] focus:outline-none focus:border-[#6B26EA] transition-colors',
                    error ? 'border-red-400' : 'border-[#EDE3FF]'
                  )}
                  placeholder="john@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="py-3 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="text-center text-sm text-[#8B898E] mt-4">
              Remember your password? <Link href="/login" className="text-[#6B26EA] font-semibold hover:underline">Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
