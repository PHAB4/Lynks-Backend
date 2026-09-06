'use client'

import { useState, useEffect } from 'react'
import { resume } from '@/lib/api'
import type { ResumeResponse, ResumeData } from '@/lib/types'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ResumePreview from '@/components/ResumePreview'
import { ResumePDFDownload } from '@/components/ResumePDF'

export default function ResumePage() {
  const [resumeData, setResumeData] = useState<ResumeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    resume.get()
      .then(data => setResumeData(data))
      .catch(() => setResumeData(null))
      .finally(() => setLoading(false))
  }, [])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setError('')
      const data = await resume.generate()
      setResumeData(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate resume')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#6B26EA]" />
        </div>
      </AppLayout>
    )
  }

  const content = resumeData?.content as ResumeData | undefined

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE]">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#6B26EA] hover:text-[#5A1FD0] font-medium mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                My Resume
              </h1>
              <p className="text-sm text-[#8B898E] mt-1">AI-generated resume based on your profile and completed tasks</p>
            </div>
            <div className="flex gap-2">
              {content && <ResumePDFDownload data={content} />}
              <Button onClick={handleGenerate} disabled={generating} className="bg-[#6B26EA] hover:bg-[#5A1FD0] text-white">
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {resumeData ? 'Regenerate' : 'Generate Resume'}
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

          {content ? (
            <div className="flex flex-col gap-6">
              <ResumePreview data={content} />
              <div className="text-xs text-[#8B898E] text-center">
                Last generated: {resumeData?.created_at ? new Date(resumeData.created_at).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#EDE3FF] p-12 text-center">
              <FileText className="w-16 h-16 text-[#EDE3FF] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#0D0026] mb-2">No resume yet</h2>
              <p className="text-sm text-[#8B898E] mb-6 max-w-sm mx-auto">
                Generate a professional resume using your profile information, completed roadmap tasks, and uploaded evidence.
              </p>
              <Button onClick={handleGenerate} disabled={generating} className="bg-[#6B26EA] hover:bg-[#5A1FD0] text-white">
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {generating ? 'Generating...' : 'Generate My Resume'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
