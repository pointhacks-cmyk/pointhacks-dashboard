'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Eye, TrendingDown, MousePointerClick, Users, DollarSign, ChevronLeft, ChevronDown, ChevronUp, Stethoscope, GitCompare, Bookmark, X, Loader2, Send, Star } from 'lucide-react'
import { useDateRange } from '@/lib/DateRangeContext'
import { fetchAllRows, aggregateRows } from '@/lib/dataHelpers'

// ─── Types ───────────────────────────────────────────────────────
type Severity = 'critical' | 'warning' | 'minor'
type BucketKey = 'visibility' | 'ranking' | 'ctr' | 'engagement' | 'conversion'

interface Issue {
  page: string
  primaryMetric: string
  current: number
  previous: number
  changePct: number
  severity: Severity
  weight: number
  impact: number
  currentMetrics: Record<string, number>
  previousMetrics: Record<string, number>
}

interface BucketDef {
  key: BucketKey
  name: string
  icon: typeof Eye
  description: string
  gold?: boolean
}

interface WatchItem {
  page: string
  bucket: string
  addedAt: string
  metrics: { current: any; previous: any }
}

// ─── Constants ───────────────────────────────────────────────────
const BUCKETS: BucketDef[] = [
  { key: 'visibility', name: 'Losing Search Visibility', icon: Eye, description: 'Pages with declining impressions' },
  { key: 'ranking', name: 'Rankings Dropping', icon: TrendingDown, description: 'Pages losing position in search' },
  { key: 'ctr', name: 'Seen But Not Clicked', icon: MousePointerClick, description: 'High impressions but CTR declining' },
  { key: 'engagement', name: 'Landing But Not Converting', icon: Users, description: 'Bounce rate up or click-out rate declining on pages with stable traffic' },
  { key: 'conversion', name: 'Click-Outs Declining', icon: DollarSign, description: 'Affiliate click-outs going down', gold: true },
]

const SEV_COLORS: Record<Severity, string> = { critical: '#EF4444', warning: '#F59E0B', minor: '#34D399' }
const SEV_EMOJI: Record<Severity, string> = { critical: '🔴', warning: '🟡', minor: '🟢' }

// ─── Helpers ─────────────────────────────────────────────────────
function getWeight(url: string): number {
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  if (path.startsWith('/credit-cards')) return 3
  if (path.startsWith('/qantas') || path.startsWith('/velocity') || path.startsWith('/amex')) return 2
  return 1
}

function getSeverity(changePct: number, weight: number): Severity {
  const weighted = Math.abs(changePct) * weight
  if (weighted >= 30) return 'critical'
  if (weighted >= 15) return 'warning'
  return 'minor'
}

function shortUrl(url: string) { return url.replace(/^https?:\/\/[^/]+/, '') || '/' }
function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }
function fmt(n: number) { return Math.round(n).toLocaleString() }

function getFolder(url: string): string {
  const path = shortUrl(url)
  const match = path.match(/^\/[^/]+\//)
  return match ? match[0] : '/'
}

function worstSeverity(issues: Issue[]): Severity {
  if (issues.some(i => i.severity === 'critical')) return 'critical'
  if (issues.some(i => i.severity === 'warning')) return 'warning'
  return 'minor'
}

function loadWatchlist(): WatchItem[] {
  try { return JSON.parse(localStorage.getItem('ph-watchlist') || '[]') } catch { return [] }
}
function saveWatchlist(items: WatchItem[]) {
  localStorage.setItem('ph-watchlist', JSON.stringify(items))
}

// ─── Component ───────────────────────────────────────────────────
export default function RecommendationsPage() {
  const { dateRange } = useDateRange()
  const { startDate, endDate } = dateRange

  const [loading, setLoading] = useState(true)
  const [bucketIssues, setBucketIssues] = useState<Record<BucketKey, Issue[]>>({ visibility: [], ranking: [], ctr: [], engagement: [], conversion: [] })
  const [activeBucket, setActiveBucket] = useState<BucketKey | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [watchlistOpen, setWatchlistOpen] = useState(false)

  useEffect(() => { setWatchlist(loadWatchlist()) }, [])

  const toggleWatch = useCallback((issue: Issue, bucket: BucketKey) => {
    setWatchlist(prev => {
      const exists = prev.some(w => w.page === issue.page && w.bucket === bucket)
      const next = exists ? prev.filter(w => !(w.page === issue.page && w.bucket === bucket))
        : [...prev, { page: issue.page, bucket, addedAt: new Date().toISOString(), metrics: { current: issue.currentMetrics, previous: issue.previousMetrics } }]
      saveWatchlist(next)
      return next
    })
  }, [])

  // ─── Data Fetching ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
        const prevEnd = new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10)
        const prevStart = new Date(new Date(prevEnd).getTime() - daysDiff * 86400000).toISOString().slice(0, 10)

        const [curGsc, prevGsc, curGa4, prevGa4] = await Promise.all([
          fetchAllRows('gsc_pages', startDate, endDate),
          fetchAllRows('gsc_pages', prevStart, prevEnd),
          fetchAllRows('ga4_pages', startDate, endDate),
          fetchAllRows('ga4_pages', prevStart, prevEnd),
        ])

        const aggCurGsc = aggregateRows<any>(curGsc, 'page')
        const aggPrevGsc = aggregateRows<any>(prevGsc, 'page')
        const prevGscMap = new Map(aggPrevGsc.map((p: any) => [p.page, p]))

        // GA4 aggregation by page_path
        const aggGa4 = (rows: any[]) => {
          const map = new Map<string, { sessions: number; bounce_sum: number; time_sum: number; clicks: number; count: number }>()
          for (const r of rows) {
            const key = r.page_path || r.page
            const ex = map.get(key)
            if (ex) {
              ex.sessions += r.sessions || 0
              ex.bounce_sum += (r.bounce_rate || 0) * (r.sessions || 1)
              ex.time_sum += (r.avg_time_on_page || 0) * (r.sessions || 1)
              ex.clicks += r.affiliate_clicks || 0
              ex.count += r.sessions || 1
            } else {
              map.set(key, { sessions: r.sessions || 0, bounce_sum: (r.bounce_rate || 0) * (r.sessions || 1), time_sum: (r.avg_time_on_page || 0) * (r.sessions || 1), clicks: r.affiliate_clicks || 0, count: r.sessions || 1 })
            }
          }
          return map
        }

        const curGa4Map = aggGa4(curGa4)
        const prevGa4Map = aggGa4(prevGa4)

        const issues: Record<BucketKey, Issue[]> = { visibility: [], ranking: [], ctr: [], engagement: [], conversion: [] }

        // Bucket 1: Visibility (impressions drop)
        for (const cur of aggCurGsc) {
          const prev = prevGscMap.get(cur.page)
          if (!prev || prev.impressions < 50) continue
          const change = ((cur.impressions - prev.impressions) / prev.impressions) * 100
          const w = getWeight(cur.page)
          const threshold = w >= 3 ? -10 : -20
          if (change > threshold) continue
          issues.visibility.push({
            page: cur.page, primaryMetric: 'Impressions', current: cur.impressions, previous: prev.impressions,
            changePct: change, severity: getSeverity(change, w), weight: w, impact: Math.abs(change) * w * prev.impressions / 100,
            currentMetrics: { clicks: cur.clicks, impressions: cur.impressions, ctr: cur.ctr, position: cur.position },
            previousMetrics: { clicks: prev.clicks, impressions: prev.impressions, ctr: prev.ctr, position: prev.position },
          })
        }

        // Bucket 2: Rankings (position worsening)
        for (const cur of aggCurGsc) {
          const prev = prevGscMap.get(cur.page)
          if (!prev || prev.impressions < 50) continue
          const posDelta = cur.position - prev.position // positive = worse
          const w = getWeight(cur.page)
          if (posDelta <= 2) continue
          const changePct = (posDelta / Math.max(1, prev.position)) * 100
          const sev: Severity = (w >= 2 && posDelta >= 5) ? 'critical' : posDelta >= 5 ? 'warning' : getSeverity(changePct, w)
          issues.ranking.push({
            page: cur.page, primaryMetric: 'Position', current: cur.position, previous: prev.position,
            changePct: posDelta, severity: sev, weight: w, impact: posDelta * w * prev.impressions / 10,
            currentMetrics: { clicks: cur.clicks, impressions: cur.impressions, ctr: cur.ctr, position: cur.position },
            previousMetrics: { clicks: prev.clicks, impressions: prev.impressions, ctr: prev.ctr, position: prev.position },
          })
        }

        // Bucket 3: CTR declining while impressions stable/growing
        for (const cur of aggCurGsc) {
          const prev = prevGscMap.get(cur.page)
          if (!prev || prev.impressions < 100) continue
          if (cur.impressions < prev.impressions * 0.9) continue // impressions must be stable
          const ctrChange = prev.ctr > 0 ? ((cur.ctr - prev.ctr) / prev.ctr) * 100 : 0
          if (ctrChange > -15) continue
          const w = getWeight(cur.page)
          issues.ctr.push({
            page: cur.page, primaryMetric: 'CTR', current: cur.ctr, previous: prev.ctr,
            changePct: ctrChange, severity: getSeverity(ctrChange, w), weight: w, impact: Math.abs(ctrChange) * w * cur.impressions / 100,
            currentMetrics: { clicks: cur.clicks, impressions: cur.impressions, ctr: cur.ctr, position: cur.position },
            previousMetrics: { clicks: prev.clicks, impressions: prev.impressions, ctr: prev.ctr, position: prev.position },
          })
        }

        // Bucket 4: Engagement — pages where traffic is stable but engagement/click-outs dropping
        // This catches pages where people land but don't convert (bounce up, time down, or click-outs down while traffic stable)
        for (const [path, cur] of curGa4Map) {
          const prev = prevGa4Map.get(path)
          if (!prev || prev.sessions < 10) continue
          const curBounce = cur.bounce_sum / Math.max(1, cur.count)
          const prevBounce = prev.bounce_sum / Math.max(1, prev.count)
          const bounceChange = prevBounce > 0 ? ((curBounce - prevBounce) / prevBounce) * 100 : 0
          const sessionChange = prev.sessions > 0 ? ((cur.sessions - prev.sessions) / prev.sessions) * 100 : 0
          const clickoutChange = prev.clicks > 0 ? ((cur.clicks - prev.clicks) / prev.clicks) * 100 : 0
          const w = getWeight('https://www.pointhacks.com.au' + path)

          // Flag if: bounce increased 10%+ OR (traffic stable/growing but click-outs dropped 15%+)
          const bounceProblem = bounceChange >= 10
          const clickoutProblem = prev.clicks > 2 && sessionChange > -10 && clickoutChange < -15
          if (!bounceProblem && !clickoutProblem) continue

          // Choose the worse metric as the primary
          const primaryIsClickout = clickoutProblem && (!bounceProblem || Math.abs(clickoutChange) > bounceChange)
          issues.engagement.push({
            page: path,
            primaryMetric: primaryIsClickout ? 'Click-Out Rate' : 'Bounce Rate',
            current: primaryIsClickout ? cur.clicks : curBounce,
            previous: primaryIsClickout ? prev.clicks : prevBounce,
            changePct: primaryIsClickout ? clickoutChange : bounceChange,
            severity: getSeverity(primaryIsClickout ? clickoutChange : bounceChange, w),
            weight: w,
            impact: (primaryIsClickout ? Math.abs(clickoutChange) * prev.clicks * 10 : bounceChange * cur.sessions / 10) * w,
            currentMetrics: { sessions: cur.sessions, bounce_rate: curBounce, avg_time: cur.time_sum / Math.max(1, cur.count), affiliate_clicks: cur.clicks, clickout_rate: cur.sessions > 0 ? (cur.clicks / cur.sessions) * 100 : 0 },
            previousMetrics: { sessions: prev.sessions, bounce_rate: prevBounce, avg_time: prev.time_sum / Math.max(1, prev.count), affiliate_clicks: prev.clicks, clickout_rate: prev.sessions > 0 ? (prev.clicks / prev.sessions) * 100 : 0 },
          })
        }

        // Bucket 5: Click-outs declining
        for (const [path, cur] of curGa4Map) {
          const prev = prevGa4Map.get(path)
          if (!prev) continue
          if (prev.clicks <= 0 && cur.clicks <= 0) continue // skip if both zero
          if (prev.clicks <= 0) continue
          const change = ((cur.clicks - prev.clicks) / prev.clicks) * 100
          if (change > -10) continue
          const w = getWeight('https://www.pointhacks.com.au' + path)
          issues.conversion.push({
            page: path, primaryMetric: 'Click-Outs', current: cur.clicks, previous: prev.clicks,
            changePct: change, severity: getSeverity(change, w), weight: w, impact: Math.abs(change) * w * prev.clicks,
            currentMetrics: { sessions: cur.sessions, affiliate_clicks: cur.clicks },
            previousMetrics: { sessions: prev.sessions, affiliate_clicks: prev.clicks },
          })
        }

        // Sort each bucket by impact
        for (const key of Object.keys(issues) as BucketKey[]) {
          issues[key].sort((a, b) => b.impact - a.impact)
        }

        setBucketIssues(issues)
      } catch (e) {
        console.error('Failed to load recommendations:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [startDate, endDate])

  // ─── Diagnose ──────────────────────────────────────────────────
  const handleDiagnose = async (issue: Issue, bucket: BucketKey) => {
    setDiagnosing(issue.page)
    setDiagnosis(null)
    try {
      const res = await fetch('/api/alert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: `${bucket}-${issue.page}`,
          alertTitle: `${bucket} issue on ${shortUrl(issue.page)}`,
          alertType: bucket === 'ranking' ? 'position_drop' : bucket === 'visibility' ? 'traffic_drop' : bucket === 'ctr' ? 'ctr_anomaly' : bucket === 'conversion' ? 'traffic_drop' : 'traffic_drop',
          action: 'recommended_fix',
          query: shortUrl(issue.page),
          page: issue.page,
          position: issue.currentMetrics.position || 0,
          ctr: (issue.currentMetrics.ctr || 0) / 100,
          alertData: {
            bucket, page: issue.page, currentMetrics: issue.currentMetrics, previousMetrics: issue.previousMetrics,
            changePct: issue.changePct, folder: getFolder(issue.page),
          },
        }),
      })
      const data = await res.json()
      setDiagnosis(data.result)
    } catch {
      setDiagnosis({ recommendation: { summary: 'Failed to get diagnosis. Please try again.', steps: [], priority: 'unknown', impact: 'unknown', rootCause: 'Error connecting to API' } })
    }
  }

  const closeDiagnosis = () => { setDiagnosing(null); setDiagnosis(null) }

  const sendToChat = (text: string) => {
    window.dispatchEvent(new CustomEvent('chat-submit', { detail: text }))
    closeDiagnosis()
  }

  // ─── Rendering ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto px-4 py-8">
        <div className="skeleton h-10 w-80 rounded-lg" />
        <div className="skeleton h-6 w-96 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton rounded-xl h-40" />)}
        </div>
      </div>
    )
  }

  const currentIssues = activeBucket ? bucketIssues[activeBucket] : []
  const currentBucket = BUCKETS.find(b => b.key === activeBucket)
  const hasNoClickOutData = bucketIssues.conversion.length === 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 className="text-2xl font-bold text-white mb-1">Issue Command Centre</h1>
        <p className="text-sm" style={{ color: '#8C8C8C' }}>Monitor your conversion funnel — from search visibility to click-outs</p>
      </div>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div className="animate-in" style={{ animationDelay: '30ms', animationFillMode: 'both' }}>
          <button onClick={() => setWatchlistOpen(!watchlistOpen)} className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <Bookmark size={14} style={{ color: '#F59E0B' }} />
            Watchlist
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#F59E0B20', color: '#F59E0B' }}>{watchlist.length}</span>
            {watchlistOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {watchlistOpen && (
            <div className="rounded-xl p-3 space-y-1 mb-4" style={{ background: '#2A2A2A', border: '1px solid #383838' }}>
              {watchlist.map((w, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded" style={{ background: '#1A1A1A' }}>
                  <span className="text-white truncate flex-1">{shortUrl(w.page)}</span>
                  <span className="text-[#8C8C8C] mx-2">{w.bucket}</span>
                  <button onClick={() => { const next = watchlist.filter((_, j) => j !== i); saveWatchlist(next); setWatchlist(next) }} className="text-[#EF4444] hover:text-white">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bucket Overview */}
      {!activeBucket && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-in" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
          {BUCKETS.map((bucket, idx) => {
            const issues = bucketIssues[bucket.key]
            const count = issues.length
            const worst = count > 0 ? worstSeverity(issues) : 'minor'
            const Icon = bucket.icon
            const isConversion = bucket.gold
            const showNoData = isConversion && hasNoClickOutData

            return (
              <button
                key={bucket.key}
                onClick={() => setActiveBucket(bucket.key)}
                className="text-left rounded-xl p-5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: '#2A2A2A',
                  borderLeft: `4px solid ${showNoData ? '#383838' : count > 0 ? SEV_COLORS[worst] : '#34D399'}`,
                  border: isConversion ? '1px solid #F59E0B40' : '1px solid #383838',
                  borderLeftWidth: 4,
                  borderLeftColor: isConversion ? '#F59E0B' : count > 0 ? SEV_COLORS[worst] : '#34D399',
                  animationDelay: `${100 + idx * 50}ms`,
                  animationFillMode: 'both',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isConversion ? '#F59E0B15' : `${count > 0 ? SEV_COLORS[worst] : '#34D399'}15` }}>
                    {isConversion ? <Star size={16} style={{ color: '#F59E0B' }} /> : <Icon size={16} style={{ color: count > 0 ? SEV_COLORS[worst] : '#34D399' }} />}
                  </div>
                  {count > 0 && <span className="text-lg">{SEV_EMOJI[worst]}</span>}
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{bucket.name}</h3>
                <div className="text-2xl font-extrabold mb-1" style={{ color: showNoData ? '#383838' : count > 0 ? SEV_COLORS[worst] : '#34D399' }}>
                  {showNoData ? '—' : count}
                </div>
                <p className="text-[11px]" style={{ color: '#707070' }}>
                  {showNoData ? 'Not yet configured' : count === 0 ? 'All clear' : `${issues.filter(i => i.severity === 'critical').length} critical`}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Drill-Down View */}
      {activeBucket && currentBucket && (
        <div className="animate-in" style={{ animationFillMode: 'both' }}>
          {/* Back + Summary */}
          <button onClick={() => { setActiveBucket(null); setExpandedRow(null) }} className="flex items-center gap-1 text-sm mb-4 hover:text-white transition-colors" style={{ color: '#8C8C8C' }}>
            <ChevronLeft size={16} /> Back to overview
          </button>

          <div className="flex items-center gap-3 mb-4">
            <currentBucket.icon size={20} style={{ color: currentBucket.gold ? '#F59E0B' : '#34D399' }} />
            <h2 className="text-lg font-bold text-white">{currentBucket.name}</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#383838', color: '#8C8C8C' }}>{currentIssues.length} pages</span>
            {currentIssues.length > 0 && (
              <div className="flex gap-2 ml-2">
                {(['critical', 'warning', 'minor'] as Severity[]).map(s => {
                  const c = currentIssues.filter(i => i.severity === s).length
                  if (c === 0) return null
                  return <span key={s} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${SEV_COLORS[s]}15`, color: SEV_COLORS[s] }}>{c} {s}</span>
                })}
              </div>
            )}
          </div>

          {/* Conversion bucket empty state */}
          {activeBucket === 'conversion' && hasNoClickOutData && (
            <div className="rounded-xl p-8 text-center" style={{ background: '#2A2A2A', border: '1px solid #F59E0B30' }}>
              <DollarSign size={40} className="mx-auto mb-3" style={{ color: '#F59E0B40' }} />
              <h3 className="text-white font-bold mb-2">Click-out tracking not yet configured</h3>
              <p className="text-sm mb-4" style={{ color: '#8C8C8C' }}>
                Set up GA4 key events to track outbound clicks to bank application pages. Once data flows, this bucket will automatically detect declining click-outs on revenue pages.
              </p>
              <div className="inline-block rounded-lg px-4 py-2 text-xs font-mono" style={{ background: '#1A1A1A', color: '#707070' }}>
                ga4_pages.affiliate_clicks → currently all 0
              </div>
            </div>
          )}

          {/* Issues Table */}
          {currentIssues.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#2A2A2A', border: '1px solid #383838' }}>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#707070', borderBottom: '1px solid #383838' }}>
                <div className="col-span-4">Page</div>
                <div className="col-span-1">Metric</div>
                <div className="col-span-1 text-right">Current</div>
                <div className="col-span-1 text-right">Previous</div>
                <div className="col-span-1 text-right">Change</div>
                <div className="col-span-1 text-center">Severity</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>

              {/* Rows */}
              {currentIssues.map((issue, idx) => {
                const isExpanded = expandedRow === issue.page
                const isWatched = watchlist.some(w => w.page === issue.page && w.bucket === activeBucket)
                return (
                  <div key={issue.page} className="animate-in" style={{ animationDelay: `${idx * 20}ms`, animationFillMode: 'both' }}>
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid #2A2A2A' }}>
                      <div className="col-span-4 truncate text-white font-medium text-xs" title={issue.page}>{shortUrl(issue.page)}</div>
                      <div className="col-span-1 text-[11px]" style={{ color: '#8C8C8C' }}>{issue.primaryMetric}</div>
                      <div className="col-span-1 text-right text-xs text-white">{issue.primaryMetric === 'CTR' ? `${issue.current.toFixed(1)}%` : issue.primaryMetric === 'Position' ? `#${issue.current.toFixed(1)}` : fmt(issue.current)}</div>
                      <div className="col-span-1 text-right text-xs" style={{ color: '#707070' }}>{issue.primaryMetric === 'CTR' ? `${issue.previous.toFixed(1)}%` : issue.primaryMetric === 'Position' ? `#${issue.previous.toFixed(1)}` : fmt(issue.previous)}</div>
                      <div className="col-span-1 text-right text-xs font-bold" style={{ color: SEV_COLORS[issue.severity] }}>
                        {issue.primaryMetric === 'Position' ? `+${issue.changePct.toFixed(1)}` : pct(issue.changePct)}
                      </div>
                      <div className="col-span-1 text-center text-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: `${SEV_COLORS[issue.severity]}15`, color: SEV_COLORS[issue.severity] }}>
                          {issue.severity}
                        </span>
                      </div>
                      <div className="col-span-3 flex justify-end gap-1">
                        <button onClick={() => handleDiagnose(issue, activeBucket)} className="px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-white/10 transition-colors" style={{ color: '#6366f1', border: '1px solid #6366f140' }}>
                          <Stethoscope size={10} /> Diagnose
                        </button>
                        <button onClick={() => setExpandedRow(isExpanded ? null : issue.page)} className="px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-white/10 transition-colors" style={{ color: '#34D399', border: '1px solid #34D39940' }}>
                          <GitCompare size={10} /> Compare
                        </button>
                        <button onClick={() => toggleWatch(issue, activeBucket)} className="px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-white/10 transition-colors" style={{ color: isWatched ? '#F59E0B' : '#8C8C8C', border: `1px solid ${isWatched ? '#F59E0B40' : '#38383840'}` }}>
                          <Bookmark size={10} fill={isWatched ? '#F59E0B' : 'none'} /> {isWatched ? 'Watched' : 'Watch'}
                        </button>
                      </div>
                    </div>

                    {/* Compare expansion */}
                    {isExpanded && (
                      <div className="px-6 py-4" style={{ background: '#1A1A1A', borderBottom: '1px solid #383838' }}>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-[10px] uppercase tracking-wider mb-2 font-bold" style={{ color: '#34D399' }}>Current Period</h4>
                            {Object.entries(issue.currentMetrics).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-xs py-1">
                                <span style={{ color: '#8C8C8C' }}>{k.replace(/_/g, ' ')}</span>
                                <span className="text-white font-medium">{typeof v === 'number' ? (k.includes('rate') || k === 'ctr' ? `${v.toFixed(1)}%` : k === 'position' ? `#${v.toFixed(1)}` : fmt(v)) : v}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h4 className="text-[10px] uppercase tracking-wider mb-2 font-bold" style={{ color: '#707070' }}>Previous Period</h4>
                            {Object.entries(issue.previousMetrics).map(([k, v]) => (
                              <div key={k} className="flex justify-between text-xs py-1">
                                <span style={{ color: '#8C8C8C' }}>{k.replace(/_/g, ' ')}</span>
                                <span style={{ color: '#707070' }}>{typeof v === 'number' ? (k.includes('rate') || k === 'ctr' ? `${v.toFixed(1)}%` : k === 'position' ? `#${v.toFixed(1)}` : fmt(v)) : v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {currentIssues.length === 0 && activeBucket !== 'conversion' && (
            <div className="rounded-xl p-12 text-center" style={{ background: '#2A2A2A', border: '1px solid #383838' }}>
              <currentBucket.icon size={40} className="mx-auto mb-3" style={{ color: '#34D39940' }} />
              <p className="text-white font-semibold mb-1">All clear!</p>
              <p className="text-sm" style={{ color: '#8C8C8C' }}>No issues detected in this bucket for the selected period.</p>
            </div>
          )}
        </div>
      )}

      {/* Diagnosis Modal */}
      {diagnosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" style={{ background: '#1A1A1A', border: '1px solid #383838' }}>
            <div className="flex items-center justify-between p-5 pb-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
              <div>
                <h3 className="text-white font-bold">AI Diagnosis</h3>
                <p className="text-[11px]" style={{ color: '#707070' }}>{shortUrl(diagnosing)}</p>
              </div>
              <button onClick={closeDiagnosis} className="p-2 rounded-lg hover:bg-white/10"><X size={16} /></button>
            </div>

            <div className="p-5">
              {!diagnosis ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin" style={{ color: '#6366f1' }} />
                  <span className="ml-3 text-sm" style={{ color: '#8C8C8C' }}>Analyzing...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {diagnosis.recommendation ? (
                    <>
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#6366f1' }}>Problem Summary</h4>
                        <p className="text-sm text-white">{diagnosis.recommendation.summary}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#F59E0B' }}>Root Cause Analysis</h4>
                        <p className="text-sm" style={{ color: '#8C8C8C' }}>{diagnosis.recommendation.rootCause}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#34D399' }}>Recommended Actions</h4>
                        <ol className="space-y-2">
                          {(diagnosis.recommendation.steps || []).map((step: string, i: number) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#34D39920', color: '#34D399' }}>{i + 1}</span>
                              <span style={{ color: '#C0C0C0' }}>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#707070' }}>Priority</h4>
                          <span className="text-sm font-bold text-white uppercase">{diagnosis.recommendation.priority}</span>
                        </div>
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#707070' }}>Est. Impact</h4>
                          <span className="text-sm" style={{ color: '#8C8C8C' }}>{diagnosis.recommendation.impact}</span>
                        </div>
                      </div>
                    </>
                  ) : diagnosis.tasks ? (
                    <>
                      <h4 className="text-sm font-bold text-white">{diagnosis.heading}</h4>
                      <ol className="space-y-2">
                        {diagnosis.tasks.map((t: any, i: number) => (
                          <li key={i} className="text-sm">
                            <span className="font-semibold text-white">{t.title}</span>
                            <p className="text-xs mt-0.5" style={{ color: '#8C8C8C' }}>{t.detail}</p>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: '#8C8C8C' }}>{JSON.stringify(diagnosis)}</p>
                  )}

                  <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #2A2A2A' }}>
                    <button onClick={closeDiagnosis} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: '#383838', color: '#8C8C8C' }}>Close</button>
                    <button onClick={() => sendToChat(`Analyze the issue on ${shortUrl(diagnosing)}: ${diagnosis.recommendation?.summary || diagnosis.heading || 'Investigate this page'}`)} className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1" style={{ background: '#6366f120', color: '#6366f1', border: '1px solid #6366f140' }}>
                      <Send size={10} /> Send to Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
