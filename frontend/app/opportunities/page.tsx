'use client'

import { useState } from 'react'
import { Search, MapPin, DollarSign, Bookmark, ChevronDown } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'

const OPPORTUNITIES = [
  { id: 1, title: 'AI Product Designer', company: 'Future Labs', location: 'San Francisco, CA (Hybrid)', salary: '$130k - $160k', logo: '🏢' },
  { id: 2, title: 'Frontend Engineer', company: 'Lynks Corp', location: 'New York, NY (Remote)', salary: '$110k - $140k', logo: '💻' },
  { id: 3, title: 'Data Analyst', company: 'Insight Analytics', location: 'Austin, TX (On-site)', salary: '$95k - $120k', logo: '📊' },
  { id: 4, title: 'UX Researcher', company: 'Human Scale', location: 'Remote', salary: '$105k - $125k', logo: '🎨' },
  { id: 5, title: 'Machine Learning Eng.', company: 'Cognitive AI', location: 'Seattle, WA (Hybrid)', salary: '$160k - $190k', logo: '🤖' },
  { id: 6, title: 'Product Manager', company: 'Velocity Software', location: 'Denver, CO (Remote)', salary: '$120k - $150k', logo: '🚀' },
  { id: 7, title: 'Brand Identity Designer', company: 'Studio Craft', location: 'Los Angeles, CA', salary: '$90k - $115k', logo: '✨' },
  { id: 8, title: 'Operations Coordinator', company: 'Flow Logistics', location: 'Chicago, IL (Hybrid)', salary: '$80k - $100k', logo: '📋' },
]

export default function OpportunitiesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'personal' | 'all'>('personal')
  const [viewMode, setViewMode] = useState<'career' | 'general'>('career')
  const [timeFilter, setTimeFilter] = useState('week')
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const toggleSave = (id: number) => { setSaved(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-surface-alt">
        <div className="flex-1 p-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-[40px] font-semibold leading-[50px] text-text-primary">Opportunities</h1>
              <p className="text-sm text-text-secondary">AI-powered matches scraped live across the web.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-secondary">View Mode:</span>
              <div className="relative">
                <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'career' | 'general')} className="appearance-none py-3 px-4 pr-10 rounded-xl border border-border bg-surface-muted text-sm font-medium text-text-primary cursor-pointer focus:outline-none">
                  <option value="career">Career</option>
                  <option value="general">General Opportunities</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-surface mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5 rounded-[10px] border border-border-strong bg-[rgba(215,212,212,0.10)] px-4 py-2.5 w-[500px]">
                <Search size={16} className="text-text-input shrink-0" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search opportunity....." className="bg-transparent text-base text-text-primary placeholder:text-text-input focus:outline-none w-full" />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="appearance-none py-3 px-4 pr-10 rounded-xl border border-border bg-surface-muted text-sm font-medium text-text-primary cursor-pointer focus:outline-none">
                    <option value="day">Today</option>
                    <option value="week">Within the week</option>
                    <option value="month">This month</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
                <button className="flex items-center justify-center p-3 rounded-[10px] bg-surface-alt border border-border">
                  <Bookmark size={20} className="text-primary" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-text-secondary">Filter Results:</span>
              <button onClick={() => setFilter('personal')} className={cn('py-2 px-4 rounded-full text-sm font-semibold transition-colors', filter === 'personal' ? 'bg-primary text-white' : 'border border-border bg-surface-alt text-primary')}>Personal Matches</button>
              <button onClick={() => setFilter('all')} className={cn('py-2 px-4 rounded-full text-sm font-semibold transition-colors', filter === 'all' ? 'bg-primary text-white' : 'border border-border bg-surface-alt text-primary')}>All Web Scraped</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {OPPORTUNITIES.map((opp) => (
              <div key={opp.id} className="flex flex-col gap-4 p-4 rounded-2xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex items-center justify-center w-12 h-12 rounded-[10px] bg-surface-alt text-xl">{opp.logo}</div>
                  <div className="flex items-center gap-2">
                    <span className="py-1 px-2 rounded-md bg-surface-alt text-xs font-bold text-primary">#{opp.id}</span>
                    <button onClick={() => toggleSave(opp.id)} className={cn('flex items-center justify-center w-8 h-8 rounded-lg transition-colors', saved.has(opp.id) ? 'bg-primary text-white' : 'bg-surface-alt')}>
                      <Bookmark size={14} className={saved.has(opp.id) ? 'fill-white text-white' : 'text-primary'} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1"><p className="text-base font-semibold text-text-primary truncate">{opp.title}</p><p className="text-sm font-medium text-text-secondary">{opp.company}</p></div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5"><MapPin size={14} className="text-text-muted shrink-0" /><p className="text-xs text-text-secondary truncate">{opp.location}</p></div>
                  <div className="flex items-center gap-1.5"><DollarSign size={14} className="text-text-muted shrink-0" /><p className="text-xs font-semibold text-primary">{opp.salary}</p></div>
                </div>
                <div className="flex justify-between items-center mt-auto pt-1">
                  <p className="text-[11px] text-text-muted">AI Scraped</p>
                  <button className="py-1.5 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors">Go to source</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}