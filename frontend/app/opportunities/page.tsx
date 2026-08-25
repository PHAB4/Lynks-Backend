'use client'

import { useState } from 'react'
import { Search, MapPin, DollarSign, ExternalLink, Filter, Briefcase } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'

const CATEGORIES = [
  'Software Engineering',
  'Data Science',
  'Project Management',
  'UX Design',
]

const MOCK_JOBS = [
  {
    id: 1,
    title: 'Senior Frontend Developer',
    company: 'TechCorp Inc.',
    location: 'San Francisco, CA (Hybrid)',
    salary: '$120k - $160k',
    category: 'Software Engineering',
    posted: '2 days ago',
    source: 'LinkedIn',
    logo: '🏢',
  },
  {
    id: 2,
    title: 'Data Scientist',
    company: 'DataFlow Analytics',
    location: 'New York, NY (Remote)',
    salary: '$100k - $130k',
    category: 'Data Science',
    posted: '1 day ago',
    source: 'Indeed',
    logo: '📊',
  },
  {
    id: 3,
    title: 'Product Manager',
    company: 'InnovateTech',
    location: 'Austin, TX (On-site)',
    salary: '$90k - $120k',
    category: 'Project Management',
    posted: '3 days ago',
    source: 'Glassdoor',
    logo: '🚀',
  },
  {
    id: 4,
    title: 'UX Designer',
    company: 'DesignStudio',
    location: 'Los Angeles, CA (Remote)',
    salary: '$85k - $110k',
    category: 'UX Design',
    posted: '5 hours ago',
    source: 'Dribbble',
    logo: '🎨',
  },
  {
    id: 5,
    title: 'Full Stack Engineer',
    company: 'CloudNine Systems',
    location: 'Seattle, WA (Hybrid)',
    salary: '$130k - $170k',
    category: 'Software Engineering',
    posted: '1 day ago',
    source: 'LinkedIn',
    logo: '☁️',
  },
  {
    id: 6,
    title: 'Machine Learning Engineer',
    company: 'AI Ventures',
    location: 'Boston, MA (Remote)',
    salary: '$140k - $180k',
    category: 'Data Science',
    posted: '4 days ago',
    source: 'AngelList',
    logo: '🤖',
  },
]

export default function OpportunitiesPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredJobs = MOCK_JOBS.filter(job => {
    const matchesSearch = !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !selectedCategory || job.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F9F5FF]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[40px] font-semibold leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              Opportunities
            </h1>
            <p className="text-sm text-[#8B898E]">AI-powered matches scraped live across the web.</p>
          </div>

          {/* Search + Filters */}
          <div className="p-5 rounded-2xl border border-[#EDE3FF] bg-white mb-6">
            {/* Search Bar */}
            <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.30)] bg-[rgba(215,212,212,0.10)] px-4 py-3 mb-5">
              <Search size={18} className="text-[rgba(0,0,0,0.30)] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunity..."
                className="bg-transparent text-base text-[#0D0026] placeholder:text-[rgba(0,0,0,0.30)] focus:outline-none w-full"
              />
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[13px] font-semibold text-[#8B898E]">Filter Results:</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    'py-2 px-4 rounded-full text-sm font-semibold transition-colors',
                    selectedCategory === cat
                      ? 'bg-[#6B26EA] text-white'
                      : 'border border-[#EDE3FF] bg-[#F9F5FF] text-[#6B26EA] hover:bg-[#EDE3FF]'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Job Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-5 rounded-2xl border border-[#EDE3FF] bg-white hover:shadow-[0_8px_24px_rgba(107,38,234,0.08)] transition-shadow"
              >
                {/* Company Logo + Title */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#F9F5FF] flex items-center justify-center text-2xl shrink-0">
                    {job.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#1E1E1E] truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.title}
                    </h3>
                    <p className="text-sm text-[#6B26EA] font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.company}
                    </p>
                  </div>
                </div>

                {/* Location + Salary */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#8E8C94] shrink-0" />
                    <p className="line-clamp-1 text-[#6C6A72] text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={14} className="text-[#8E8C94] shrink-0" />
                    <p className="text-[#6B26EA] text-xs font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.salary}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-3 border-t border-[rgba(30,30,30,0.07)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8E8C94] text-[11px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.posted}
                    </span>
                    <span className="text-[#8E8C94] text-[11px]">•</span>
                    <span className="text-[#8E8C94] text-[11px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {job.source}
                    </span>
                  </div>
                  <button className="py-1.5 px-3 rounded-lg bg-[#6B26EA] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#5A1FD0] transition-colors">
                    Go to source
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center mb-4">
                <Search size={24} className="text-[#6B26EA]" />
              </div>
              <p className="text-lg font-semibold text-[#0D0026] mb-2">No opportunities found</p>
              <p className="text-sm text-[#8B898E] max-w-md">
                Try adjusting your search or filters to find more opportunities.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
