'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { resume } from '@/lib/api'
import type { ResumeResponse, ResumeData } from '@/lib/types'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ResumePreview from '@/components/ResumePreview'
import { ResumePDFDownload } from '@/components/ResumePDF'

export default function ResumePage() {
  const { user } = useAuth()
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

  const handleDownloadMarkdown = () => {
    if (!resumeData?.content) return
    const md = resumeToMarkdown(resumeData.content)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lynks-resume-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
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
      <div className="max-w-4xl mx-auto p-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#6B26EA] hover:text-[#5A1FD0] font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0D0026]">My Resume</h1>
            <p className="text-sm text-[#8B898E] mt-1">AI-generated resume based on your profile and completed tasks</p>
          </div>
          <div className="flex gap-2">
            {content && (
              <>
                <Button onClick={handleDownloadMarkdown} variant="outline" className="border-[#EDE3FF] text-[#6B26EA] hover:bg-[#F5F0FF]">
                  <FileText className="w-4 h-4 mr-2" /> Download .md
                </Button>
                <ResumePDFDownload data={content} />
              </>
            )}
            <Button onClick={handleGenerate} disabled={generating} className="bg-[#6B26EA] hover:bg-[#5A1FD0] text-white">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {resumeData ? 'Regenerate' : 'Generate Resume'}
            </Button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

        {content ? (
          <div className="flex flex-col gap-6">
            {/* Preview */}
            <ResumePreview data={content} />
            {/* Metadata */}
            <div className="text-xs text-[#8B898E] text-center">
              Last generated: {resumeData?.created_at ? new Date(resumeData.created_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#EDE3FF] rounded-xl p-12 text-center">
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
    </AppLayout>
  )
}

function resumeToMarkdown(data: ResumeData): string {
  const lines: string[] = []
  lines.push(`# ${data.name}`)
  lines.push(`**${data.email}**`)
  lines.push('')

  if (data.objective) {
    lines.push('## Objective')
    lines.push(data.objective)
    lines.push('')
  }

  if (data.skills?.length) {
    lines.push('## Skills')
    lines.push(data.skills.join(' · '))
    lines.push('')
  }

  if (data.education?.length) {
    lines.push('## Education')
    for (const edu of data.education) {
      lines.push(`**${edu.institution}** — ${edu.level}`)
      if (edu.details) lines.push(edu.details)
      lines.push('')
    }
  }

  if (data.experience?.length) {
    lines.push('## Experience')
    for (const exp of data.experience) {
      lines.push(`**${exp.title}** — ${exp.organization}`)
      if (exp.description) lines.push(exp.description)
      lines.push('')
    }
  }

  if (data.projects?.length) {
    lines.push('## Projects')
    for (const proj of data.projects) {
      lines.push(`**${proj.title}**`)
      if (proj.description) lines.push(proj.description)
      if (proj.skills_used?.length) lines.push(`*Skills: ${proj.skills_used.join(', ')}*`)
      lines.push('')
    }
  }

  if (data.certifications?.length) {
    lines.push('## Certifications')
    for (const cert of data.certifications) lines.push(`- ${cert}`)
    lines.push('')
  }

  if (data.interests?.length) {
    lines.push('## Interests')
    lines.push(data.interests.join(' · '))
  }

  return lines.join('\n')
}
