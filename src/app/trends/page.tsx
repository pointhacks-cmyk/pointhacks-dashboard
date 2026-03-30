'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Search, X, Loader2, Target, Zap, Eye,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3, Lightbulb, Filter,
  ChevronDown, ChevronUp, AlertTriangle, FileText, RefreshCw
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts'

const TEAL = '#34D399', RED = '#EF4444', GOLD = '#F59E0B', BLUE = '#6366f1', PURPLE = '#8B5CF6', NAVY = '#003399'
const CHART_COLORS = [TEAL, BLUE, PURPLE, GOLD, RED, '#ff6b9d', '#66aaff']

const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString()

interface Keyword {
  query: string; clicks: number; impressions: number; ctr: number; avg_position: number
  prev_clicks: number; prev_impressions: number; prev_position: number
  impression_trend: number | null; click_trend: number | null; position_change: number | null
  intent_score: number; opportunity_score: number
}

interface TrendsData {
  keywords: string[]; timeline: { date: string; values: number[] }[]
  topRelated: { query: string; value: number }[]
  risingRelated: { query: string; value: string }[]
}

type TabId = 'opportunities' | 'keywords' | 'trends'
type SortKey = 'opportunity' | 'impressions' | 'clicks' | 'position' | 'trend'

const KEYWORD_GROUPS: Record<string, string[]> = {
  'Credit Cards': ['best credit cards australia', 'credit card comparison', 'credit card rewards'],
  'Points Programs': ['qantas points', 'velocity frequent flyer', 'flybuys points'],
  'Travel': ['business class flights', 'lounge access', 'frequent flyer'],
  'Competitors': ['finder credit cards', 'canstar credit cards', 'money.com.au'],
}

const TIME_RANGES = [
  { label: '7d', days: 7 }, { label: '30d', days: 30 },
  { label: '90d', days: 90 }, { label: '12m', days: 365 },
]

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white font-semibold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
          <span className="text-zinc-400">{p.dataKey}</span>
        </div>
      ))}
    </div>
  )
}

function IntentBadge({ score }: { score: number }) {
  const config = score >= 3
    ? { label: 'High Intent', color: TEAL, bg: '#34D39920' }
    : score >= 2
    ? { label: 'Medium', color: GOLD, bg: '#F59E0B20' }
    : score >= 1
    ? { label: 'Low', color: BLUE, bg: '#6366f120' }
    : { label: 'Info', color: '#666', bg: '#66666620' }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: config.color, background: config.bg }}>
      {config.label}
    </span>
  )
}

function TrendArrow({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-zinc-600 text-xs">—</span>
  const color = value > 0 ? TEAL : value < 0 ? RED : '#888'
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <Icon size={12} /> {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )
}

function OpportunityCard({ kw, rank }: { kw: Keyword; rank: number }) {
  const isQuickWin = kw.avg_position >= 4 && kw.avg_position <= 15 && kw.impressions >= 500
  const isRising = (kw.impression_trend || 0) > 50
  const isNew = kw.prev_impressions === 0

  let action = ''
  let actionColor = TEAL
  if (kw.avg_position <= 3) { action = 'Defend position — monitor competitors'; actionColor = TEAL }
  else if (kw.avg_position <= 10) { action = 'Optimize existing content — title tags, internal links, freshness'; actionColor = GOLD }
  else if (kw.avg_position <= 20) { action = 'Create dedicated content or major page update'; actionColor = BLUE }
  else { action = 'New content opportunity — no strong ranking yet'; actionColor = PURPLE }

  return (
    <div className="glass-card p-4" style={{ borderLeft: `3px solid ${kw.intent_score >= 3 ? TEAL : kw.intent_score >= 2 ? GOLD : BLUE}` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">#{rank}</span>
          <div>
            <div className="text-sm font-semibold text-white">{kw.query}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <IntentBadge score={kw.intent_score} />
              {isQuickWin && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">⚡ Quick Win</span>}
              {isRising && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">📈 Rising</span>}
              {isNew && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">🆕 New</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ color: TEAL }}>{kw.opportunity_score}</div>
          <div className="text-[10px] text-zinc-500">OPP SCORE</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div><div className="text-[10px] text-zinc-500">Impressions</div><div className="text-sm font-semibold text-white">{fmt(kw.impressions)}</div><TrendArrow value={kw.impression_trend} /></div>
        <div><div className="text-[10px] text-zinc-500">Clicks</div><div className="text-sm font-semibold text-white">{fmt(kw.clicks)}</div><TrendArrow value={kw.click_trend} /></div>
        <div><div className="text-[10px] text-zinc-500">Position</div><div className="text-sm font-semibold text-white">{kw.avg_position}</div><TrendArrow value={kw.position_change ? -kw.position_change : null} suffix=" pos" /></div>
        <div><div className="text-[10px] text-zinc-500">CTR</div><div className="text-sm font-semibold text-white">{kw.ctr}%</div></div>
      </div>
      <div className="flex items-start gap-2 p-2 rounded-lg bg-[#1A1A1A]">
        <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: actionColor }} />
        <span className="text-xs" style={{ color: actionColor }}>{action}</span>
      </div>
    </div>
  )
}

export default function TrendsPage() {
  const [tab, setTab] = useState<TabId>('opportunities')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [quickWins, setQuickWins] = useState<Keyword[]>([])
  const [rising, setRising] = useState<Keyword[]>([])
  const [declining, setDeclining] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('opportunity')
  const [intentFilter, setIntentFilter] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [showCount, setShowCount] = useState(50)

  // Google Trends state
  const [trendKeywords, setTrendKeywords] = useState<string[]>(['best credit cards australia', 'qantas points', 'frequent flyer credit card', 'credit card rewards', 'velocity frequent flyer'])
  const [trendInput, setTrendInput] = useState('')
  const [trendDays, setTrendDays] = useState(90)
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState<string | null>(null)

  // Fetch keyword intelligence
  const fetchKeywords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/keyword-intelligence?intent=${intentFilter}&sort=${sortKey}&limit=500${searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setKeywords(json.keywords)
      setSummary(json.summary)
      setQuickWins(json.quickWins)
      setRising(json.rising)
      setDeclining(json.declining)
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }, [intentFilter, sortKey, searchQ])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])

  // Fetch Google Trends
  const fetchTrends = useCallback(async (kws: string[], d: number) => {
    setTrendsLoading(true)
    setTrendsError(null)
    try {
      const res = await fetch(`/api/trends?keywords=${encodeURIComponent(kws.join(','))}&days=${d}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTrendsData(json)
    } catch (e: any) { setTrendsError(e.message) }
    finally { setTrendsLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'trends') fetchTrends(trendKeywords, trendDays)
  }, [tab, trendKeywords, trendDays, fetchTrends])

  const trendChartData = trendsData?.timeline.map(t => {
    const row: any = { date: t.date }
    trendsData.keywords.forEach((kw, i) => { row[kw] = t.values[i] })
    return row
  }) || []

  // Position vs Impressions scatter data for commercial keywords
  const scatterData = useMemo(() => {
    return keywords
      .filter(k => k.intent_score >= 2 && k.impressions >= 100)
      .slice(0, 100)
      .map(k => ({
        query: k.query,
        position: k.avg_position,
        impressions: k.impressions,
        clicks: k.clicks,
        opportunity: k.opportunity_score,
      }))
  }, [keywords])

  const topOpportunities = useMemo(() =>
    keywords.filter(k => k.intent_score >= 2).sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 20)
  , [keywords])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between animate-in">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={24} style={{ color: TEAL }} /> Search Trends & Content Intelligence
          </h1>
          <p className="text-zinc-400 text-sm">200 commercial keywords · Opportunity scoring · Content recommendations</p>
        </div>
        <button onClick={fetchKeywords} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-sm transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-1 w-fit">
        {[
          { id: 'opportunities' as TabId, label: 'Content Opportunities', icon: Zap },
          { id: 'keywords' as TabId, label: 'Keyword Table', icon: BarChart3 },
          { id: 'trends' as TabId, label: 'Google Trends', icon: TrendingUp },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ============ OPPORTUNITIES TAB ============ */}
      {tab === 'opportunities' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: TEAL }} /></div>
          ) : (
            <>
              {/* Summary KPIs */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 animate-in">
                  {[
                    { label: 'Total Keywords', value: fmt(summary.total), color: '#888' },
                    { label: 'Commercial', value: fmt(summary.commercial), color: TEAL },
                    { label: 'Quick Wins', value: summary.quickWins, color: GOLD },
                    { label: 'Rising', value: summary.rising, color: '#34D399' },
                    { label: 'Declining', value: summary.declining, color: RED },
                    { label: 'Position Gains', value: summary.positionGains, color: BLUE },
                    { label: 'Position Losses', value: summary.positionLosses, color: RED },
                  ].map(s => (
                    <div key={s.label} className="glass-card-static p-3 text-center">
                      <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Position vs Impressions Scatter */}
              {scatterData.length > 0 && (
                <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '60ms' }}>
                  <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <Target size={16} style={{ color: PURPLE }} /> Keyword Opportunity Map
                  </h2>
                  <p className="text-xs text-zinc-500 mb-4">Position vs Search Volume — top-right quadrant = biggest opportunities</p>
                  <ResponsiveContainer width="100%" height={350}>
                    <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" dataKey="position" name="Position" domain={[0, 25]} reversed
                        tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false}
                        label={{ value: '← Better Position', position: 'insideBottom', offset: -5, style: { fill: '#666', fontSize: 10 } }} />
                      <YAxis type="number" dataKey="impressions" name="Impressions"
                        tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} />
                      <ZAxis type="number" dataKey="clicks" range={[40, 400]} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        return (
                          <div className="bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-2 text-xs shadow-xl">
                            <div className="text-white font-semibold mb-1">{d.query}</div>
                            <div className="text-zinc-400">Position: <span className="text-white">{d.position}</span></div>
                            <div className="text-zinc-400">Impressions: <span className="text-white">{fmt(d.impressions)}</span></div>
                            <div className="text-zinc-400">Clicks: <span className="text-white">{fmt(d.clicks)}</span></div>
                            <div className="text-zinc-400">Opportunity: <span style={{ color: TEAL }}>{d.opportunity}</span></div>
                          </div>
                        )
                      }} />
                      <Scatter data={scatterData}>
                        {scatterData.map((d, i) => (
                          <Cell key={i} fill={d.position <= 3 ? TEAL : d.position <= 10 ? GOLD : d.position <= 20 ? BLUE : RED} fillOpacity={0.7} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 justify-center">
                    {[{ label: 'Position 1-3', color: TEAL }, { label: '4-10', color: GOLD }, { label: '11-20', color: BLUE }, { label: '20+', color: RED }].map(l => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />{l.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 20 Opportunities */}
              <div className="animate-in" style={{ animationDelay: '120ms' }}>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap size={16} style={{ color: GOLD }} /> Top 20 Content Opportunities
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {topOpportunities.map((kw, i) => (
                    <OpportunityCard key={kw.query} kw={kw} rank={i + 1} />
                  ))}
                </div>
              </div>

              {/* Quick Wins */}
              {quickWins.length > 0 && (
                <div className="animate-in" style={{ animationDelay: '180ms' }}>
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Lightbulb size={16} style={{ color: GOLD }} /> ⚡ Quick Wins — Position 4-15, High Volume
                  </h2>
                  <p className="text-xs text-zinc-500 mb-3">These keywords are on the edge of page 1. Small improvements = big traffic gains.</p>
                  <div className="glass-card-static overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-zinc-500 uppercase border-b border-[#2A2A2A]">
                          <th className="text-left p-3">Keyword</th>
                          <th className="text-right p-3">Impressions</th>
                          <th className="text-right p-3">Clicks</th>
                          <th className="text-right p-3">Position</th>
                          <th className="text-right p-3">CTR</th>
                          <th className="text-right p-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickWins.slice(0, 15).map(kw => (
                          <tr key={kw.query} className="border-b border-[#1e1e2e] hover:bg-white/[0.02]">
                            <td className="p-3"><span className="text-white">{kw.query}</span> <IntentBadge score={kw.intent_score} /></td>
                            <td className="p-3 text-right text-zinc-300">{fmt(kw.impressions)}</td>
                            <td className="p-3 text-right text-zinc-300">{fmt(kw.clicks)}</td>
                            <td className="p-3 text-right font-semibold" style={{ color: kw.avg_position <= 10 ? GOLD : BLUE }}>{kw.avg_position}</td>
                            <td className="p-3 text-right text-zinc-400">{kw.ctr}%</td>
                            <td className="p-3 text-right"><TrendArrow value={kw.impression_trend} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Rising & Declining */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in" style={{ animationDelay: '240ms' }}>
                {rising.length > 0 && (
                  <div className="glass-card-static p-6">
                    <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingUp size={16} style={{ color: TEAL }} /> 📈 Rising Keywords
                    </h2>
                    <p className="text-xs text-zinc-500 mb-3">Impressions up 50%+ vs prior 28 days</p>
                    <div className="space-y-2">
                      {rising.slice(0, 10).map(kw => (
                        <div key={kw.query} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2e] last:border-0">
                          <div>
                            <span className="text-sm text-white">{kw.query}</span>
                            <span className="text-xs text-zinc-600 ml-2">{fmt(kw.impressions)} imp</span>
                          </div>
                          <TrendArrow value={kw.impression_trend} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {declining.length > 0 && (
                  <div className="glass-card-static p-6">
                    <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingDown size={16} style={{ color: RED }} /> 📉 Declining Keywords
                    </h2>
                    <p className="text-xs text-zinc-500 mb-3">Impressions down 30%+ — may need content refresh</p>
                    <div className="space-y-2">
                      {declining.slice(0, 10).map(kw => (
                        <div key={kw.query} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2e] last:border-0">
                          <div>
                            <span className="text-sm text-white">{kw.query}</span>
                            <span className="text-xs text-zinc-600 ml-2">{fmt(kw.impressions)} imp</span>
                          </div>
                          <TrendArrow value={kw.impression_trend} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ KEYWORD TABLE TAB ============ */}
      {tab === 'keywords' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2 border border-[#2A2A2A]">
              <Search size={14} className="text-zinc-500" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search keywords..."
                className="bg-transparent text-sm text-white outline-none w-48" />
              {searchQ && <button onClick={() => setSearchQ('')}><X size={14} className="text-zinc-500" /></button>}
            </div>
            <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-0.5 border border-[#2A2A2A]">
              {[{ label: 'All', value: 0 }, { label: 'Commercial', value: 2 }, { label: 'High Intent', value: 3 }].map(f => (
                <button key={f.value} onClick={() => setIntentFilter(f.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${intentFilter === f.value ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-0.5 border border-[#2A2A2A]">
              {([
                { label: 'Opportunity', key: 'opportunity' },
                { label: 'Impressions', key: 'impressions' },
                { label: 'Clicks', key: 'clicks' },
                { label: 'Position', key: 'position' },
                { label: 'Trend', key: 'trend' },
              ] as { label: string; key: SortKey }[]).map(s => (
                <button key={s.key} onClick={() => setSortKey(s.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sortKey === s.key ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: TEAL }} /></div>
          ) : (
            <div className="glass-card-static overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-zinc-500 uppercase border-b border-[#383838]">
                      <th className="text-left p-3 w-8">#</th>
                      <th className="text-left p-3">Keyword</th>
                      <th className="text-center p-3">Intent</th>
                      <th className="text-right p-3">Score</th>
                      <th className="text-right p-3">Impressions</th>
                      <th className="text-right p-3">Clicks</th>
                      <th className="text-right p-3">CTR</th>
                      <th className="text-right p-3">Position</th>
                      <th className="text-right p-3">Imp Trend</th>
                      <th className="text-right p-3">Pos Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.slice(0, showCount).map((kw, i) => (
                      <tr key={kw.query} className="border-b border-[#1e1e2e] hover:bg-white/[0.02]">
                        <td className="p-3 text-zinc-600 font-mono text-xs">{i + 1}</td>
                        <td className="p-3 text-white font-medium max-w-xs truncate">{kw.query}</td>
                        <td className="p-3 text-center"><IntentBadge score={kw.intent_score} /></td>
                        <td className="p-3 text-right font-bold" style={{ color: TEAL }}>{kw.opportunity_score}</td>
                        <td className="p-3 text-right text-zinc-300">{fmt(kw.impressions)}</td>
                        <td className="p-3 text-right text-zinc-300">{fmt(kw.clicks)}</td>
                        <td className="p-3 text-right text-zinc-400">{kw.ctr}%</td>
                        <td className="p-3 text-right font-semibold" style={{
                          color: kw.avg_position <= 3 ? TEAL : kw.avg_position <= 10 ? GOLD : kw.avg_position <= 20 ? BLUE : RED
                        }}>{kw.avg_position}</td>
                        <td className="p-3 text-right"><TrendArrow value={kw.impression_trend} /></td>
                        <td className="p-3 text-right"><TrendArrow value={kw.position_change ? -kw.position_change : null} suffix="" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {keywords.length > showCount && (
                <div className="p-3 text-center">
                  <button onClick={() => setShowCount(s => s + 50)} className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Show more ({keywords.length - showCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ GOOGLE TRENDS TAB ============ */}
      {tab === 'trends' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="glass-card p-5 space-y-4 animate-in">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">Quick Select</div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(KEYWORD_GROUPS).map(group => (
                  <button key={group} onClick={() => setTrendKeywords(KEYWORD_GROUPS[group].slice(0, 5))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#383838] text-zinc-300 hover:bg-[#484848] transition-colors">
                    {group}
                  </button>
                ))}
                <button onClick={() => {
                  const top5 = keywords.filter(k => k.intent_score >= 3).slice(0, 5).map(k => k.query)
                  if (top5.length) setTrendKeywords(top5)
                }} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#34D39920] text-green-400 hover:bg-[#34D39930] transition-colors">
                  🎯 Top Commercial
                </button>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">Keywords ({trendKeywords.length}/5)</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {trendKeywords.map((kw, i) => (
                  <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `${CHART_COLORS[i]}20`, color: CHART_COLORS[i], border: `1px solid ${CHART_COLORS[i]}40` }}>
                    {kw}
                    {trendKeywords.length > 1 && <button onClick={() => setTrendKeywords(trendKeywords.filter(k => k !== kw))}><X size={10} /></button>}
                  </span>
                ))}
              </div>
              {trendKeywords.length < 5 && (
                <div className="flex gap-2">
                  <input value={trendInput} onChange={e => setTrendInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && trendInput.trim()) { setTrendKeywords([...trendKeywords, trendInput.trim().toLowerCase()]); setTrendInput('') } }}
                    placeholder="Add keyword..." className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#1A1A1A] border border-[#383838] text-white outline-none" />
                  <button onClick={() => { if (trendInput.trim()) { setTrendKeywords([...trendKeywords, trendInput.trim().toLowerCase()]); setTrendInput('') } }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#34D399] text-[#1A1A1A]">Add</button>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">Time Range</div>
              <div className="flex gap-2">
                {TIME_RANGES.map(tr => (
                  <button key={tr.days} onClick={() => setTrendDays(tr.days)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${trendDays === tr.days ? 'bg-[#34D399] text-[#1A1A1A]' : 'bg-[#383838] text-zinc-300'}`}>
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {trendsError && (
            <div className="glass-card p-4" style={{ borderLeft: '3px solid #EF4444' }}>
              <p className="text-sm text-red-400">⚠️ {trendsError}</p>
              <p className="text-xs text-zinc-500 mt-1">Google Trends may be rate-limiting. Try again in a few minutes.</p>
            </div>
          )}

          <div className="glass-card-static p-6 animate-in">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <TrendingUp size={16} style={{ color: TEAL }} /> Interest Over Time
            </h2>
            <p className="text-xs text-zinc-500 mb-4">Relative search interest (0-100) in Australia</p>
            {trendsLoading ? (
              <div className="flex items-center justify-center" style={{ height: 350 }}><Loader2 size={24} className="animate-spin" style={{ color: TEAL }} /></div>
            ) : trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="date" tick={{ fill: '#8C8C8C', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {(trendsData?.keywords || []).map((kw, i) => (
                    <Line key={kw} type="monotone" dataKey={kw} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center text-zinc-500 text-sm" style={{ height: 350 }}>No trend data available</div>
            )}
          </div>

          {trendsData && (trendsData.topRelated.length > 0 || trendsData.risingRelated.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in" style={{ animationDelay: '60ms' }}>
              {trendsData.topRelated.length > 0 && (
                <div className="glass-card-static p-6">
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Search size={16} style={{ color: BLUE }} /> Top Related Queries
                  </h2>
                  <div className="space-y-2">
                    {trendsData.topRelated.map((q, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#2A2A2A] last:border-0">
                        <span className="text-sm text-white">{q.query}</span>
                        <span className="text-xs text-zinc-500 font-mono">{q.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {trendsData.risingRelated.length > 0 && (
                <div className="glass-card-static p-6">
                  <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: GOLD }} /> Rising Queries
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {trendsData.risingRelated.map((q, i) => {
                      const isBreakout = q.value === 'Breakout'
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background: isBreakout ? '#34D39915' : '#F59E0B15',
                            color: isBreakout ? '#34D399' : '#F59E0B',
                            border: `1px solid ${isBreakout ? '#34D39930' : '#F59E0B30'}`,
                          }}>
                          {q.query} <span className="text-[10px] opacity-80">{isBreakout ? '🚀' : `+${q.value}`}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-center text-xs text-zinc-500 animate-in" style={{ animationDelay: '300ms' }}>
        Data: Google Search Console (28-day window) + Google Trends · Non-branded commercial keywords · Updated with daily sync
      </div>
    </div>
  )
}
