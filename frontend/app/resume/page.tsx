'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { resume } from '@/lib/api'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Loader2, Download, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function ResumePage() {
  const { user } = useAuth()
  const [resumeData, setResumeData] = useState<{ resume_id: string; content: string; created_at: string } | null>(null)
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
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate resume')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!resumeData?.content) return
    const blob = new Blob([resumeData.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lynks-resume-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Resume</h1>
            <p className="text-sm text-gray-500 mt-1">AI-generated resume based on your profile and completed tasks</p>
          </div>
          <div className="flex gap-2">
            {resumeData && (
              <Button onClick={handleDownload} variant="outline" className="border-gray-200">
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            )}
            <Button onClick={handleGenerate} disabled={generating} className="bg-purple-600 hover:bg-purple-700 text-white">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {resumeData ? 'Regenerate' : 'Generate Resume'}
            </Button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

        {resumeData ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
              <FileText className="w-4 h-4" />
              Last generated: {new Date(resumeData.created_at).toLocaleDateString()}
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-[family-name:var(--font-geist-sans)]">
              {resumeData.content}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No resume yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Generate a professional resume using your profile information, completed roadmap tasks, and uploaded evidence.
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="bg-purple-600 hover:bg-purple-700 text-white">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {generating ? 'Generating...' : 'Generate My Resume'}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
