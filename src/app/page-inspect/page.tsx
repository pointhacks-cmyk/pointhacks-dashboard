'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Search, Shield, AlertTriangle, Target, Lightbulb, Copy, ExternalLink,
  Check, Loader2, FileSearch, ChevronDown, ArrowUpDown, TrendingUp, Eye, MousePointerClick, BarChart3,
  History, Clock, ChevronRight
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PROGRESS_STEPS = [
  'Fetching page content...',
  'Searching for competitors...',
  'Analyzing content...',
  'Generating SWOT...',
]

type Analysis = {
  pageOverview?: { title: string; topic: string; wordCount: number; contentType: string }
  competitors?: { domain: string; url: string; title: string; threatLevel: string; whyTheyRank: string }[]
  swot?: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }
  contentGaps?: { gap: string; competitor: string; priority: string; effort: string }[]
  actionItems?: { action: string; priority: string; estimatedImpact: string; effort: string }[]
  titleMetaSuggestions?: { currentTitle: string; suggestedTitle: string; currentMeta: string; suggestedMeta: string }
  raw?: string
}

type InspectResult = {
  url: string
  pagePath: string
  gscMetrics: any
  ga4Metrics: any
  topQueries: string[]
  allQueries: any[]
  competitors: any[]
  analysis: Analysis | null
  fetchedAt: string
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  )
}

function EffortBadge({ effort }: { effort: string }) {
  const colors: Record<string, string> = {
    easy: 'bg-emerald-500/10 text-emerald-400',
    medium: 'bg-blue-500/10 text-blue-400',
    hard: 'bg-purple-500/10 text-purple-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[effort] || colors.medium}`}>
      {effort}
    </span>
  )
}

function ThreatBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; label: string }> = {
    high: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'High Threat' },
    medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Medium Threat' },
    low: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Low Threat' },
  }
  const c = config[level] || config.low
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${c.color}`}>{c.label}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-zinc-400" />}
    </button>
  )
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="glass-card-static p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5"><Icon size={18} className="text-zinc-400" /></div>
      <div>
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="text-lg font-semibold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      </div>
    </div>
  )
}

export default function PageInspectPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [result, setResult] = useState<InspectResult | null>(null)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<{ page: string; clicks: number }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [gapSort, setGapSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'priority', dir: 'asc' })
  const [historyList, setHistoryList] = useState<{ id: number; page_path: string; url: string; created_at: string; gsc_metrics: any }[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load page suggestions from GSC
  useEffect(() => {
    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    const start = new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10)
    supabase.rpc('gsc_pages_agg', {
      start_date: start, end_date: end, search_text: null, sort_col: 'clicks', sort_dir: 'desc', lim: 50
    }).then(({ data }) => {
      if (data) setSuggestions(data.map((d: any) => ({ page: d.page, clicks: d.clicks })))
    })
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredSuggestions = suggestions.filter(s =>
    !url || s.page.toLowerCase().includes(url.toLowerCase())
  ).slice(0, 15)

  const fetchHistory = useCallback(async (pagePath?: string) => {
    setLoadingHistory(true)
    try {
      const params = pagePath ? `?page_path=${encodeURIComponent(pagePath)}` : ''
      const resp = await fetch(`/api/page-inspect/history${params}`)
      const data = await resp.json()
      if (Array.isArray(data)) setHistoryList(data)
    } catch {} finally {
      setLoadingHistory(false)
    }
  }, [])

  const loadInspection = useCallback(async (id: number) => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`/api/page-inspect/history?id=${id}`)
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setResult({
        url: data.url,
        pagePath: data.page_path,
        gscMetrics: data.gsc_metrics,
        ga4Metrics: data.ga4_metrics,
        topQueries: data.top_queries || [],
        allQueries: [],
        competitors: data.competitors || [],
        analysis: data.analysis,
        fetchedAt: data.created_at,
      })
      setUrl(data.page_path)
      setShowHistory(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const inspect = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setProgressStep(0)
    setShowSuggestions(false)

    // Simulate progress steps
    const interval = setInterval(() => {
      setProgressStep(prev => Math.min(prev + 1, PROGRESS_STEPS.length - 1))
    }, 8000)

    try {
      const resp = await fetch('/api/page-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to inspect page')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }, [url])

  const analysis = result?.analysis

  const sortedGaps = [...(analysis?.contentGaps || [])].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2, easy: 0, hard: 2 }
    const av = order[a[gapSort.col as keyof typeof a] as string] ?? 1
    const bv = order[b[gapSort.col as keyof typeof b] as string] ?? 1
    return gapSort.dir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSearch size={28} className="text-blue-400" />
            <h1 className="text-2xl font-bold">Page Inspect</h1>
          </div>
          <p className="text-zinc-400">Competitive SWOT analysis for any Point Hacks page</p>
        </div>

        {/* History Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(historyFilter || undefined) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-sm"
          >
            <History size={16} />
            Past Inspections
            <ChevronRight size={14} className={`transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="glass-card-static p-5 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <Clock size={16} className="text-zinc-400" />
                Inspection History
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { setHistoryFilter(null); fetchHistory() }}
                  className={`px-3 py-1 rounded text-xs transition-colors ${!historyFilter ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  All Pages
                </button>
                {url.trim() && (
                  <button
                    onClick={() => {
                      const path = url.trim().replace('https://www.pointhacks.com.au', '').replace('https://pointhacks.com.au', '')
                      setHistoryFilter(path)
                      fetchHistory(path)
                    }}
                    className={`px-3 py-1 rounded text-xs transition-colors ${historyFilter ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    This Page Only
                  </button>
                )}
              </div>
            </div>
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : historyList.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4">No past inspections found.</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {historyList.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadInspection(h.id)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 flex items-center justify-between group transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200 truncate">{h.page_path}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {new Date(h.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {h.gsc_metrics?.clicks != null && (
                          <span className="ml-3">{Number(h.gsc_metrics.clicks).toLocaleString()} clicks</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        <div className="glass-card-static p-6 mb-8">
          <div className="flex gap-3 relative">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => e.key === 'Enter' && inspect()}
                placeholder="Enter a Point Hacks URL (e.g. /credit-cards/best-qantas-credit-card/)"
                className="w-full bg-[#2A2A2A] border border-[#383838] rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-[#2A2A2A] border border-[#383838] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                  {filteredSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setUrl(s.page); setShowSuggestions(false) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex justify-between items-center text-sm border-b border-[#383838] last:border-0"
                    >
                      <span className="text-zinc-200 truncate mr-4">{s.page}</span>
                      <span className="text-zinc-500 text-xs whitespace-nowrap">{s.clicks.toLocaleString()} clicks</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={inspect}
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Inspect
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card-static p-8 mb-8">
            <div className="space-y-4">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {i < progressStep ? (
                    <Check size={18} className="text-green-400" />
                  ) : i === progressStep ? (
                    <Loader2 size={18} className="text-blue-400 animate-spin" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border border-zinc-600" />
                  )}
                  <span className={i <= progressStep ? 'text-white' : 'text-zinc-500'}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card-static p-6 mb-8 border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Historical banner */}
            {result.fetchedAt && new Date(result.fetchedAt).getTime() < Date.now() - 60000 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                <History size={16} />
                <span>
                  Viewing inspection from{' '}
                  <strong>{new Date(result.fetchedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                </span>
                <button
                  onClick={() => { setResult(null); inspect() }}
                  className="ml-auto px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs transition-colors"
                >
                  Run Fresh Inspection
                </button>
              </div>
            )}

            {/* Page Summary */}
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target size={20} className="text-blue-400" />
                Your Page
              </h2>
              <div className="mb-4">
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 text-sm">
                  {result.url} <ExternalLink size={12} />
                </a>
                {analysis?.pageOverview && (
                  <div className="mt-2 space-y-1">
                    <div className="text-white font-medium">{analysis.pageOverview.title}</div>
                    <div className="text-zinc-400 text-sm">{analysis.pageOverview.topic}</div>
                    <div className="flex gap-3 text-xs text-zinc-500">
                      <span>{analysis.pageOverview.wordCount?.toLocaleString()} words</span>
                      <span className="px-2 py-0.5 bg-white/5 rounded">{analysis.pageOverview.contentType}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MetricCard label="Clicks" value={result.gscMetrics?.clicks || 0} icon={MousePointerClick} />
                <MetricCard label="Impressions" value={result.gscMetrics?.impressions || 0} icon={Eye} />
                <MetricCard label="CTR" value={`${((result.gscMetrics?.ctr || 0) * 100).toFixed(1)}%`} icon={TrendingUp} />
                <MetricCard label="Avg Position" value={(result.gscMetrics?.position || 0).toFixed(1)} icon={BarChart3} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MetricCard label="Sessions" value={result.ga4Metrics?.totalSessions || 0} icon={Eye} />
                <MetricCard label="Page Views" value={result.ga4Metrics?.totalPageViews || 0} icon={Eye} />
                <MetricCard label="Bounce Rate" value={`${result.ga4Metrics?.avgBounceRate || 'N/A'}%`} icon={TrendingUp} />
                <MetricCard label="Click-outs" value={result.ga4Metrics?.totalClickOuts || 0} icon={MousePointerClick} />
              </div>

              {/* Top Queries */}
              {result.topQueries?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Top Ranking Queries</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.topQueries.slice(0, 5).map((q, i) => {
                      const queryData = result.allQueries?.find((aq: any) => aq.query === q)
                      return (
                        <div key={i} className="bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
                          <span className="text-zinc-200">{q}</span>
                          {queryData && (
                            <span className="text-xs text-zinc-500">pos {queryData.position?.toFixed(1)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Competitor Cards */}
            {analysis?.competitors && analysis.competitors.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-amber-400" />
                  Competitors
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysis.competitors.map((comp, i) => (
                    <div key={i} className="glass-card-static p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${comp.domain}&sz=32`}
                          alt=""
                          className="w-6 h-6 rounded mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{comp.domain}</div>
                          <div className="text-sm text-zinc-400 truncate">{comp.title}</div>
                        </div>
                      </div>
                      <div className="mb-3 flex gap-2 flex-wrap">
                        <ThreatBadge level={comp.threatLevel} />
                        {(comp.domain?.includes('finder.com.au') || comp.domain?.includes('canstar.com.au')) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">⭐ Primary Competitor</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 mb-3">{comp.whyTheyRank}</p>
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                      >
                        View page <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SWOT Analysis */}
            {analysis?.swot && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target size={20} className="text-purple-400" />
                  SWOT Analysis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="glass-card-static p-5 border-l-2 border-l-green-500">
                    <h3 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                      <Check size={16} /> Strengths
                    </h3>
                    <ul className="space-y-2">
                      {analysis.swot.strengths?.map((s, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Weaknesses */}
                  <div className="glass-card-static p-5 border-l-2 border-l-red-500">
                    <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} /> Weaknesses
                    </h3>
                    <ul className="space-y-2">
                      {analysis.swot.weaknesses?.map((w, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Opportunities */}
                  <div className="glass-card-static p-5 border-l-2 border-l-blue-500">
                    <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                      <Lightbulb size={16} /> Opportunities
                    </h3>
                    <ul className="space-y-2">
                      {analysis.swot.opportunities?.map((o, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Threats */}
                  <div className="glass-card-static p-5 border-l-2 border-l-amber-500">
                    <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Shield size={16} /> Threats
                    </h3>
                    <ul className="space-y-2">
                      {analysis.swot.threats?.map((t, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Content Gaps Table */}
            {analysis?.contentGaps && analysis.contentGaps.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Search size={20} className="text-cyan-400" />
                  Content Gaps
                </h2>
                <div className="glass-card-static overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#383838] text-xs text-zinc-500 uppercase">
                        <th className="text-left p-4">Gap</th>
                        <th className="text-left p-4">Competitor</th>
                        <th className="text-left p-4 cursor-pointer hover:text-zinc-300" onClick={() => setGapSort({ col: 'priority', dir: gapSort.col === 'priority' && gapSort.dir === 'asc' ? 'desc' : 'asc' })}>
                          <span className="flex items-center gap-1">Priority <ArrowUpDown size={12} /></span>
                        </th>
                        <th className="text-left p-4 cursor-pointer hover:text-zinc-300" onClick={() => setGapSort({ col: 'effort', dir: gapSort.col === 'effort' && gapSort.dir === 'asc' ? 'desc' : 'asc' })}>
                          <span className="flex items-center gap-1">Effort <ArrowUpDown size={12} /></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGaps.map((gap, i) => (
                        <tr key={i} className="border-b border-[#383838] last:border-0 hover:bg-white/[0.02]">
                          <td className="p-4 text-sm text-zinc-200">{gap.gap}</td>
                          <td className="p-4 text-sm text-zinc-400">{gap.competitor}</td>
                          <td className="p-4"><PriorityBadge priority={gap.priority} /></td>
                          <td className="p-4"><EffortBadge effort={gap.effort} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Items */}
            {analysis?.actionItems && analysis.actionItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb size={20} className="text-yellow-400" />
                  Action Items
                </h2>
                <div className="glass-card-static divide-y divide-[#383838]">
                  {analysis.actionItems.map((item, i) => (
                    <div key={i} className="p-5 flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-zinc-400 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white mb-2">{item.action}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <PriorityBadge priority={item.priority} />
                          <EffortBadge effort={item.effort} />
                          <span className="text-xs text-zinc-500">→ {item.estimatedImpact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Title & Meta Suggestions */}
            {analysis?.titleMetaSuggestions && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileSearch size={20} className="text-indigo-400" />
                  Title &amp; Meta Suggestions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="glass-card-static p-5">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Title Tag</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Current</div>
                        <div className="bg-[#2A2A2A] border border-[#383838] rounded p-3 text-sm text-zinc-300">
                          {analysis.titleMetaSuggestions.currentTitle || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-green-400 mb-1 flex items-center justify-between">
                          Suggested
                          <CopyButton text={analysis.titleMetaSuggestions.suggestedTitle || ''} />
                        </div>
                        <div className="bg-green-500/5 border border-green-500/20 rounded p-3 text-sm text-green-200">
                          {analysis.titleMetaSuggestions.suggestedTitle || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Meta Description */}
                  <div className="glass-card-static p-5">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Meta Description</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Current</div>
                        <div className="bg-[#2A2A2A] border border-[#383838] rounded p-3 text-sm text-zinc-300">
                          {analysis.titleMetaSuggestions.currentMeta || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-green-400 mb-1 flex items-center justify-between">
                          Suggested
                          <CopyButton text={analysis.titleMetaSuggestions.suggestedMeta || ''} />
                        </div>
                        <div className="bg-green-500/5 border border-green-500/20 rounded p-3 text-sm text-green-200">
                          {analysis.titleMetaSuggestions.suggestedMeta || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Raw analysis fallback */}
            {analysis?.raw && !analysis?.swot && (
              <div className="glass-card-static p-6">
                <h2 className="text-lg font-semibold mb-4">Analysis (Raw)</h2>
                <pre className="text-sm text-zinc-300 whitespace-pre-wrap">{analysis.raw}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
