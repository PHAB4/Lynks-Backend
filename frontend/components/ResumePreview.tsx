'use client'

import type { ResumeData } from '@/lib/types'

export default function ResumePreview({ data }: { data: ResumeData }) {
  const hasContact = data.phone || data.email || data.address

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <div className="px-10 py-8">
        {/* Header — Harvard/Yale style: name centered, contact below */}
        <div className="text-center mb-1">
          <h1 className="text-[22px] font-bold text-black tracking-wide uppercase" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            {data.name || 'Your Name'}
          </h1>
          {hasContact && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-[#444] mt-1 flex-wrap">
              {data.address && <span>{data.address}</span>}
              {data.address && data.phone && <span>|</span>}
              {data.phone && <span>{data.phone}</span>}
              {data.phone && data.email && <span>|</span>}
              {data.email && <span>{data.email}</span>}
            </div>
          )}
        </div>

        {/* Horizontal rule */}
        <div className="h-[2px] bg-black mt-3 mb-5" />

        {/* Objective / Summary */}
        {data.objective && (
          <Section title="Objective">
            <p className="text-[12px] text-[#333] leading-relaxed">{data.objective}</p>
          </Section>
        )}

        {/* Education */}
        {data.education?.length > 0 && (
          <Section title="Education">
            {data.education.map((edu, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] font-bold text-black">{edu.institution}</p>
                  {edu.details && <p className="text-[11px] text-[#555] italic">{edu.details}</p>}
                </div>
                <p className="text-[11px] text-[#444] italic">{edu.level}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Experience */}
        {data.experience?.length > 0 && (
          <Section title="Experience">
            {data.experience.map((exp, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] font-bold text-black">{exp.title}</p>
                </div>
                <p className="text-[11px] text-[#444] italic mb-0.5">{exp.organization}</p>
                {exp.description && (
                  <p className="text-[11px] text-[#333] leading-relaxed">{exp.description}</p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Projects */}
        {data.projects?.length > 0 && (
          <Section title="Projects">
            {data.projects.map((proj, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <p className="text-[12px] font-bold text-black">{proj.title}</p>
                {proj.description && (
                  <p className="text-[11px] text-[#333] leading-relaxed mt-0.5">{proj.description}</p>
                )}
                {proj.skills_used?.length > 0 && (
                  <p className="text-[10px] text-[#555] mt-1 italic">
                    Technologies: {proj.skills_used.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Skills */}
        {data.skills?.length > 0 && (
          <Section title="Skills">
            <p className="text-[11px] text-[#333] leading-relaxed">
              {data.skills.join(' · ')}
            </p>
          </Section>
        )}

        {/* Certifications */}
        {data.certifications?.length > 0 && (
          <Section title="Certifications">
            <ul className="list-none space-y-0.5">
              {data.certifications.map((cert, i) => (
                <li key={i} className="text-[11px] text-[#333]">
                  • {cert}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Interests */}
        {data.interests?.length > 0 && (
          <Section title="Interests">
            <p className="text-[11px] text-[#333]">
              {data.interests.join(' · ')}
            </p>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <h2 className="text-[12px] font-bold text-black uppercase tracking-wider border-b border-black pb-0.5 mb-2"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        {title}
      </h2>
      {children}
    </div>
  )
}
