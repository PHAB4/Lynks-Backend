'use client'

import { useState } from 'react'
import { Search, MapPin, DollarSign, ExternalLink, Bookmark, BookmarkCheck, Clock, ChevronDown, Eye } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'

type FilterTab = 'personal' | 'all'
type ViewMode = 'career' | 'general'
type TimeFilter = 'today' | 'week' | 'month'

const CAREER_JOBS = [
  { id: 1, title: 'Senior Frontend Developer', company: 'TechCorp Inc.', location: 'San Francisco, CA (Hybrid)', salary: '$120k - $160k', source: 'LinkedIn', posted: '2h ago', recency: 1 },
  { id: 2, title: 'Full Stack Engineer', company: 'CloudNine Systems', location: 'Seattle, WA (Remote)', salary: '$130k - $170k', source: 'Indeed', posted: '5h ago', recency: 2 },
  { id: 3, title: 'Data Scientist', company: 'DataFlow Analytics', location: 'New York, NY (Remote)', salary: '$100k - $130k', source: 'Glassdoor', posted: '1d ago', recency: 3 },
  { id: 4, title: 'UX Designer', company: 'DesignStudio', location: 'Los Angeles, CA (Remote)', salary: '$85k - $110k', source: 'Dribbble', posted: '1d ago', recency: 4 },
  { id: 5, title: 'Machine Learning Engineer', company: 'AI Ventures', location: 'Boston, MA (Remote)', salary: '$140k - $180k', source: 'AngelList', posted: '2d ago', recency: 5 },
  { id: 6, title: 'Backend Developer', company: 'ServerStack', location: 'Austin, TX (Hybrid)', salary: '$110k - $145k', source: 'LinkedIn', posted: '3d ago', recency: 6 },
]

const GENERAL_OPPORTUNITIES = [
  { id: 101, title: 'Youth Leadership Program', company: 'Caribbean Development Bank', location: 'Remote / Trinidad', salary: 'Stipend', source: 'Web Scraped', posted: '1d ago', recency: 1, type: 'Youth Group' },
  { id: 102, title: 'Summer Internship — Tech', company: 'Google Caribbean', location: 'Remote', salary: 'Paid', source: 'Web Scraped', posted: '3h ago', recency: 2, type: 'Internship' },
  { id: 103, title: 'Senior Frontend Developer', company: 'TechCorp Inc.', location: 'San Francisco, CA (Hybrid)', salary: '$120k - $160k', source: 'LinkedIn', posted: '2h ago', recency: 3, type: 'Job' },
  { id: 104, title: 'Community Innovation Grant', company: 'UNICEF Innovation', location: 'Global / Remote', salary: 'Up to $25k', source: 'Web Scraped', posted: '5h ago', recency: 4, type: 'Grant' },
  { id: 105, title: 'UX Design Bootcamp', company: 'DesignCode', location: 'Online', salary: 'Free', source: 'Web Scraped', posted: '1d ago', recency: 5, type: 'Education' },
  { id: 106, title: 'Data Science Intern', company: 'DataFlow Analytics', location: 'New York, NY (Remote)', salary: 'Paid', source: 'Indeed', posted: '1d ago', recency: 6, type: 'Internship' },
]

export default function OpportunitiesPage() {
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('career')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const [showSaved, setShowSaved] = useState(false)
  const [showViewDropdown, setShowViewDropdown] = useState(false)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)

  const baseData = viewMode === 'career' ? CAREER_JOBS : GENERAL_OPPORTUNITIES
  const opportunities = showSaved ? baseData.filter(o => savedIds.has(o.id)) : baseData

  const filtered = opportunities.filter(opp => {
    const matchesSearch = !search ||
      opp.title.toLowerCase().includes(search.toLowerCase()) ||
      opp.company.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const toggleSave = (id: number) => {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F9F5FF]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* Top bar: Search + View Mode */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 flex items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-white px-4 py-3">
              <Search size={16} className="text-[rgba(0,0,0,0.30)] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunity..."
                className="bg-transparent text-[14px] text-[#0D0026] placeholder:text-[rgba(0,0,0,0.30)] focus:outline-none w-full"
              />
            </div>

            {/* Time filter */}
            <div className="relative">
              <button
                onClick={() => { setShowTimeDropdown(!showTimeDropdown); setShowViewDropdown(false) }}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-[rgba(0,0,0,0.12)] bg-white text-[13px] text-[rgba(30,30,30,0.60)] hover:bg-[#F7F3FE] transition-colors"
              >
                <Clock size={14} />
                <span className="capitalize">{timeFilter}</span>
                <ChevronDown size={12} />
              </button>
              {showTimeDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#EDE3FF] shadow-lg py-1 z-30 min-w-[120px]">
                  {(['today', 'week', 'month'] as TimeFilter[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTimeFilter(t); setShowTimeDropdown(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-[13px] hover:bg-[#F7F3FE] transition-colors',
                        t === timeFilter ? 'text-[#6B26EA] font-semibold' : 'text-[rgba(30,30,30,0.60)]'
                      )}
                    >
                      {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Save icon */}
            <button
              onClick={() => setShowSaved(!showSaved)}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl border transition-colors',
                showSaved
                  ? 'bg-[#6B26EA] border-[#6B26EA] text-white'
                  : 'bg-white border-[rgba(0,0,0,0.12)] text-[rgba(30,30,30,0.40)] hover:bg-[#F7F3FE]'
              )}
            >
              <Bookmark size={16} fill={showSaved ? 'white' : 'none'} />
            </button>

            {/* View Mode */}
            <div className="relative">
              <button
                onClick={() => { setShowViewDropdown(!showViewDropdown); setShowTimeDropdown(false) }}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-[rgba(0,0,0,0.12)] bg-white text-[13px] text-[rgba(30,30,30,0.60)] hover:bg-[#F7F3FE] transition-colors"
              >
                <Eye size={14} />
                <span>View: {viewMode === 'career' ? 'Career' : 'General'}</span>
                <ChevronDown size={12} />
              </button>
              {showViewDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#EDE3FF] shadow-lg py-1 z-30 min-w-[150px]">
                  {([
                    { id: 'career' as ViewMode, label: 'Career', desc: 'Job opportunities only' },
                    { id: 'general' as ViewMode, label: 'General', desc: 'All scraped opportunities' },
                  ]).map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setViewMode(v.id); setShowViewDropdown(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 hover:bg-[#F7F3FE] transition-colors',
                        v.id === viewMode ? 'bg-[#F7F3FE]' : ''
                      )}
                    >
                      <p className={cn('text-[13px] font-semibold', v.id === viewMode ? 'text-[#6B26EA]' : 'text-[#0D0026]')}>{v.label}</p>
                      <p className="text-[11px] text-[#8B898E]">{v.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => { setFilterTab('all'); setShowSaved(false) }}
              className={cn(
                'py-2 px-4 rounded-full text-[13px] font-semibold transition-colors',
                filterTab === 'all' && !showSaved
                  ? 'bg-[#6B26EA] text-white'
                  : 'border border-[#EDE3FF] bg-white text-[#6B26EA] hover:bg-[#F7F3FE]'
              )}
            >
              All Web-scraped
            </button>
            <button
              onClick={() => { setFilterTab('personal'); setShowSaved(false) }}
              className={cn(
                'py-2 px-4 rounded-full text-[13px] font-semibold transition-colors',
                filterTab === 'personal' && !showSaved
                  ? 'bg-[#6B26EA] text-white'
                  : 'border border-[#EDE3FF] bg-white text-[#6B26EA] hover:bg-[#F7F3FE]'
              )}
            >
              Personal matches
            </button>
            {showSaved && (
              <span className="text-[13px] text-[#6B26EA] font-semibold ml-2">Saved ({savedIds.size})</span>
            )}
          </div>

          {/* Opportunity count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-[#8B898E]">
              {filtered.length} {viewMode === 'career' ? 'opportunities' : 'opportunities'} found
            </p>
          </div>

          {/* Opportunity cards */}
          <div className="space-y-3">
            {filtered.map((opp) => {
              const isSaved = savedIds.has(opp.id)
              return (
                <div
                  key={opp.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-[#EDE3FF] bg-white hover:shadow-[0_4px_16px_rgba(107,38,234,0.06)] transition-all"
                >
                  {/* Company icon */}
                  <div className="w-10 h-10 rounded-xl bg-[#EADFFF] flex items-center justify-center shrink-0">
                    <span className="text-[#6B26EA] text-[13px] font-bold">
                      {opp.company.charAt(0)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[14px] font-semibold text-[#0D0026] truncate">
                        {opp.title}
                      </h3>
                      {'type' in opp && (
                        <span className="py-0.5 px-2 rounded-full bg-[#F7F3FE] text-[10px] text-[#6B26EA] font-semibold shrink-0">
                          {(opp as & { type?: string }).type}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#8B898E]">{opp.company}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[11px] text-[#8B898E]">
                        <MapPin size={10} /> {opp.location}
                      </span>
                      {opp.salary && (
                        <span className="flex items-center gap-1 text-[11px] text-[#6B26EA] font-semibold">
                          <DollarSign size={10} /> {opp.salary}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: recency + save + source */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] text-[#D1D5DB]">{opp.recency}</span>
                    <button
                      onClick={() => toggleSave(opp.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                    >
                      {isSaved ? (
                        <BookmarkCheck size={16} className="text-[#6B26EA]" fill="#6B26EA" />
                      ) : (
                        <Bookmark size={16} className="text-[#D1D5DB] hover:text-[#6B26EA]" />
                      )}
                    </button>
                  </div>

                  {/* Go to source */}
                  <a
                    href="#"
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-[#6B26EA] text-white text-[12px] font-semibold hover:bg-[#5A1FD0] transition-colors shrink-0"
                  >
                    Go to source
                    <ExternalLink size={12} />
                  </a>
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-[#EADFFF] flex items-center justify-center mb-3">
                <Search size={20} className="text-[#6B26EA]" />
              </div>
              <p className="text-[15px] font-semibold text-[#0D0026] mb-1">
                {showSaved ? 'No saved opportunities' : 'No opportunities found'}
              </p>
              <p className="text-[13px] text-[#8B898E] max-w-sm">
                {showSaved
                  ? 'Save opportunities by clicking the bookmark icon on any card.'
                  : 'Try adjusting your search or filters to find more opportunities.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
