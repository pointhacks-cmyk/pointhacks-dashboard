'use client'

import { useEffect, useState, useMemo } from 'react'
import { Lightbulb, Target, TrendingDown, FileText, Search, Filter, Eye, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDateRange } from '@/lib/DateRangeContext'
import { fetchAllRows, aggregateRows } from '@/lib/dataHelpers'
import RecTinder, { TinderRec } from '@/components/RecTinder'

type Severity = 'critical' | 'opportunity' | 'info'
type Impact = 'high' | 'medium' | 'low'
type Category = 'ctr' | 'quick-wins' | 'declining' | 'opportunities'

interface Rec {
  id: string
  severity: Severity
  category: Category
  icon: typeof Search
  title: string
  body: string
  impact: Impact
  impactScore: number
  item: string
  metrics: { label: string; value: string }[]
}

const TEAL = '#34D399', RED = '#EF4444', NAVY = '#6366f1', GOLD = '#F59E0B'

const sevStyle: Record<Severity, { color: string; label: string }> = {
  critical: { color: RED, label: 'CRITICAL' },
  opportunity: { color: TEAL, label: 'OPPORTUNITY' },
  info: { color: NAVY, label: 'INFO' },
}

const catLabel: Record<Category, string> = {
  ctr: 'CTR Issue', 'quick-wins': 'Quick Win', declining: 'Declining', opportunities: 'Opportunity',
}

const impactColor: Record<Impact, string> = { high: RED, medium: GOLD, low: TEAL }

function fmt(n: number) { return n.toLocaleString() }
function shortUrl(url: string) { return url.replace('https://www.pointhacks.com.au', '') || '/' }

export default function RecommendationsPage() {
  const { dateRange } = useDateRange()
  const { startDate, endDate } = dateRange
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tinderMode, setTinderMode] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => {
    async function generate() {
      try {
      const results: Rec[] = []

      // Fetch all rows with pagination + date filtering, then aggregate
      const [rawQueries, rawPages, kwRes] = await Promise.all([
        fetchAllRows('gsc_queries', startDate, endDate),
        fetchAllRows('gsc_pages', startDate, endDate),
        supabase.from('seo_keywords').select('*').order('search_volume', { ascending: false }),
      ])

      const aggQ = aggregateRows<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>(rawQueries, 'query')
      const aggP = aggregateRows<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>(rawPages, 'page')

      // Map to the field names used by the recommendation logic below
      const queries = aggQ.map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, avg_ctr: q.ctr / 100, avg_position: q.position }))
      const pages = aggP.map(p => ({ page: p.page, clicks: p.clicks, impressions: p.impressions, avg_ctr: p.ctr / 100, avg_position: p.position }))
      const keywords: { keyword: string; position: number; search_volume: number }[] = kwRes.data || []

      let id = 0

      // 1. CTR Issues — queries at position 1-5 with CTR below expected
      for (const q of queries) {
        if (q.avg_position > 5 || q.impressions < 200) continue
        const expected = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : 0.06
        if (q.avg_ctr >= expected) continue
        const actualPct = (q.avg_ctr * 100).toFixed(1)
        const expectedPct = Math.round(expected * 100)
        results.push({
          id: `ctr-q-${id++}`,
          severity: 'critical',
          category: 'ctr',
          icon: Search,
          title: `Optimize title/meta for "${q.query}"`,
          body: `Getting ${actualPct}% CTR at position #${q.avg_position.toFixed(0)} — expected ${expectedPct}%+. Title tag or meta description isn't compelling enough.`,
          impact: 'high',
          impactScore: q.impressions * (expected - q.avg_ctr) * 100,
          item: q.query,
          metrics: [
            { label: 'Position', value: `#${q.avg_position.toFixed(1)}` },
            { label: 'CTR', value: `${actualPct}%` },
            { label: 'Expected', value: `${expectedPct}%+` },
            { label: 'Impressions', value: fmt(q.impressions) },
          ],
        })
      }

      // 2. CTR Issues — pages with high impressions but low CTR (aggregated, no dupes)
      for (const p of pages) {
        if (p.impressions < 5000 || p.avg_ctr >= 0.02) continue
        const ctrPct = (p.avg_ctr * 100).toFixed(1)
        results.push({
          id: `ctr-p-${id++}`,
          severity: 'critical',
          category: 'ctr',
          icon: FileText,
          title: `Low CTR on ${shortUrl(p.page)}`,
          body: `${shortUrl(p.page)} gets ${fmt(p.impressions)} impressions but only ${fmt(p.clicks)} clicks (${ctrPct}% CTR) — meta description may not be compelling.`,
          impact: 'high',
          impactScore: p.impressions * 2,
          item: p.page,
          metrics: [
            { label: 'Impressions', value: fmt(p.impressions) },
            { label: 'Clicks', value: fmt(p.clicks) },
            { label: 'CTR', value: `${ctrPct}%` },
          ],
        })
      }

      // 3. Quick Wins — queries at position 4-15 with high impressions
      for (const q of queries) {
        if (q.avg_position < 4 || q.avg_position > 15 || q.impressions < 500) continue
        if (results.some(r => r.item === q.query)) continue
        results.push({
          id: `qw-${id++}`,
          severity: 'opportunity',
          category: 'quick-wins',
          icon: Target,
          title: `Push "${q.query}" into top 3`,
          body: `Currently #${q.avg_position.toFixed(0)} with ${fmt(q.impressions)} impressions. Small improvements could push this into top 3 for significant traffic gains.`,
          impact: q.avg_position <= 8 ? 'high' : 'medium',
          impactScore: q.impressions * (16 - q.avg_position),
          item: q.query,
          metrics: [
            { label: 'Position', value: `#${q.avg_position.toFixed(1)}` },
            { label: 'Impressions', value: fmt(q.impressions) },
            { label: 'Clicks', value: fmt(q.clicks) },
          ],
        })
      }

      // 4. Declining — pages with low click-through (position > 20, had impressions)
      for (const p of pages) {
        if (p.avg_position < 20 || p.impressions < 1000) continue
        results.push({
          id: `dec-${id++}`,
          severity: 'info',
          category: 'declining',
          icon: TrendingDown,
          title: `Low visibility: ${shortUrl(p.page)}`,
          body: `Average position #${p.avg_position.toFixed(0)} with ${fmt(p.impressions)} impressions — content may need a major refresh or better targeting.`,
          impact: p.impressions > 5000 ? 'medium' : 'low',
          impactScore: p.impressions,
          item: p.page,
          metrics: [
            { label: 'Position', value: `#${p.avg_position.toFixed(0)}` },
            { label: 'Impressions', value: fmt(p.impressions) },
            { label: 'Clicks', value: fmt(p.clicks) },
          ],
        })
      }

      // 5. Content Opportunities from seo_keywords (position > 10, high volume)
      for (const k of keywords) {
        if (!k.position || k.position <= 10 || !k.search_volume || k.search_volume < 1000) continue
        results.push({
          id: `opp-${id++}`,
          severity: 'opportunity',
          category: 'opportunities',
          icon: Lightbulb,
          title: `Content opportunity: "${k.keyword}"`,
          body: `You rank #${k.position} for '${k.keyword}' (${fmt(k.search_volume)} monthly searches) — content creation or optimization opportunity.`,
          impact: k.search_volume > 10000 ? 'high' : 'medium',
          impactScore: k.search_volume * 2,
          item: k.keyword,
          metrics: [
            { label: 'Position', value: `#${k.position}` },
            { label: 'Volume', value: `${fmt(k.search_volume)}/mo` },
          ],
        })
      }

      // Sort by impact score
      results.sort((a, b) => b.impactScore - a.impactScore)
      setRecs(results)
      } catch (e) {
        // Silently handle — shows empty state
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [startDate, endDate])

  const filtered = useMemo(() => filter === 'all' ? recs : recs.filter(r => r.category === filter), [recs, filter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const counts = useMemo(() => ({
    all: recs.length,
    ctr: recs.filter(r => r.category === 'ctr').length,
    'quick-wins': recs.filter(r => r.category === 'quick-wins').length,
    declining: recs.filter(r => r.category === 'declining').length,
    opportunities: recs.filter(r => r.category === 'opportunities').length,
  }), [recs])

  const severityCounts = useMemo(() => ({
    critical: recs.filter(r => r.severity === 'critical').length,
    opportunity: recs.filter(r => r.severity === 'opportunity').length,
    info: recs.filter(r => r.severity === 'info').length,
    highImpact: recs.filter(r => r.impact === 'high').length,
  }), [recs])

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto px-4 py-8">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="skeleton h-6 w-96 rounded-lg" />
        <div className="grid grid-cols-4 gap-3 mt-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-xl h-20" />)}
        </div>
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton rounded-xl h-32 mt-4" />)}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Recommendations</h1>
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${TEAL}20`, color: TEAL }}>
            {recs.length} actionable
          </span>
        </div>
        <p className="text-secondary">Data-driven insights from your analytics</p>
      </div>

      {/* Tinder mode button */}
      <div className="animate-in" style={{ animationDelay: '30ms', animationFillMode: 'both' }}>
        <button
          onClick={() => setTinderMode(true)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: '#34D399',
            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 16px #34D39926',
          }}
        >
          <Zap size={16} /> Swipe Review Mode
        </button>
      </div>

      {/* Tinder overlay */}
      {tinderMode && (
        <RecTinder
          recommendations={recs.map(r => ({
            id: r.id,
            severity: r.severity,
            category: r.category,
            iconType: r.icon === Search ? 'search' : r.icon === FileText ? 'file' : r.icon === Target ? 'target' : r.icon === TrendingDown ? 'trending-down' : 'lightbulb',
            title: r.title,
            body: r.body,
            impact: r.impact,
            item: r.item,
            metrics: r.metrics,
          }))}
          onComplete={(results) => {
            // Save results to Supabase
            for (const r of results) {
              supabase.from('monitor_actions').insert({
                alert_id: r.id, alert_title: recs.find(x => x.id === r.id)?.title || '',
                action: r.action, status: 'completed',
                result: { source: 'tinder_review', action: r.action },
              })
            }
          }}
          onClose={() => setTinderMode(false)}
        />
      )}

      {/* Glass tab bar */}
      <div className="animate-in" style={{
        animationDelay: '50ms', animationFillMode: 'both',
        display: 'inline-flex', gap: 4, padding: 4, borderRadius: 14,
        background: '#2A2A2A',
        border: '1px solid #2A2A2A',
        
      }}>
        {(['all', 'ctr', 'quick-wins', 'declining', 'opportunities'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.2s ease',
              background: filter === f ? '#34D39920' : 'transparent',
              color: filter === f ? TEAL : '#8A8A8A',
              backdropFilter: filter === f ? 'blur(8px)' : 'none',
              boxShadow: filter === f ? '0 2px 8px #34D39915' : 'none',
            }}
          >
            {f === 'all' ? 'All' : catLabel[f]}
            <span style={{ marginLeft: 5, opacity: 0.5, fontSize: '0.7rem' }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Summary glass tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        {[
          { label: 'Critical', count: severityCounts.critical, color: RED, borderColor: '#EF44444d' },
          { label: 'Opportunity', count: severityCounts.opportunity, color: TEAL, borderColor: '#34D3994d' },
          { label: 'Info', count: severityCounts.info, color: '#6699ff', borderColor: '#3b82f64d' },
          { label: 'High Impact', count: severityCounts.highImpact, color: '#fff', borderColor: '#383838' },
        ].map(t => (
          <div key={t.label} style={{
            padding: '16px 20px', borderRadius: 14,
            background: '#2A2A2A',
            border: `1px solid ${t.count > 0 ? t.borderColor : '#2A2A2A'}`,
            
          }}>
            <div className="text-2xl font-extrabold" style={{ color: t.count > 0 ? t.color : '#383838' }}>{t.count}</div>
            <div className="text-xs mt-1" style={{ color: '#707070' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Recommendations list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="glass-card-static text-center py-16">
            <Lightbulb size={40} className="mx-auto mb-4" style={{ color: '#383838' }} />
            <p className="text-secondary">No recommendations in this category.</p>
          </div>
        )}

        {paged.map((rec, idx) => {
          const sev = sevStyle[rec.severity]
          const Icon = rec.icon
          const expanded = expandedId === rec.id
          return (
            <div
              key={rec.id}
              className="animate-in"
              style={{ animationDelay: `${150 + idx * 20}ms`, animationFillMode: 'both' }}
            >
              <div
                className="glass-card-static"
                style={{
                  padding: '16px 20px',
                  borderLeft: `3px solid ${sev.color}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setExpandedId(expanded ? null : rec.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="shrink-0 mt-1 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${sev.color}12` }}>
                    <Icon size={16} style={{ color: sev.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Badges row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: `${sev.color}18`, color: sev.color }}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: '#707070' }}>
                        {catLabel[rec.category]}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-white mb-1">{rec.title}</h3>

                    {/* Body */}
                    <p className="text-xs" style={{ color: '#8C8C8C', lineHeight: 1.6 }}>{rec.body}</p>

                    {/* Affected item */}
                    <div className="mt-2 text-xs" style={{ color: '#606060' }}>
                      → {rec.item.startsWith('http') ? shortUrl(rec.item) : rec.item}
                    </div>

                    {/* Metrics */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rec.metrics.map(m => (
                        <span key={m.label} className="px-2 py-1 rounded text-[11px]" style={{ background: '#2A2A2A', color: '#9A9A9A' }}>
                          {m.label}: <span className="font-bold text-white">{m.value}</span>
                        </span>
                      ))}
                    </div>

                    {/* Expanded action buttons */}
                    {expanded && (
                      <div className="mt-4 pt-3" style={{ borderTop: '1px solid #2A2A2A' }}>
                        <div className="flex gap-2">
                          {[
                            { label: 'Ignore', bg: '#2A2A2A', color: '#8A8A8A' },
                            { label: 'Fix', bg: `${TEAL}15`, color: TEAL },
                            { label: 'Analysis', bg: `${NAVY}25`, color: '#6699ff' },
                            { label: 'Implement', bg: '#8B5CF626', color: '#a78bfa' },
                          ].map(btn => (
                            <button key={btn.label} style={{
                              padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                              cursor: 'pointer', border: `1.5px solid ${btn.color}`, background: 'transparent', color: btn.color,
                              transition: 'all 0.15s',
                            }}>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ color: impactColor[rec.impact] }}>
                      {rec.impact === 'high' ? 'HIGH IMPACT' : rec.impact === 'medium' ? 'MEDIUM' : 'LOW'}
                    </span>
                    <Eye size={14} style={{ color: '#383838' }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 animate-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <button
            onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            disabled={page <= 1}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: page <= 1 ? 'default' : 'pointer',
              background: page <= 1 ? '#2A2A2A' : '#34D3991a',
              color: page <= 1 ? '#383838' : TEAL, fontWeight: 600, fontSize: '0.8rem',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs text-secondary">
            Page <span className="text-white font-bold">{page}</span> of <span className="text-white font-bold">{totalPages}</span>
            <span style={{ marginLeft: 8, opacity: 0.5 }}>({filtered.length} total)</span>
          </span>
          <button
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            disabled={page >= totalPages}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: page >= totalPages ? 'default' : 'pointer',
              background: page >= totalPages ? '#2A2A2A' : '#34D3991a',
              color: page >= totalPages ? '#383838' : TEAL, fontWeight: 600, fontSize: '0.8rem',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
