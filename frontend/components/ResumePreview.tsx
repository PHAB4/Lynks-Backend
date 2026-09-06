'use client'

import type { ResumeData } from '@/lib/types'
import { User, Mail, Target, GraduationCap, Wrench, Briefcase, FolderOpen, Award, Heart } from 'lucide-react'

export default function ResumePreview({ data }: { data: ResumeData }) {
  return (
    <div className="bg-white border border-[#EDE3FF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#6B26EA] to-[#8B5CF6] text-white px-8 py-6">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <div className="flex items-center gap-3 mt-1 text-white/80 text-sm">
          <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{data.email}</span>
        </div>
        {data.objective && (
          <p className="mt-3 text-sm text-white/90 leading-relaxed">{data.objective}</p>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Skills */}
        {data.skills?.length > 0 && (
          <Section icon={<Wrench className="w-4 h-4" />} title="Skills">
            <div className="flex flex-wrap gap-2">
              {data.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-[#F5F0FF] text-[#6B26EA] text-sm font-medium rounded-full">{skill}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Education */}
        {data.education?.length > 0 && (
          <Section icon={<GraduationCap className="w-4 h-4" />} title="Education">
            <div className="space-y-3">
              {data.education.map((edu, i) => (
                <div key={i}>
                  <p className="font-semibold text-[#0D0026] text-sm">{edu.institution}</p>
                  <p className="text-xs text-[#6B26EA] font-medium">{edu.level}</p>
                  {edu.details && <p className="text-sm text-[#4A4A4A] mt-0.5">{edu.details}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Experience */}
        {data.experience?.length > 0 && (
          <Section icon={<Briefcase className="w-4 h-4" />} title="Experience">
            <div className="space-y-3">
              {data.experience.map((exp, i) => (
                <div key={i}>
                  <p className="font-semibold text-[#0D0026] text-sm">{exp.title}</p>
                  <p className="text-xs text-[#6B26EA] font-medium">{exp.organization}</p>
                  {exp.description && <p className="text-sm text-[#4A4A4A] mt-0.5">{exp.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Projects */}
        {data.projects?.length > 0 && (
          <Section icon={<FolderOpen className="w-4 h-4" />} title="Projects">
            <div className="space-y-3">
              {data.projects.map((proj, i) => (
                <div key={i}>
                  <p className="font-semibold text-[#0D0026] text-sm">{proj.title}</p>
                  {proj.description && <p className="text-sm text-[#4A4A4A] mt-0.5">{proj.description}</p>}
                  {proj.skills_used?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {proj.skills_used.map((s, j) => (
                        <span key={j} className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Certifications */}
        {data.certifications?.length > 0 && (
          <Section icon={<Award className="w-4 h-4" />} title="Certifications">
            <ul className="list-disc list-inside text-sm text-[#4A4A4A] space-y-1">
              {data.certifications.map((cert, i) => (
                <li key={i}>{cert}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Interests */}
        {data.interests?.length > 0 && (
          <Section icon={<Heart className="w-4 h-4" />} title="Interests">
            <div className="flex flex-wrap gap-2">
              {data.interests.map((interest, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{interest}</span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#6B26EA]">{icon}</span>
        <h2 className="text-sm font-bold text-[#0D0026] uppercase tracking-wide">{title}</h2>
        <div className="flex-1 h-px bg-[#EDE3FF]" />
      </div>
      {children}
    </div>
  )
}
