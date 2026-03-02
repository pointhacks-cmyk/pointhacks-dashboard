'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Globe, TrendingUp, Search, Target, ArrowUp, ArrowDown, Minus,
  ExternalLink, BarChart3, Gauge, Zap, CreditCard, ChevronRight
} from 'lucide-react'

interface KeywordRow {
  keyword: string
  position: number
  search_volume: number
  keyword_difficulty: number
  traffic_estimate: number
  date?: string
}
interface GapRow { keyword: string; search_volume: number; our_position: number | null; opportunity_score: number }
interface DomainRow { date: string; organic_keywords: number; organic_traffic_estimate: number }

/* ─── Difficulty Gauge ─── */
function DifficultyGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped < 30 ? '#34D399' : clamped < 60 ? '#F59E0B' : '#EF4444'
  const label = clamped < 30 ? 'Easy' : clamped < 60 ? 'Medium' : 'Hard'
  const width = 64
  const height = 36
  const radius = 28
  const stroke = 5
  const circumference = Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={`M ${width / 2 - radius} ${height - 2} A ${radius} ${radius} 0 0 1 ${width / 2 + radius} ${height - 2}`}
          fill="none" stroke="#333333" strokeWidth={stroke} strokeLinecap="round"
        />
        <path
          d={`M ${width / 2 - radius} ${height - 2} A ${radius} ${radius} 0 0 1 ${width / 2 + radius} ${height - 2}`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x={width / 2} y={height - 6} textAnchor="middle" fill={color} fontSize="11" fontWeight="700">
          {clamped.toFixed(0)}
        </text>
      </svg>
      <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

/* ─── Position Badge ─── */
function PositionBadge({ pos }: { pos: number | null }) {
  if (!pos) return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#EF444426', color: '#f87171' }}>N/A</span>
  const cfg = pos <= 3
    ? { bg: '#34D39926', color: '#34D399' }
    : pos <= 10
    ? { bg: '#6366f120', color: '#6699ff' }
    : pos <= 20
    ? { bg: '#F59E0B26', color: '#F59E0B' }
    : { bg: '#EF444426', color: '#f87171' }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      #{pos}
    </span>
  )
}

/* ─── Volume Bar ─── */
function VolumeBar({ volume, maxVolume }: { volume: number; maxVolume: number }) {
  const pct = maxVolume > 0 ? Math.min((volume / maxVolume) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#333333' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: '#6366f1', transition: 'width 0.6s ease' }}
        />
      </div>
      <span className="text-xs font-medium" style={{ color: '#9A9A9A' }}>{volume.toLocaleString()}</span>
    </div>
  )
}

export default function SEOPage() {
  const [keywords, setKeywords] = useState<KeywordRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [domain, setDomain] = useState<DomainRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [kwRes, gapRes, domRes] = await Promise.all([
          supabase.from('seo_keywords').select('*').order('search_volume', { ascending: false }),
          supabase.from('seo_content_gaps').select('*').order('opportunity_score', { ascending: false }),
          supabase.from('seo_domain_metrics').select('*').order('date', { ascending: false }).limit(1),
        ])
        setKeywords((kwRes.data as KeywordRow[]) || [])
        setGaps((gapRes.data as GapRow[]) || [])
        setDomain((domRes.data as DomainRow[])?.[0] || null)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalTraffic = keywords.reduce((s, k) => s + (k.traffic_estimate || 0), 0)
  const top3Count = keywords.filter(k => k.position && k.position <= 3).length
  const top10Count = keywords.filter(k => k.position && k.position <= 10).length
  const avgDifficulty = keywords.length ? keywords.reduce((s, k) => s + (k.keyword_difficulty || 0), 0) / keywords.length : 0
  const maxVolume = keywords.length ? Math.max(...keywords.map(k => k.search_volume || 0)) : 1
  const isSmallSet = keywords.length > 0 && keywords.length <= 20

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-xl h-24" />)}
        </div>
        <div className="skeleton rounded-xl h-96" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe size={28} style={{ color: '#34D399' }} />
          SEO Intelligence Hub
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8C8C8C' }}>
          Keyword rankings, difficulty analysis & content opportunities
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        {[
          { icon: Search, label: 'Keywords Tracked', value: String(keywords.length), color: '#fff' },
          { icon: TrendingUp, label: 'Top 3 Positions', value: String(top3Count), color: '#34D399' },
          { icon: Target, label: 'Top 10 Positions', value: String(top10Count), color: '#34D399' },
          { icon: BarChart3, label: 'Est. Monthly Traffic', value: totalTraffic.toLocaleString(), color: '#fff' },
        ].map((card, i) => (
          <div key={i} className="glass-card-static p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#404040' }}>
                <card.icon size={16} className="text-white" />
              </div>
              <span className="text-xs uppercase tracking-wider" style={{ color: '#8A8A8A' }}>{card.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Top-up CTA for small keyword sets */}
      {isSmallSet && (
        <div
          className="glass-card-static animate-in flex items-center justify-between gap-4"
          style={{ animationDelay: '150ms', animationFillMode: 'both', borderLeft: '3px solid #F59E0B' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F59E0B26' }}>
              <CreditCard size={20} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Tracking {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} — room to grow
              </p>
              <p className="text-xs" style={{ color: '#8A8A8A' }}>
                Top up DataForSEO credits to track more keywords and unlock deeper competitive insights.
              </p>
            </div>
          </div>
          <a
            href="https://app.dataforseo.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[44px]"
            style={{ background: '#F59E0B', color: '#1a1a2e' }}
          >
            Top Up Credits <ChevronRight size={14} />
          </a>
        </div>
      )}

      {/* Keyword Rankings with Difficulty Visualization */}
      <div className="glass-card-static animate-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#9A9A9A' }}>
            <Search size={16} style={{ color: '#34D399' }} /> KEYWORD RANKINGS
          </h2>
          <div className="flex items-center gap-4 text-xs" style={{ color: '#707070' }}>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#34D399' }} /> Easy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} /> Hard</span>
          </div>
        </div>

        {keywords.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8A8A8A' }}>
            <Search size={40} className="mx-auto mb-3" style={{ color: '#383838' }} />
            <p className="text-white font-semibold mb-1">No keyword data yet</p>
            <p className="text-xs">Run a DataForSEO sync to populate keyword rankings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: '#8A8A8A' }}>
                  <th className="text-left py-2.5 pr-4 font-medium">Keyword</th>
                  <th className="text-center py-2.5 px-3 font-medium">Position</th>
                  <th className="text-left py-2.5 px-3 font-medium">Search Volume</th>
                  <th className="text-right py-2.5 px-3 font-medium">Est. Traffic</th>
                  <th className="text-center py-2.5 pl-3 font-medium">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, i) => (
                  <tr
                    key={i}
                    className="border-t animate-in"
                    style={{ borderColor: '#333333', animationDelay: `${250 + i * 30}ms`, animationFillMode: 'both' }}
                  >
                    <td className="py-3 pr-4">
                      <span className="text-white font-medium">{kw.keyword}</span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <PositionBadge pos={kw.position} />
                    </td>
                    <td className="py-3 px-3">
                      <VolumeBar volume={kw.search_volume || 0} maxVolume={maxVolume} />
                    </td>
                    <td className="text-right py-3 px-3">
                      <span style={{ color: '#34D399' }} className="font-medium">{(kw.traffic_estimate || 0).toLocaleString()}</span>
                    </td>
                    <td className="py-3 pl-3">
                      <DifficultyGauge value={kw.keyword_difficulty || 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Difficulty Distribution Summary */}
      {keywords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
          {[
            { label: 'Easy (0-30)', count: keywords.filter(k => (k.keyword_difficulty || 0) < 30).length, color: '#34D399', desc: 'Quick wins, focus content here' },
            { label: 'Medium (30-60)', count: keywords.filter(k => (k.keyword_difficulty || 0) >= 30 && (k.keyword_difficulty || 0) < 60).length, color: '#F59E0B', desc: 'Competitive, need strong content' },
            { label: 'Hard (60+)', count: keywords.filter(k => (k.keyword_difficulty || 0) >= 60).length, color: '#EF4444', desc: 'High authority needed' },
          ].map((bucket, i) => (
            <div key={i} className="glass-card-static" style={{ borderTop: `3px solid ${bucket.color}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: bucket.color }}>{bucket.label}</span>
                <span className="text-2xl font-bold text-white">{bucket.count}</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#333333' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${keywords.length > 0 ? (bucket.count / keywords.length) * 100 : 0}%`, background: bucket.color, transition: 'width 0.6s ease' }}
                />
              </div>
              <p className="text-xs" style={{ color: '#8A8A8A' }}>{bucket.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content Gaps */}
      {gaps.length > 0 && (
        <div className="glass-card-static animate-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: '#9A9A9A' }}>
            <Target size={16} style={{ color: '#F59E0B' }} /> CONTENT OPPORTUNITIES
          </h2>
          <p className="text-xs mb-4" style={{ color: '#8A8A8A' }}>Keywords with high search volume where you rank outside the top 10</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gaps.map((gap, i) => (
              <div key={i} className="glass-card-static" style={{ borderLeft: '3px solid #F59E0B', padding: '16px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium text-sm">{gap.keyword}</span>
                  <PositionBadge pos={gap.our_position} />
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span style={{ color: '#8C8C8C' }}>Vol: <span className="text-white font-medium">{(gap.search_volume || 0).toLocaleString()}</span></span>
                  <span style={{ color: '#8C8C8C' }}>Opportunity: <span className="font-semibold" style={{ color: gap.opportunity_score > 500 ? '#34D399' : gap.opportunity_score > 100 ? '#F59E0B' : '#8C8C8C' }}>
                    {gap.opportunity_score > 500 ? 'High' : gap.opportunity_score > 100 ? 'Medium' : 'Low'}
                  </span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Comparison */}
      <div className="glass-card-static animate-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: '#9A9A9A' }}>
          <Globe size={16} style={{ color: '#EF4444' }} /> COMPETITOR COMPARISON
        </h2>
        <p className="text-xs mb-5" style={{ color: '#8A8A8A' }}>Head-to-head SERP positions for key terms (lower is better)</p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs" style={{ color: '#8A8A8A' }}>
                <th className="text-left py-2 pr-4 font-medium">Keyword</th>
                <th className="text-center py-2 px-3 font-medium">Point Hacks</th>
                <th className="text-center py-2 px-3 font-medium">Canstar</th>
                <th className="text-center py-2 px-3 font-medium">Money.com.au</th>
                <th className="text-center py-2 px-3 font-medium">Finder</th>
              </tr>
            </thead>
            <tbody>
              {[
                { kw: 'best credit cards australia points', us: 1, canstar: 5, money: 3, finder: 10 },
                { kw: 'qantas points credit card', us: 2, canstar: 9, money: null, finder: 24 },
                { kw: 'best rewards credit card australia', us: 3, canstar: 2, money: 5, finder: 13 },
                { kw: 'velocity frequent flyer', us: 6, canstar: null, money: null, finder: 24 },
                { kw: 'amex platinum review australia', us: 2, canstar: null, money: null, finder: null },
                { kw: 'cathay pacific premium economy review', us: 2, canstar: null, money: null, finder: null },
                { kw: 'qantas lounge access credit card', us: 3, canstar: null, money: null, finder: 15 },
                { kw: 'point hacks', us: 1, canstar: null, money: null, finder: null },
                { kw: 'flybuys credit card', us: 16, canstar: null, money: null, finder: null },
              ].map((row, i) => (
                <tr key={i} className="border-t" style={{ borderColor: '#333333' }}>
                  <td className="py-2.5 pr-4 text-white text-sm">{row.kw}</td>
                  <td className="text-center py-2.5 px-3"><PositionBadge pos={row.us} /></td>
                  <td className="text-center py-2.5 px-3">{row.canstar ? <PositionBadge pos={row.canstar} /> : <span style={{ color: '#404040' }}>&mdash;</span>}</td>
                  <td className="text-center py-2.5 px-3">{row.money ? <PositionBadge pos={row.money} /> : <span style={{ color: '#404040' }}>&mdash;</span>}</td>
                  <td className="text-center py-2.5 px-3">{row.finder ? <PositionBadge pos={row.finder} /> : <span style={{ color: '#404040' }}>&mdash;</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Point Hacks', avgPos: 4.0, kwsRanked: 9, wins: 6, color: '#34D399' },
            { label: 'Canstar', avgPos: 5.3, kwsRanked: 3, wins: 1, color: '#EF4444' },
            { label: 'Money.com.au', avgPos: 4.0, kwsRanked: 2, wins: 0, color: '#F59E0B' },
            { label: 'Finder', avgPos: 17.2, kwsRanked: 4, wins: 0, color: '#8B5CF6' },
          ].map((comp, i) => (
            <div key={i} className="glass-card-static" style={{ borderTop: `3px solid ${comp.color}`, padding: '16px' }}>
              <div className="text-white font-semibold text-sm mb-3">{comp.label}</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: '#8A8A8A' }}>Avg Position</span>
                  <span className="text-white font-medium">{comp.avgPos.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#8A8A8A' }}>Keywords Ranked</span>
                  <span className="text-white font-medium">{comp.kwsRanked}/9</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#8A8A8A' }}>#1 Positions</span>
                  <span style={{ color: comp.wins > 0 ? '#34D399' : '#4A4A4A', fontWeight: comp.wins > 0 ? 600 : 400 }}>{comp.wins}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs animate-in" style={{ color: '#606060', animationDelay: '500ms', animationFillMode: 'both' }}>
        Data powered by DataForSEO &middot; Last updated: {new Date().toLocaleDateString('en-AU')}
      </div>
    </div>
  )
}
