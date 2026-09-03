'use client'

import { useState, useEffect } from 'react'
import { Shield, Mail, AlertTriangle, Check, Loader2, Eye, EyeOff, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

export default function SecurityTab() {
  const [email, setEmail] = useState('')
  const [emailVerified, setEmailVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('lynks_email_verified')
      if (cached !== null) return cached === 'true'
    }
    return true
  })
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email || '')
        const verified = !!user.email_confirmed_at
        setEmailVerified(verified)
        localStorage.setItem('lynks_email_verified', String(verified))
      }
    }
    load()
  }, [])

  const handleResendVerification = async () => {
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (!error) {
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    }
  }

  const handleChangePassword = async () => {
    setPasswordMsg(null)

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (currentPassword === newPassword) {
      setPasswordMsg({ type: 'error', text: 'New password must be different from current password.' })
      return
    }

    setPasswordSaving(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (signInError) {
      setPasswordSaving(false)
      setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' })
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordMsg({ type: 'error', text: error.message || 'Failed to update password.' })
    } else {
      setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(null), 4000)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteEmail !== email) return

    setDeleting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: '' })
    if (signInError) {
      setDeleting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').delete().eq('id', user.id)
    }

    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const passwordRules = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'One number', met: /[0-9]/.test(newPassword) },
    { label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ]

  return (
    <div className="space-y-10">
      {/* Email Verification */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Mail size={20} className="text-[#6B26EA]" />
          <h2 className="text-lg font-semibold text-[#1E1E1E]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Email Verification
          </h2>
        </div>
        <p className="text-sm text-[rgba(30,30,30,0.50)] mb-5" style={{ fontFamily: "'Inter', sans-serif" }}>
          Verify your email to secure your account and enable all features.
        </p>

        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(107,38,234,0.04)] border border-[rgba(107,38,234,0.10)]">
          <div className="flex items-center gap-3">
            {emailVerified ? (
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={16} className="text-green-600" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[#1E1E1E]" style={{ fontFamily: "'Inter', sans-serif" }}>
                {email}
              </p>
              <p className="text-xs" style={{ fontFamily: "'Inter', sans-serif", color: emailVerified ? '#16a34a' : '#d97706' }}>
                {emailVerified ? 'Verified' : 'Not verified'}
              </p>
            </div>
          </div>

          {emailVerified === false && (
            <button
              onClick={handleResendVerification}
              disabled={resending}
              className="py-2 px-4 rounded-lg bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors disabled:opacity-50"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {resending ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Sending...</span>
              ) : resent ? (
                <span className="flex items-center gap-2"><Check size={14} /> Sent!</span>
              ) : (
                'Resend Verification'
              )}
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-[rgba(30,30,30,0.07)]" />

      {/* Change Password */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Shield size={20} className="text-[#6B26EA]" />
          <h2 className="text-lg font-semibold text-[#1E1E1E]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Change Password
          </h2>
        </div>
        <p className="text-sm text-[rgba(30,30,30,0.50)] mb-5" style={{ fontFamily: "'Inter', sans-serif" }}>
          Update your password regularly to keep your account secure.
        </p>

        <div className="space-y-4 max-w-md">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-[rgba(30,30,30,0.70)] mb-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full py-3 px-4 pr-10 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                style={{ fontFamily: "'Inter', sans-serif" }}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(30,30,30,0.30)] hover:text-[rgba(30,30,30,0.60)]"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-[rgba(30,30,30,0.70)] mb-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full py-3 px-4 pr-10 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
                style={{ fontFamily: "'Inter', sans-serif" }}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(30,30,30,0.30)] hover:text-[rgba(30,30,30,0.60)]"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-sm font-medium text-[rgba(30,30,30,0.70)] mb-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full py-3 px-4 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white text-[15px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
              placeholder="Confirm new password"
            />
          </div>

          {/* Password Rules */}
          {newPassword.length > 0 && (
            <div className="space-y-1.5">
              {passwordRules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2">
                  <div className={cn(
                    'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                    rule.met ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  )}>
                    {rule.met ? <Check size={10} /> : '·'}
                  </div>
                  <span className={cn(
                    'text-xs',
                    rule.met ? 'text-green-600' : 'text-[rgba(30,30,30,0.40)]'
                  )} style={{ fontFamily: "'Inter', sans-serif" }}>
                    {rule.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Status Message */}
          {passwordMsg && (
            <div className={cn(
              'p-3 rounded-lg text-sm font-medium',
              passwordMsg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            )} style={{ fontFamily: "'Inter', sans-serif" }}>
              {passwordMsg.text}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleChangePassword}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="py-3 px-6 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {passwordSaving ? (
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Updating...</span>
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </div>

      <div className="h-px bg-[rgba(30,30,30,0.07)]" />

      {/* Delete Account */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Trash2 size={20} className="text-red-500" />
          <h2 className="text-lg font-semibold text-red-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Delete Account
          </h2>
        </div>
        <p className="text-sm text-[rgba(30,30,30,0.50)] mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
          Permanently delete your Lynks account and all associated data. This action cannot be undone.
        </p>

        <div className="p-5 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                This is irreversible
              </p>
              <p className="text-sm text-red-600 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                Deleting your account will permanently remove all your data including your profile, roadmap, resume, saved opportunities, and chat history. You will not be able to recover this information.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="py-2.5 px-5 rounded-xl border border-red-300 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1E1E1E]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Delete Account
                </h3>
                <button onClick={() => { setShowDeleteModal(false); setDeleteEmail('') }} className="text-[rgba(30,30,30,0.30)] hover:text-[rgba(30,30,30,0.60)]">
                  <X size={20} />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-5">
                <p className="text-sm text-red-700 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                  ⚠️ This action is permanent and cannot be undone. All your data will be permanently deleted.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[rgba(30,30,30,0.70)] mb-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Confirm by entering your email
                  </label>
                  <input
                    type="email"
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white text-[15px] text-[#1E1E1E] focus:outline-none focus:border-red-400 transition-colors"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                    placeholder={email}
                  />
                </div>

              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteEmail('') }}
                className="py-2.5 px-5 rounded-xl border border-[rgba(30,30,30,0.15)] text-[rgba(30,30,30,0.70)] text-sm font-medium hover:bg-gray-100 transition-colors"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteEmail !== email || deleting}
                className="py-2.5 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {deleting ? (
                  <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Deleting...</span>
                ) : (
                  'Permanently Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
