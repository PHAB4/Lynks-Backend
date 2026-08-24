'use client'

import { useState } from 'react'
import { Search, Bookmark, ChevronDown } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { cn } from '@/lib/cn'

export default function OpportunitiesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'personal' | 'all'>('personal')
  const [viewMode, setViewMode] = useState<'career' | 'general'>('career')
  const [timeFilter, setTimeFilter] = useState('week')

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-[#F9F5FF]">
        <div className="flex-1 p-4 md:p-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Opportunities</h1>
              <p className="text-sm text-[#8B898E]">AI-powered matches scraped live across the web.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#8B898E]">View Mode:</span>
              <div className="relative">
                <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'career' | 'general')} className="appearance-none py-3 px-4 pr-10 rounded-xl border border-[#EDE3FF] bg-[#F6F5F8] text-sm font-medium text-[#0D0026] cursor-pointer focus:outline-none">
                  <option value="career">Career</option>
                  <option value="general">General Opportunities</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A8] pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-2xl border border-[#EDE3FF] bg-white mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.30)] bg-[rgba(215,212,212,0.10)] px-4 py-2.5 w-full md:w-[500px]">
                <Search size={16} className="text-[rgba(0,0,0,0.30)] shrink-0" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search opportunity..." className="bg-transparent text-base text-[#0D0026] placeholder:text-[rgba(0,0,0,0.30)] focus:outline-none w-full" />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="appearance-none py-3 px-4 pr-10 rounded-xl border border-[#EDE3FF] bg-[#F6F5F8] text-sm font-medium text-[#0D0026] cursor-pointer focus:outline-none">
                    <option value="day">Today</option>
                    <option value="week">Within the week</option>
                    <option value="month">This month</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A8] pointer-events-none" />
                </div>
                <button className="flex items-center justify-center p-3 rounded-[10px] bg-[#F9F5FF] border border-[#EDE3FF]">
                  <Bookmark size={20} className="text-[#6B26EA]" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[13px] font-semibold text-[#8B898E]">Filter Results:</span>
              <button onClick={() => setFilter('personal')} className={cn('py-2 px-4 rounded-full text-sm font-semibold transition-colors', filter === 'personal' ? 'bg-[#6B26EA] text-white' : 'border border-[#EDE3FF] bg-[#F9F5FF] text-[#6B26EA]')}>Personal Matches</button>
              <button onClick={() => setFilter('all')} className={cn('py-2 px-4 rounded-full text-sm font-semibold transition-colors', filter === 'all' ? 'bg-[#6B26EA] text-white' : 'border border-[#EDE3FF] bg-[#F9F5FF] text-[#6B26EA]')}>All Web Scraped</button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center mb-4">
              <Search size={24} className="text-[#6B26EA]" />
            </div>
            <p className="text-lg font-semibold text-[#0D0026] mb-2">No opportunities yet</p>
            <p className="text-sm text-[#8B898E] max-w-md">Once your career profile is set up, AI will match you with relevant opportunities from across the web.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
