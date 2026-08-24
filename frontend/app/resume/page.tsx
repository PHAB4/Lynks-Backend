'use client'

import { FileText, Download, Edit3 } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useState } from 'react'

export default function ResumePage() {
  const [editing, setEditing] = useState(false)
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-surface-alt">
        <div className="flex-1 p-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <FileText className="text-primary" size={24} />
              <h1 className="text-[40px] font-semibold leading-[50px] text-text-primary">Resume</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 py-2 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors">
                <Download size={16} /> Download PDF
              </button>
              <button className="flex items-center gap-2 py-2 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors">
                <Download size={16} /> Download DOCX
              </button>
              <button onClick={() => setEditing(!editing)} className="flex items-center gap-2 py-2 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors">
                <Edit3 size={16} /> Edit Resume
              </button>
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-8 max-w-[800px]">
            <h2 className="text-xl font-bold text-text-primary mb-4">John Doe</h2>
            <p className="text-sm text-text-secondary mb-2">Software Engineer • john@example.com • +1 (555) 123-4567</p>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-text-faint tracking-widest mb-3">EXPERIENCE</h3>
              <p className="text-sm text-text-muted">No experience added yet. Your AI will generate this based on your profile.</p>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-text-faint tracking-widest mb-3">EDUCATION</h3>
              <p className="text-sm text-text-muted">No education added yet.</p>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-bold text-text-faint tracking-widest mb-3">SKILLS</h3>
              <p className="text-sm text-text-muted">No skills added yet.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}