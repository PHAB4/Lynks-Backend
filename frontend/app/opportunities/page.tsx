'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { opportunities } from '@/lib/api'
import type { Opportunity } from '@/lib/types'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Bookmark, BookmarkCheck, ExternalLink, Loader2, Briefcase, MapPin, DollarSign, Globe, Star, ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Jobs', value: 'job' },
  { label: 'Scholarships', value: 'scholarship' },
  { label: 'Competitions', value: 'competition' },
  { label: 'Events', value: 'event' },
  { label: 'Volunteer', value: 'volunteer' },
  { label: 'Clubs', value: 'club' },
]

const SOURCE_COLORS: Record<string, string> = {
  linkedin: 'bg-blue-50 text-blue-700 border-blue-200',
  indeed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  unstop: 'bg-orange-50 text-orange-700 border-orange-200',
  coursera: 'bg-green-50 text-green-700 border-green-200',
  hacked: 'bg-red-50 text-red-700 border-red-200',
  ycombinator: 'bg-amber-50 text-amber-700 border-amber-200',
  cured: 'bg-purple-50 text-purple-700 border-purple-200',
  curated: 'bg-gray-50 text-gray-600 border-gray-200',
}

function getSourceColor(source?: string | null): string {
  if (!source) return SOURCE_COLORS.curated
  return SOURCE_COLORS[source.toLowerCase()] || SOURCE_COLORS.curated
}

function formatSalary(min?: number | null, max?: number | null, currency?: string | null): string | null {
  if (!min && !max) return null
  const cur = currency || 'USD'
  const fmt = (n: number) => n >= 1000 ? `${cur} ${(n / 1000).toFixed(0)}k` : `${cur} ${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

export default function OpportunitiesPage() {
  const { user } = useAuth()
  const [allOpps, setAllOpps] = useState<Opportunity[]>([])
  const [savedList, setSavedList] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [tab, setTab] = useState<'discover' | 'saved'>('discover')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await opportunities.list({ category: category || undefined, page, limit: 20 })
      setAllOpps(res.opportunities ?? [])
      setTotalPages(res.metadata?.total_pages ?? 1)
      setTotalResults(res.metadata?.total_available ?? 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [category, page])

  const fetchSaved = useCallback(async () => {
    try {
      const res = await opportunities.saved()
      setSavedList(res.saved ?? [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => { fetchSaved() }, [fetchSaved])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setError('')
      const res = await opportunities.refresh()
      setAllOpps(res.opportunities ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSave = async (id: string) => {
    try {
      setSaving(id)
      const isSaved = savedList.some(s => s.id === id)
      if (isSaved) {
        await opportunities.unsave(id)
        setSavedList(prev => prev.filter(s => s.id !== id))
      } else {
        await opportunities.save(id)
        const opp = allOpps.find(o => o.id === id)
        if (opp) setSavedList(prev => [...prev, opp])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const isSaved = (id: string) => savedList.some(s => s.id === id)

  const displayList = (tab === 'saved' ? savedList : allOpps).filter(opp => {
    if (!search) return true
    const q = search.toLowerCase()
    return opp.title.toLowerCase().includes(q) || opp.company.toLowerCase().includes(q) || opp.description.toLowerCase().includes(q)
  })

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0D0026]">Opportunities</h1>
            <p className="text-sm text-[#8B898E] mt-1">Discover internships, scholarships, grants, and more</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="border-[#EDE3FF] text-[#6B26EA] hover:bg-[#F5F0FF]">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#EDE3FF] mb-6">
          <button onClick={() => setTab('discover')} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'discover' ? 'text-[#6B26EA] border-b-2 border-[#6B26EA]' : 'text-[#8B898E] hover:text-[#0D0026]'}`}>
            Discover
          </button>
          <button onClick={() => setTab('saved')} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'saved' ? 'text-[#6B26EA] border-b-2 border-[#6B26EA]' : 'text-[#8B898E] hover:text-[#0D0026]'}`}>
            Saved ({savedList.length})
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B898E]" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities..." className="pl-10 border-[#EDE3FF] focus:border-[#6B26EA]" />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => { setCategory(cat.value); setPage(1) }} className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${category === cat.value ? 'bg-[#6B26EA] text-white' : 'bg-[#F5F0FF] text-[#6B26EA] hover:bg-[#EDE3FF]'}`}>
              {cat.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B26EA]" />
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 text-[#EDE3FF] mx-auto mb-4" />
            <p className="text-[#0D0026] font-medium">{tab === 'saved' ? 'No saved opportunities yet' : 'No opportunities found'}</p>
            <p className="text-sm text-[#8B898E] mt-1">{tab === 'saved' ? 'Bookmark opportunities to see them here' : 'Try adjusting your filters or refresh for new listings'}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#8B898E] mb-4">{totalResults} opportunities found</p>
            <div className="grid gap-4">
              {displayList.map(opp => (
                <div key={opp.id} className="bg-white border border-[#EDE3FF] rounded-xl p-5 hover:border-[#6B26EA]/30 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title row with source badge */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-[#0D0026]">{opp.title}</h3>
                        {opp.source_name && (
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getSourceColor(opp.source_name)}`}>
                            {opp.source_name}
                          </span>
                        )}
                        {opp.relevance_score != null && opp.relevance_score > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {opp.relevance_score}%
                          </span>
                        )}
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[#8B898E] mb-2">
                        <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{opp.company}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{opp.location}</span>
                        {(opp.salary_min || opp.salary_max) ? (
                          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{formatSalary(opp.salary_min, opp.salary_max, opp.salary_currency)}</span>
                        ) : opp.pay ? (
                          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{opp.pay}</span>
                        ) : null}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-[#4A4A4A] line-clamp-2">{opp.description}</p>

                      {/* Footer info */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-medium bg-[#F5F0FF] text-[#6B26EA] px-2 py-0.5 rounded-full capitalize">{opp.category}</span>
                        {opp.age_requirement && <span className="text-xs text-[#8B898E]">Age: {opp.age_requirement}</span>}
                        {opp.experience_required && opp.experience_required !== 'None' && <span className="text-xs text-[#8B898E]">Exp: {opp.experience_required}</span>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                      {opp.url && (
                        <a href={opp.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#6B26EA] hover:text-[#5A1FD0] bg-[#F5F0FF] hover:bg-[#EDE3FF] px-3 py-2 rounded-lg transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Visit</span>
                        </a>
                      )}
                      <button onClick={() => handleSave(opp.id)} disabled={saving === opp.id} className="text-[#8B898E] hover:text-[#6B26EA] transition-colors p-2">
                        {saving === opp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved(opp.id) ? <BookmarkCheck className="w-5 h-5 text-[#6B26EA]" /> : <Bookmark className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-[#EDE3FF] text-[#6B26EA]">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-[#8B898E]">Page {page} of {totalPages}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="border-[#EDE3FF] text-[#6B26EA]">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
