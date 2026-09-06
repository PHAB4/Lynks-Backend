'use client'

import type { ResumeData } from '@/lib/types'

export default function ResumePreview({ data }: { data: ResumeData }) {
  const hasContact = data.phone || data.email || data.address

  const isEmpty =
    !data.name && !data.email && !data.objective &&
    data.education.length === 0 && data.skills.length === 0 &&
    data.experience.length === 0 && data.projects.length === 0 &&
    data.certifications.length === 0 && data.interests.length === 0

  if (isEmpty) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm p-10 text-center">
        <p className="text-[14px] text-[#8B898E] italic" style={{ fontFamily: "'Georgia', serif" }}>
          Click &ldquo;Auto-fill from profile&rdquo; or start editing to preview your resume
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      <div className="px-8 py-6 sm:px-10 sm:py-8" style={{ fontSize: '11px', lineHeight: '1.4' }}>
        {/* Header — centered name, contact below */}
        <div className="text-center mb-1">
          <h1
            className="text-[18px] sm:text-[20px] font-bold text-black tracking-wide uppercase"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            {data.name || 'Your Name'}
          </h1>
          {hasContact && (
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#444] mt-0.5 flex-wrap">
              {data.address && <span>{data.address}</span>}
              {data.address && data.phone && <span className="text-[#999]">|</span>}
              {data.phone && <span>{data.phone}</span>}
              {data.phone && data.email && <span className="text-[#999]">|</span>}
              {data.email && <span>{data.email}</span>}
            </div>
          )}
        </div>

        <hr className="border-t border-black mt-2 mb-4" />

        {/* Objective */}
        {data.objective && (
          <Section title="Objective">
            <p className="text-[10.5px] text-[#333] leading-[1.5]">{data.objective}</p>
          </Section>
        )}

        {/* Education */}
        {data.education?.length > 0 && (
          <Section title="Education">
            {data.education.map((edu, i) => (
              <div key={i} className="mb-1.5 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10.5px] font-bold text-black">{edu.institution}</span>
                  {edu.details && <span className="text-[9.5px] text-[#666] italic">{edu.details}</span>}
                </div>
                <p className="text-[10px] text-[#555] italic">{edu.level}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Experience */}
        {data.experience?.length > 0 && (
          <Section title="Experience">
            {data.experience.map((exp, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10.5px] font-bold text-black">{exp.title}</span>
                  {exp.dates && <span className="text-[9.5px] text-[#666] italic shrink-0">{exp.dates}</span>}
                </div>
                <p className="text-[10px] text-[#555] italic">{exp.organization}</p>
                {exp.description && (
                  <p className="text-[10px] text-[#333] leading-[1.5] mt-0.5 whitespace-pre-line">{exp.description}</p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Projects */}
        {data.projects?.length > 0 && (
          <Section title="Projects">
            {data.projects.map((proj, i) => (
              <div key={i} className="mb-1.5 last:mb-0">
                <span className="text-[10.5px] font-bold text-black">{proj.title}</span>
                {proj.description && (
                  <p className="text-[10px] text-[#333] leading-[1.5] mt-0.5 whitespace-pre-line">{proj.description}</p>
                )}
                {proj.skills_used?.length > 0 && (
                  <p className="text-[9.5px] text-[#666] mt-0.5 italic">
                    Technologies: {Array.isArray(proj.skills_used) ? proj.skills_used.join(', ') : String(proj.skills_used)}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Skills */}
        {data.skills?.length > 0 && (
          <Section title="Skills">
            <p className="text-[10px] text-[#333] leading-[1.5]">
              {Array.isArray(data.skills) ? data.skills.join(' · ') : String(data.skills)}
            </p>
          </Section>
        )}

        {/* Certifications */}
        {data.certifications?.length > 0 && (
          <Section title="Certifications">
            <ul className="list-none m-0 p-0">
              {data.certifications.map((cert, i) => (
                <li key={i} className="text-[10px] text-[#333] leading-[1.6] pl-3 relative before:content-['•'] before:absolute before:left-0">
                  {cert}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Interests */}
        {data.interests?.length > 0 && (
          <Section title="Interests">
            <p className="text-[10px] text-[#333]">
              {data.interests.join(' · ')}
            </p>
          </Section>
        )}

        {/* Custom Sections */}
        {data.custom_sections?.filter(s => s.title.trim() || s.content.trim()).map((section, i) => (
          <Section key={i} title={section.title || 'Untitled Section'}>
            <p className="text-[10px] text-[#333] leading-[1.5] whitespace-pre-line">{section.content}</p>
          </Section>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <h2
        className="text-[10.5px] font-bold text-black uppercase tracking-wider border-b border-black pb-0.5 mb-1.5"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}
