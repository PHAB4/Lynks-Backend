'use client'

import { useState, useEffect } from 'react'
import { resume } from '@/lib/api'
import type { ResumeData } from '@/lib/types'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2, ArrowLeft, Save, Check } from 'lucide-react'
import Link from 'next/link'
import ResumePreview from '@/components/ResumePreview'
import { ResumePDFDownload } from '@/components/ResumePDF'

const EMPTY_RESUME: ResumeData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  objective: '',
  education: [],
  skills: [],
  experience: [],
  projects: [],
  certifications: [],
  interests: [],
  custom_sections: [],
}

export default function ResumePage() {
  const [resumeData, setResumeData] = useState<ResumeData>(EMPTY_RESUME)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const [newCert, setNewCert] = useState('')
  const [newInterest, setNewInterest] = useState('')

  useEffect(() => {
    resume.get()
      .then(data => {
        if (data?.content) {
          setResumeData({ ...EMPTY_RESUME, ...data.content } as ResumeData)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setError('')
      const data = await resume.generate()
      if (data?.content) {
        setResumeData({ ...EMPTY_RESUME, ...data.content } as ResumeData)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate resume'
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        setError('Rate limited — the AI service is busy. Please try again in a minute.')
      } else {
        setError(msg)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await resume.save(resumeData as unknown as Record<string, unknown>)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const update = (field: keyof ResumeData, value: unknown) => {
    setResumeData(prev => ({ ...prev, [field]: value }))
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

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F7F3FE]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-12">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-[#6B26EA] hover:text-[#5A1FD0] font-medium mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                My Resume
              </h1>
              <p className="text-sm text-[#8B898E] mt-1">Edit your details below — the preview updates live</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                variant="outline"
                className="border-[#6B26EA] text-[#6B26EA] hover:bg-[#F7F3FE]"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {generating ? 'Generating...' : 'Auto-fill from profile'}
              </Button>
              <ResumePDFDownload data={resumeData} />
              <Button onClick={handleSave} disabled={saving} className="bg-[#6B26EA] hover:bg-[#5A1FD0] text-white">
                {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-4">
              {/* Personal Info */}
              <EditorSection title="Personal Information">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full Name" value={resumeData.name} onChange={v => update('name', v)} placeholder="John Doe" />
                  <Field label="Email" value={resumeData.email} onChange={v => update('email', v)} placeholder="john@email.com" type="email" />
                  <Field label="Phone" value={resumeData.phone} onChange={v => update('phone', v)} placeholder="+1 (868) 555-1234" />
                  <Field label="Address" value={resumeData.address} onChange={v => update('address', v)} placeholder="Port of Spain, Trinidad" />
                </div>
              </EditorSection>

              {/* Objective */}
              <EditorSection title="Career Objective">
                <textarea
                  value={resumeData.objective}
                  onChange={e => update('objective', e.target.value)}
                  placeholder="A brief summary of your career goals and what you bring..."
                  className="w-full py-2.5 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors resize-none h-20"
                />
              </EditorSection>

              {/* Education */}
              <EditorSection title="Education">
                {resumeData.education.map((edu, i) => (
                  <div key={i} className="space-y-2 mb-3 pb-3 border-b border-[rgba(0,0,0,0.05)] last:border-0">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={edu.institution}
                        onChange={e => {
                          const updated = [...resumeData.education]
                          updated[i] = { ...updated[i], institution: e.target.value }
                          update('education', updated)
                        }}
                        placeholder="Institution"
                        className="py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                      />
                      <div className="flex gap-2">
                        <input
                          value={edu.level}
                          onChange={e => {
                            const updated = [...resumeData.education]
                            updated[i] = { ...updated[i], level: e.target.value }
                            update('education', updated)
                          }}
                          placeholder="Degree / Level (e.g. BSc Computer Science)"
                          className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                        />
                        <button onClick={() => update('education', resumeData.education.filter((_, j) => j !== i))} className="p-2 text-[#D14444] hover:bg-red-50 rounded-lg shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={edu.details}
                      onChange={e => {
                        const updated = [...resumeData.education]
                        updated[i] = { ...updated[i], details: e.target.value }
                        update('education', updated)
                      }}
                      placeholder="Dates / GPA (e.g. Sep 2023 – Jun 2027, 3.8 GPA)"
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                    />
                  </div>
                ))}
                <button
                  onClick={() => update('education', [...resumeData.education, { institution: '', level: '', details: '' }])}
                  className="flex items-center gap-1 text-[12px] text-[#6B26EA] font-semibold hover:underline"
                >
                  <Plus size={12} /> Add education
                </button>
              </EditorSection>

              {/* Experience */}
              <EditorSection title="Experience">
                {resumeData.experience.map((exp, i) => (
                  <div key={i} className="space-y-2 mb-3 pb-3 border-b border-[rgba(0,0,0,0.05)] last:border-0">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={exp.title}
                        onChange={e => {
                          const updated = [...resumeData.experience]
                          updated[i] = { ...updated[i], title: e.target.value }
                          update('experience', updated)
                        }}
                        placeholder="Job title / Role"
                        className="py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                      />
                      <div className="flex gap-2">
                        <input
                          value={exp.organization}
                          onChange={e => {
                            const updated = [...resumeData.experience]
                            updated[i] = { ...updated[i], organization: e.target.value }
                            update('experience', updated)
                          }}
                          placeholder="Organization"
                          className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                        />
                        <button onClick={() => update('experience', resumeData.experience.filter((_, j) => j !== i))} className="p-2 text-[#D14444] hover:bg-red-50 rounded-lg shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={exp.dates || ''}
                      onChange={e => {
                        const updated = [...resumeData.experience]
                        updated[i] = { ...updated[i], dates: e.target.value }
                        update('experience', updated)
                      }}
                      placeholder="Dates (e.g. Jun 2024 – Aug 2024)"
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[12px] focus:outline-none focus:border-[#6B26EA]"
                    />
                    <textarea
                      value={exp.description}
                      onChange={e => {
                        const updated = [...resumeData.experience]
                        updated[i] = { ...updated[i], description: e.target.value }
                        update('experience', updated)
                      }}
                      placeholder="Describe your role and achievements..."
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[12px] focus:outline-none focus:border-[#6B26EA] resize-none h-16"
                    />
                  </div>
                ))}
                <button
                  onClick={() => update('experience', [...resumeData.experience, { title: '', organization: '', dates: '', description: '' }])}
                  className="flex items-center gap-1 text-[12px] text-[#6B26EA] font-semibold hover:underline"
                >
                  <Plus size={12} /> Add experience
                </button>
              </EditorSection>

              {/* Projects */}
              <EditorSection title="Projects">
                {resumeData.projects.map((proj, i) => (
                  <div key={i} className="space-y-2 mb-3 pb-3 border-b border-[rgba(0,0,0,0.05)] last:border-0">
                    <div className="flex gap-2">
                      <input
                        value={proj.title}
                        onChange={e => {
                          const updated = [...resumeData.projects]
                          updated[i] = { ...updated[i], title: e.target.value }
                          update('projects', updated)
                        }}
                        placeholder="Project name"
                        className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                      />
                      <button onClick={() => update('projects', resumeData.projects.filter((_, j) => j !== i))} className="p-2 text-[#D14444] hover:bg-red-50 rounded-lg shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      value={proj.description}
                      onChange={e => {
                        const updated = [...resumeData.projects]
                        updated[i] = { ...updated[i], description: e.target.value }
                        update('projects', updated)
                      }}
                      placeholder="Describe the project..."
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[12px] focus:outline-none focus:border-[#6B26EA] resize-none h-16"
                    />
                    <input
                      value={proj.skills_used?.join(', ') || ''}
                      onChange={e => {
                        const updated = [...resumeData.projects]
                        updated[i] = { ...updated[i], skills_used: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                        update('projects', updated)
                      }}
                      placeholder="Technologies (comma-separated, e.g. React, Python, PostgreSQL)"
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[12px] focus:outline-none focus:border-[#6B26EA]"
                    />
                  </div>
                ))}
                <button
                  onClick={() => update('projects', [...resumeData.projects, { title: '', description: '', skills_used: [] }])}
                  className="flex items-center gap-1 text-[12px] text-[#6B26EA] font-semibold hover:underline"
                >
                  <Plus size={12} /> Add project
                </button>
              </EditorSection>

              {/* Skills */}
              <EditorSection title="Skills">
                {resumeData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {resumeData.skills.map((skill, i) => (
                      <span key={i} className="flex items-center gap-1 py-1 px-2.5 rounded-full bg-[#EDE3FF] text-[#6B26EA] text-[12px] font-medium">
                        {skill}
                        <button onClick={() => update('skills', resumeData.skills.filter((_, j) => j !== i))} className="w-3.5 h-3.5 rounded-full bg-[#6B26EA] text-white flex items-center justify-center hover:bg-[#5A1FD0]">
                          <span className="text-[8px]">×</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newSkill.trim()) {
                        update('skills', [...resumeData.skills, newSkill.trim()])
                        setNewSkill('')
                      }
                    }}
                    placeholder="Add a skill..."
                    className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                  />
                  <button
                    onClick={() => {
                      if (newSkill.trim()) {
                        update('skills', [...resumeData.skills, newSkill.trim()])
                        setNewSkill('')
                      }
                    }}
                    disabled={!newSkill.trim()}
                    className="px-3 py-2 rounded-lg bg-[#6B26EA] text-white text-[12px] font-semibold hover:bg-[#5A1FD0] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </EditorSection>

              {/* Certifications */}
              <EditorSection title="Certifications">
                {resumeData.certifications.map((cert, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={cert}
                      onChange={e => {
                        const updated = [...resumeData.certifications]
                        updated[i] = e.target.value
                        update('certifications', updated)
                      }}
                      placeholder="Certification name"
                      className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                    />
                    <button onClick={() => update('certifications', resumeData.certifications.filter((_, j) => j !== i))} className="p-2 text-[#D14444] hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={newCert}
                    onChange={e => setNewCert(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCert.trim()) {
                        update('certifications', [...resumeData.certifications, newCert.trim()])
                        setNewCert('')
                      }
                    }}
                    placeholder="Add certification..."
                    className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                  />
                  <button
                    onClick={() => {
                      if (newCert.trim()) {
                        update('certifications', [...resumeData.certifications, newCert.trim()])
                        setNewCert('')
                      }
                    }}
                    disabled={!newCert.trim()}
                    className="px-3 py-2 rounded-lg bg-[#6B26EA] text-white text-[12px] font-semibold hover:bg-[#5A1FD0] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </EditorSection>

              {/* Interests */}
              <EditorSection title="Interests">
                {resumeData.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {resumeData.interests.map((interest, i) => (
                      <span key={i} className="flex items-center gap-1 py-1 px-2.5 rounded-full bg-[#F7F3FE] text-[#6B26EA] text-[12px] font-medium">
                        {interest}
                        <button onClick={() => update('interests', resumeData.interests.filter((_, j) => j !== i))} className="w-3.5 h-3.5 rounded-full bg-[#6B26EA] text-white flex items-center justify-center hover:bg-[#5A1FD0]">
                          <span className="text-[8px]">×</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newInterest}
                    onChange={e => setNewInterest(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newInterest.trim()) {
                        update('interests', [...resumeData.interests, newInterest.trim()])
                        setNewInterest('')
                      }
                    }}
                    placeholder="Add an interest..."
                    className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] focus:outline-none focus:border-[#6B26EA]"
                  />
                  <button
                    onClick={() => {
                      if (newInterest.trim()) {
                        update('interests', [...resumeData.interests, newInterest.trim()])
                        setNewInterest('')
                      }
                    }}
                    disabled={!newInterest.trim()}
                    className="px-3 py-2 rounded-lg bg-[#6B26EA] text-white text-[12px] font-semibold hover:bg-[#5A1FD0] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </EditorSection>

              {/* Custom Sections */}
              <EditorSection title="Custom Sections">
                <p className="text-[11px] text-[#8B898E] mb-3">Add your own sections — Volunteer Work, Publications, Languages, etc.</p>
                {(resumeData.custom_sections || []).map((section, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-[rgba(0,0,0,0.05)] last:border-0 last:mb-0 last:pb-0">
                    <div className="flex gap-2 mb-2">
                      <input
                        value={section.title}
                        onChange={e => {
                          const updated = [...(resumeData.custom_sections || [])]
                          updated[i] = { ...updated[i], title: e.target.value }
                          update('custom_sections', updated)
                        }}
                        placeholder="Section title (e.g. Volunteer Work)"
                        className="flex-1 py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] font-semibold focus:outline-none focus:border-[#6B26EA]"
                      />
                      <button
                        onClick={() => update('custom_sections', (resumeData.custom_sections || []).filter((_, j) => j !== i))}
                        className="p-2 text-[#D14444] hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea
                      value={section.content}
                      onChange={e => {
                        const updated = [...(resumeData.custom_sections || [])]
                        updated[i] = { ...updated[i], content: e.target.value }
                        update('custom_sections', updated)
                      }}
                      placeholder="Describe this section..."
                      className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[12px] focus:outline-none focus:border-[#6B26EA] resize-none h-20"
                    />
                  </div>
                ))}
                <button
                  onClick={() => update('custom_sections', [...(resumeData.custom_sections || []), { title: '', content: '' }])}
                  className="flex items-center gap-1 text-[12px] text-[#6B26EA] font-semibold hover:underline"
                >
                  <Plus size={12} /> Add custom section
                </button>
              </EditorSection>
            </div>

            {/* Live Preview */}
            <div className="lg:sticky lg:top-4 lg:self-start">
              <p className="text-[12px] font-semibold text-[#8B898E] uppercase tracking-wider mb-3">Preview</p>
              <ResumePreview data={resumeData} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EDE3FF] p-5">
      <h3 className="text-[14px] font-semibold text-[#0D0026] mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[rgba(30,30,30,0.50)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full py-2 px-3 rounded-lg border border-[rgba(0,0,0,0.15)] bg-white text-[13px] text-[#1E1E1E] focus:outline-none focus:border-[#6B26EA] transition-colors"
      />
    </div>
  )
}
