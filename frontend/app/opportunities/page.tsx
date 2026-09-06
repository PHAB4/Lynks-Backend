'use client'

import { useState, useEffect, useCallback } from 'react'
import { opportunities } from '@/lib/api'
import type { Opportunity } from '@/lib/types'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Bookmark, BookmarkCheck, ExternalLink, Loader2, Briefcase, MapPin, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Jobs', value: 'job' },
  { label: 'Scholarships', value: 'scholarship' },
  { label: 'Competitions', value: 'competition' },
  { label: 'Events', value: 'event' },
  { label: 'Volunteer', value: 'volunteer' },
  { label: 'Clubs', value: 'club' },
]

export default function OpportunitiesPage() {
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
      const res = await opportunities.list({ category: category || undefined, sort: 'recent', page, limit: 20 })
      setAllOpps(res.opportunities ?? [])
      const total = res.metadata?.total_available ?? 0
      setTotalPages(Math.max(1, Math.ceil(total / 20)))
      setTotalResults(total)
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
      <div className="min-h-screen bg-[#F7F3FE]">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[28px] md:text-[36px] font-semibold text-[#0D0026] leading-tight" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                Opportunities
              </h1>
              <p className="text-sm text-[#8B898E] mt-1">Discover internships, scholarships, jobs, and more</p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing} className="bg-[#6B26EA] hover:bg-[#5A1FD0] text-white">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
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
          <div className="mb-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B898E]" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities..." className="pl-10 bg-white border-[#EDE3FF] focus:border-[#6B26EA]" />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => { setCategory(cat.value); setPage(1) }} className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${category === cat.value ? 'bg-[#6B26EA] text-white' : 'bg-white text-[#6B26EA] border border-[#EDE3FF] hover:bg-[#F5F0FF]'}`}>
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
            <div className="bg-white rounded-2xl border border-[#EDE3FF] p-12 text-center">
              <Briefcase className="w-12 h-12 text-[#EDE3FF] mx-auto mb-4" />
              <p className="text-[#0D0026] font-medium">{tab === 'saved' ? 'No saved opportunities yet' : 'No opportunities found'}</p>
              <p className="text-sm text-[#8B898E] mt-1">{tab === 'saved' ? 'Bookmark opportunities to see them here' : 'Try adjusting your filters or refresh for new listings'}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[#8B898E] mb-4">{totalResults} opportunities found</p>
              <div className="grid gap-4">
                {displayList.map(opp => (
                  <div key={opp.id} className="bg-white rounded-2xl border border-[#EDE3FF] p-5 hover:border-[#6B26EA]/30 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#0D0026] text-[15px] mb-1">{opp.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#8B898E] mb-2">
                          <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{opp.company}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{opp.location}</span>
                        </div>
                        <p className="text-sm text-[#4A4A4A] line-clamp-2">{opp.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-medium bg-[#EADFFF] text-[#6B26EA] px-2 py-0.5 rounded-full capitalize">{opp.category}</span>
                          {opp.age_requirement && <span className="text-xs text-[#8B898E]">Age: {opp.age_requirement}</span>}
                          {opp.pay && opp.pay !== 'Varies' && opp.pay !== 'Unpaid' && (
                            <span className="flex items-center gap-1 text-xs font-medium text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">
                              <DollarSign className="w-3 h-3" />
                              {opp.pay}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-2 shrink-0 self-start">
                        <button onClick={() => handleSave(opp.id)} disabled={saving === opp.id} className="text-[#8B898E] hover:text-[#6B26EA] transition-colors p-2 rounded-xl hover:bg-[#F5F0FF]" title={isSaved(opp.id) ? 'Remove from saved' : 'Save opportunity'}>
                          {saving === opp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved(opp.id) ? <BookmarkCheck className="w-5 h-5 text-[#6B26EA]" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                        {opp.url && (
                          <a href={opp.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-[#6B26EA] hover:text-[#5A1FD0] bg-[#F5F0FF] hover:bg-[#EDE3FF] px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
                            <ExternalLink className="w-4 h-4" />
                            Visit
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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
      </div>
    </AppLayout>
  )
}
