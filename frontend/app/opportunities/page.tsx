'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { opportunities } from '@/lib/api'
import type { Opportunity } from '@/lib/types'
import DashboardLayout from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, Bookmark, BookmarkCheck, ExternalLink, Loader2, Briefcase, MapPin, DollarSign } from 'lucide-react'

const CATEGORIES = ['All', 'Internships', 'Scholarships', 'Grants', 'Jobs', 'Networking', 'Workshops', 'Competitions']

export default function OpportunitiesPage() {
  const { user } = useAuth()
  const [opportunitiesList, setOpportunitiesList] = useState<Opportunity[]>([])
  const [savedList, setSavedList] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<'discover' | 'saved'>('discover')

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const filters = category === 'All' ? undefined : { category }
      const data = await opportunities.list(filters)
      setOpportunitiesList(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [category])

  const fetchSaved = useCallback(async () => {
    try {
      const data = await opportunities.saved()
      setSavedList(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => { fetchSaved() }, [fetchSaved])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const data = await opportunities.refresh()
      setOpportunitiesList(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to refresh')
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
        const opp = opportunitiesList.find(o => o.id === id)
        if (opp) setSavedList(prev => [...prev, opp])
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const isSaved = (id: string) => savedList.some(s => s.id === id)

  const filtered = (tab === 'saved' ? savedList : opportunitiesList).filter(opp => {
    const matchesSearch = !search || opp.title.toLowerCase().includes(search.toLowerCase()) || opp.company.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
            <p className="text-sm text-gray-500 mt-1">Discover internships, scholarships, grants, and more</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          <button onClick={() => setTab('discover')} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'discover' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
            Discover
          </button>
          <button onClick={() => setTab('saved')} className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'saved' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
            Saved ({savedList.length})
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities..." className="pl-10 border-gray-200" />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${category === cat ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">{tab === 'saved' ? 'No saved opportunities yet' : 'No opportunities found'}</p>
            <p className="text-sm text-gray-400 mt-1">{tab === 'saved' ? 'Bookmark opportunities to see them here' : 'Try adjusting your filters or refresh for new listings'}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(opp => (
              <div key={opp.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{opp.title}</h3>
                      <span className="text-xs font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{opp.category}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{opp.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{opp.location}</span>
                      {opp.pay && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{opp.pay}</span>}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{opp.description}</p>
                    {opp.age_requirement && <p className="text-xs text-gray-400 mt-2">Age: {opp.age_requirement}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {opp.url && (
                      <a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => handleSave(opp.id)} disabled={saving === opp.id} className="text-gray-400 hover:text-purple-600 transition-colors">
                      {saving === opp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved(opp.id) ? <BookmarkCheck className="w-5 h-5 text-purple-600" /> : <Bookmark className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
