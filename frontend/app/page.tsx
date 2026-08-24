'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-8 max-w-md w-full px-6">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-bold text-primary">LYNKS</h1>
          <p className="text-text-secondary text-center text-sm">AI-powered career accelerator for Caribbean youth</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <Link href="/signup" className="flex items-center justify-center py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">Get Started</Link>
          <Link href="/login" className="flex items-center justify-center py-3 rounded-xl border border-border bg-surface text-text-primary text-sm font-semibold hover:bg-surface-alt transition-colors">Sign In</Link>
        </div>
      </div>
    </div>
  )
}