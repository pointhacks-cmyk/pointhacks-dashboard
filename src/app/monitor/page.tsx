'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  AlertTriangle, TrendingDown, TrendingUp, Search, Eye, MousePointerClick,
  ShieldAlert, ShieldCheck, ShieldQuestion, Activity, Target, FileText,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, ChevronRight, Zap,
  AlertCircle, Info, ExternalLink, CheckCircle2, Clock, Archive
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/dataHelpers'

/* ─── Types ─── */
interface GscQuery { query: string; clicks: number; impressions: number; ctr: number; position: number; date: string }
interface GscPage  { page: string; clicks: number; impressions: number; ctr: number; position: number; date: string }
interface SeoKeyword { keyword: string; position: number; search_volume: number; date: string }

type AlertAction = 'ignore' | 'fix' | 'analysis' | 'implement' | null

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  type: string
  title: string
  detail: string
  metric: string
  previous: string
  current: string
  estimatedImpact?: string
  query?: string
  page?: string
  resolved?: boolean
  resolvedAt?: string
  resolvedAction?: string
}

interface KeywordRow {
  keyword: string
  currentPosition: number
  avgPosition: number
  change: number
  searchVolume: number
  clicks7d: number
  ctr: number
  status: 'top3' | 'top10' | 'declining' | 'lost'
}

interface PageRow {
  page: string
  clicksThisWeek: number
  clicksLastWeek: number
  pctChange: number
  position: number
  ctr: number
  declining: boolean
}

interface MonitorAction {
  id: string
  alert_id: string
  action: string
  status: string
  completed_at: string
}

/* ─── Helpers ─── */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function expectedCtr(position: number): number {
  if (position <= 1) return 0.28
  if (position <= 2) return 0.15
  if (position <= 3) return 0.11
  if (position <= 5) return 0.06
  if (position <= 10) return 0.03
  return 0.01
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '')
  } catch {
    return url
  }
}

/* ─── SVG Gauge ─── */
function HealthGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score))
  const color = clamp > 70 ? '#34D399' : clamp > 40 ? '#F59E0B' : '#EF4444'
  const bgColor = '#333333'
  const radius = 80
  const stroke = 12
  const circumference = Math.PI * radius
  const offset = circumference - (clamp / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="115" viewBox="0 0 200 115">
        <path
          d={`M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${100 + radius} 100`}
          fill="none" stroke={bgColor} strokeWidth={stroke} strokeLinecap="round"
        />
        <path
          d={`M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${100 + radius} 100`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        <text x="100" y="85" textAnchor="middle" fill={color} fontSize="42" fontWeight="800">{clamp}</text>
        <text x="100" y="105" textAnchor="middle" fill="#8C8C8C" fontSize="12" fontWeight="500">/ 100</text>
      </svg>
      <span className="text-sm mt-1" style={{ color }}>
        {clamp > 70 ? 'Healthy' : clamp > 40 ? 'Needs Attention' : 'Critical'}
      </span>
    </div>
  )
}

/* ─── Severity Badge ─── */
function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const cfg = {
    critical: { bg: '#EF444433', border: '#EF444466', color: '#f87171', label: 'Critical', Icon: AlertTriangle },
    warning:  { bg: '#F59E0B26', border: '#F59E0B4d', color: '#F59E0B', label: 'Warning', Icon: AlertCircle },
    info:     { bg: '#34D39920', border: '#34D39940', color: '#34D399', label: 'Info', Icon: Info },
  }[severity]

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <cfg.Icon size={12} /> {cfg.label}
    </span>
  )
}

/* ─── Resolved Badge ─── */
function ResolvedBadge({ action, resolvedAt }: { action: string; resolvedAt: string }) {
  const timeAgo = resolvedAt ? new Date(resolvedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: '#34D39920', border: '1px solid #34D39940', color: '#34D399' }}
    >
      <CheckCircle2 size={12} />
      Resolved via {action} {timeAgo && <span style={{ color: '#8A8A8A' }}>{timeAgo}</span>}
    </span>
  )
}

/* ─── Main Page ─── */
export default function MonitorPage() {
  const [queries, setQueries] = useState<GscQuery[]>([])
  const [pages, setPages] = useState<GscPage[]>([])
  const [keywords, setKeywords] = useState<SeoKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [resolvedAlertIds, setResolvedAlertIds] = useState<Record<string, MonitorAction>>({})
  const [showResolved, setShowResolved] = useState(false)
  const [alertActions, setAlertActions] = useState<Record<string, AlertAction>>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('ph-alert-actions') || '{}') } catch { return {} }
    }
    return {}
  })

  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, any>>({})
  const [fixModal, setFixModal] = useState<{ alert: Alert; loading: boolean; result: any } | null>(null)

  function setAction(alertId: string, action: AlertAction) {
    setAlertActions(prev => {
      const next = { ...prev, [alertId]: prev[alertId] === action ? null : action }
      localStorage.setItem('ph-alert-actions', JSON.stringify(next))
      return next
    })
    setResults(prev => { const n = { ...prev }; delete n[alertId]; return n })
  }

  async function handleSave(alert: Alert) {
    const action = alertActions[alert.id]
    if (!action) return
    setSaving(prev => ({ ...prev, [alert.id]: true }))
    try {
      const resp = await fetch('/api/alert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id, alertTitle: alert.title, alertType: alert.type,
          query: alert.query, page: alert.page, action,
          position: parseFloat(alert.current) || null,
          ctr: alert.metric === 'CTR' ? parseFloat(alert.current) / 100 : null,
        }),
      })
      const data = await resp.json()
      setResults(prev => ({ ...prev, [alert.id]: data.result || data }))
      // Mark as resolved locally
      setResolvedAlertIds(prev => ({
        ...prev,
        [alert.id]: { id: data.actionId || '', alert_id: alert.id, action, status: 'completed', completed_at: new Date().toISOString() }
      }))
    } catch (err: any) {
      setResults(prev => ({ ...prev, [alert.id]: { error: err.message } }))
    }
    setSaving(prev => ({ ...prev, [alert.id]: false }))
  }

  async function handleRecommendedFix(alert: Alert) {
    setFixModal({ alert, loading: true, result: null })
    setSaving(prev => ({ ...prev, [alert.id]: true }))
    try {
      const resp = await fetch('/api/alert-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: alert.id, alertTitle: alert.title, alertType: alert.type,
          query: alert.query, page: alert.page, action: 'recommended_fix',
          position: parseFloat(alert.current) || null,
          ctr: alert.metric === 'CTR' ? parseFloat(alert.current) / 100 : null,
        }),
      })
      const data = await resp.json()
      setFixModal({ alert, loading: false, result: data.result || data })
      setResolvedAlertIds(prev => ({
        ...prev,
        [alert.id]: { id: data.actionId || '', alert_id: alert.id, action: 'recommended_fix', status: 'completed', completed_at: new Date().toISOString() }
      }))
    } catch (err: any) {
      setFixModal({ alert, loading: false, result: { error: err.message } })
    }
    setSaving(prev => ({ ...prev, [alert.id]: false }))
  }

  // Load previously resolved actions from Supabase
  const loadResolvedActions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('monitor_actions')
        .select('id, alert_id, action, status, completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(200)
      if (data) {
        const map: Record<string, MonitorAction> = {}
        for (const row of data) {
          if (!map[row.alert_id]) map[row.alert_id] = row as MonitorAction
        }
        setResolvedAlertIds(map)
      }
    } catch { /* silent */ }
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const since = daysAgo(21)
      const today = daysAgo(0)
      const [qAll, pAll, kRes] = await Promise.all([
        fetchAllRows('gsc_queries', since, today),
        fetchAllRows('gsc_pages', since, today),
        supabase.from('seo_keywords').select('*').gte('date', since).order('date', { ascending: false }),
      ])
      setQueries(qAll as GscQuery[])
      setPages(pAll as GscPage[])
      setKeywords(kRes.data ?? [])

      const { data: syncData } = await supabase
        .from('sync_log').select('completed_at').eq('source', 'gsc')
        .order('completed_at', { ascending: false }).limit(1)
      if (syncData?.[0]) setLastSync(syncData[0].completed_at)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(); loadResolvedActions() }, [loadResolvedActions])

  /* ─── Derived Data ─── */
  const hasData = queries.length > 0 || pages.length > 0 || keywords.length > 0
  const today = daysAgo(0)
  const weekAgo = daysAgo(7)
  const twoWeeksAgo = daysAgo(14)

  const queriesThisWeek = useMemo(() => queries.filter(q => q.date >= weekAgo && q.date <= today), [queries, weekAgo, today])
  const queriesLastWeek = useMemo(() => queries.filter(q => q.date >= twoWeeksAgo && q.date < weekAgo), [queries, twoWeeksAgo, weekAgo])

  const latestDate = useMemo(() => {
    if (!queries.length) return today
    return queries.reduce((max, q) => q.date > max ? q.date : max, queries[0].date)
  }, [queries, today])

  /* ─── Alerts Generation ─── */
  const alerts: Alert[] = useMemo(() => {
    if (!hasData) return []
    const result: Alert[] = []
    let id = 0

    // 1. Position drops
    const latestQueries = queries.filter(q => q.date === latestDate)
    const recentQueries = queries.filter(q => q.date >= daysAgo(7) && q.date < latestDate)
    const avgByQuery: Record<string, { sumPos: number; count: number }> = {}
    for (const q of recentQueries) {
      if (!avgByQuery[q.query]) avgByQuery[q.query] = { sumPos: 0, count: 0 }
      avgByQuery[q.query].sumPos += q.position
      avgByQuery[q.query].count++
    }

    for (const q of latestQueries) {
      const avg = avgByQuery[q.query]
      if (!avg) continue
      const avgPos = avg.sumPos / avg.count
      const drop = q.position - avgPos
      if (drop > 3) {
        result.push({
          id: `pos-${id++}`, severity: 'critical', type: 'position_drop',
          title: `Position drop: "${q.query}"`,
          detail: `Dropped ${drop.toFixed(1)} positions from 7-day average`,
          metric: 'Position', previous: avgPos.toFixed(1), current: q.position.toFixed(1),
          estimatedImpact: q.clicks > 0 ? `~${formatNum(Math.round(q.clicks * 0.6 * 30))} clicks/mo at risk` : undefined,
          query: q.query,
        })
      } else if (drop > 1) {
        result.push({
          id: `pos-${id++}`, severity: 'warning', type: 'position_drop',
          title: `Position slipping: "${q.query}"`,
          detail: `Slipped ${drop.toFixed(1)} positions from 7-day average`,
          metric: 'Position', previous: avgPos.toFixed(1), current: q.position.toFixed(1),
          query: q.query,
        })
      }
    }

    // 2. CTR anomalies
    for (const q of latestQueries) {
      if (q.position > 10) continue
      const expected = expectedCtr(q.position)
      if (q.ctr < expected * 0.5) {
        result.push({
          id: `ctr-${id++}`, severity: 'warning', type: 'ctr_anomaly',
          title: `Low CTR: "${q.query}"`,
          detail: `CTR ${(q.ctr * 100).toFixed(1)}% vs ${(expected * 100).toFixed(0)}% expected at position ${q.position.toFixed(0)}. Title/meta may need attention.`,
          metric: 'CTR', previous: `${(expected * 100).toFixed(0)}% expected`, current: `${(q.ctr * 100).toFixed(1)}%`,
          query: q.query,
        })
      }
    }

    // 3. Traffic drops by page
    const pagesThisWeek = pages.filter(p => p.date >= weekAgo)
    const pagesLastWeek = pages.filter(p => p.date >= twoWeeksAgo && p.date < weekAgo)
    const clicksByPage = (rows: GscPage[]) => {
      const m: Record<string, number> = {}
      for (const r of rows) m[r.page] = (m[r.page] || 0) + r.clicks
      return m
    }
    const thisWeekClicks = clicksByPage(pagesThisWeek)
    const lastWeekClicks = clicksByPage(pagesLastWeek)

    for (const [page, prev] of Object.entries(lastWeekClicks)) {
      const curr = thisWeekClicks[page] || 0
      if (prev > 5 && curr < prev * 0.85) {
        const pctDrop = ((prev - curr) / prev * 100).toFixed(0)
        result.push({
          id: `traffic-${id++}`, severity: Number(pctDrop) > 30 ? 'critical' : 'warning', type: 'traffic_drop',
          title: `Traffic drop: ${cleanUrl(page)}`,
          detail: `${pctDrop}% fewer clicks this week`,
          metric: 'Clicks', previous: formatNum(prev), current: formatNum(curr),
          estimatedImpact: `~${formatNum(Math.round((prev - curr) * 4))} clicks/mo lost`,
          page,
        })
      }
    }

    // 4. Disappeared queries
    const thisWeekQuerySet = new Set(queriesThisWeek.filter(q => q.clicks > 0).map(q => q.query))
    const lastWeekWithClicks = new Map<string, number>()
    for (const q of queriesLastWeek) {
      if (q.clicks > 0) lastWeekWithClicks.set(q.query, (lastWeekWithClicks.get(q.query) || 0) + q.clicks)
    }
    for (const [query, clicks] of lastWeekWithClicks) {
      if (!thisWeekQuerySet.has(query) && clicks >= 3) {
        result.push({
          id: `gone-${id++}`, severity: 'critical', type: 'disappeared',
          title: `Disappeared: "${query}"`,
          detail: `Had ${clicks} clicks last week, 0 this week`,
          metric: 'Clicks', previous: String(clicks), current: '0',
          query,
        })
      }
    }

    // Mark resolved alerts
    for (const alert of result) {
      const resolved = resolvedAlertIds[alert.id]
      if (resolved) {
        alert.resolved = true
        alert.resolvedAt = resolved.completed_at
        alert.resolvedAction = resolved.action
      }
    }

    // Sort: severity order, then resolved last within each group
    const order = { critical: 0, warning: 1, info: 2 }
    result.sort((a, b) => {
      // Resolved always after unresolved
      if (a.resolved && !b.resolved) return 1
      if (!a.resolved && b.resolved) return -1
      return order[a.severity] - order[b.severity]
    })
    return result
  }, [queries, pages, hasData, latestDate, weekAgo, twoWeeksAgo, queriesThisWeek, queriesLastWeek, resolvedAlertIds])

  /* ─── Health Score ─── */
  const healthScore = useMemo(() => {
    if (!hasData) return 0
    const latestKeywords = keywords.filter(k => k.date === latestDate)
    const kwInTop3 = latestKeywords.filter(k => k.position <= 3).length
    const kwTotal = latestKeywords.length || 1
    const kwScore = (kwInTop3 / kwTotal) * 40

    const latestQueries = queries.filter(q => q.date === latestDate && q.position <= 10)
    let ctrRatioSum = 0, ctrCount = 0
    for (const q of latestQueries) {
      const exp = expectedCtr(q.position)
      if (exp > 0) { ctrRatioSum += Math.min(q.ctr / exp, 1.5); ctrCount++ }
    }
    const avgCtrRatio = ctrCount > 0 ? ctrRatioSum / ctrCount : 0.5
    const ctrScore = Math.min(avgCtrRatio, 1) * 30

    const totalThisWeek = queriesThisWeek.reduce((s, q) => s + q.clicks, 0)
    const totalLastWeek = queriesLastWeek.reduce((s, q) => s + q.clicks, 0)
    let trendScore = 15
    if (totalLastWeek > 0) {
      const change = (totalThisWeek - totalLastWeek) / totalLastWeek
      trendScore = Math.max(0, Math.min(30, 15 + change * 100))
    }

    return Math.round(kwScore + ctrScore + trendScore)
  }, [hasData, keywords, queries, queriesThisWeek, queriesLastWeek, latestDate])

  /* ─── Money Keywords Table ─── */
  const keywordRows: KeywordRow[] = useMemo(() => {
    if (!keywords.length) return []
    const latestKw = new Map<string, SeoKeyword>()
    for (const k of keywords) {
      if (k.date === latestDate) latestKw.set(k.keyword, k)
    }
    const kwAvg: Record<string, { sum: number; count: number }> = {}
    for (const k of keywords) {
      if (k.date >= daysAgo(7)) {
        if (!kwAvg[k.keyword]) kwAvg[k.keyword] = { sum: 0, count: 0 }
        kwAvg[k.keyword].sum += k.position
        kwAvg[k.keyword].count++
      }
    }
    const qClicks: Record<string, { clicks: number; ctr: number; count: number }> = {}
    for (const q of queriesThisWeek) {
      const key = q.query.toLowerCase()
      if (!qClicks[key]) qClicks[key] = { clicks: 0, ctr: 0, count: 0 }
      qClicks[key].clicks += q.clicks
      qClicks[key].ctr += q.ctr
      qClicks[key].count++
    }

    const rows: KeywordRow[] = []
    for (const [kw, data] of latestKw) {
      const avg = kwAvg[kw]
      const avgPos = avg ? avg.sum / avg.count : data.position
      const change = avgPos - data.position
      const qData = qClicks[kw.toLowerCase()]
      let status: KeywordRow['status'] = 'top10'
      if (data.position <= 3) status = 'top3'
      else if (change < -2) status = 'declining'
      else if (data.position > 20) status = 'lost'

      rows.push({
        keyword: kw, currentPosition: data.position, avgPosition: avgPos, change,
        searchVolume: data.search_volume, clicks7d: qData?.clicks ?? 0,
        ctr: qData ? qData.ctr / qData.count : 0, status,
      })
    }
    return rows.sort((a, b) => b.searchVolume - a.searchVolume)
  }, [keywords, queriesThisWeek, latestDate])

  /* ─── Page Performance ─── */
  const pageRows: PageRow[] = useMemo(() => {
    if (!pages.length) return []
    const pagesThisWeek = pages.filter(p => p.date >= weekAgo)
    const pagesLastWeek = pages.filter(p => p.date >= twoWeeksAgo && p.date < weekAgo)
    const aggregate = (rows: GscPage[]) => {
      const m: Record<string, { clicks: number; impressions: number; posSum: number; ctrSum: number; count: number }> = {}
      for (const r of rows) {
        if (!m[r.page]) m[r.page] = { clicks: 0, impressions: 0, posSum: 0, ctrSum: 0, count: 0 }
        m[r.page].clicks += r.clicks
        m[r.page].impressions += r.impressions
        m[r.page].posSum += r.position
        m[r.page].ctrSum += r.ctr
        m[r.page].count++
      }
      return m
    }
    const tw = aggregate(pagesThisWeek)
    const lw = aggregate(pagesLastWeek)
    const sorted = Object.entries(tw).sort((a, b) => b[1].clicks - a[1].clicks).slice(0, 20)
    return sorted.map(([page, data]) => {
      const prev = lw[page]?.clicks ?? 0
      const pctChange = prev > 0 ? ((data.clicks - prev) / prev) * 100 : 0
      return { page, clicksThisWeek: data.clicks, clicksLastWeek: prev, pctChange, position: data.posSum / data.count, ctr: data.ctrSum / data.count, declining: pctChange < -10 }
    })
  }, [pages, weekAgo, twoWeeksAgo])

  const unresolvedAlerts = alerts.filter(a => !a.resolved)
  const resolvedAlerts = alerts.filter(a => a.resolved)
  const criticalCount = unresolvedAlerts.filter(a => a.severity === 'critical').length
  const warningCount = unresolvedAlerts.filter(a => a.severity === 'warning').length
  const infoCount = unresolvedAlerts.filter(a => a.severity === 'info').length
  const resolvedCount = resolvedAlerts.length
  const [alertFilter, setAlertFilter] = useState<string | null>(null)

  const filteredAlerts = useMemo(() => {
    let base = showResolved ? alerts : unresolvedAlerts
    if (!alertFilter) return base
    if (alertFilter === 'critical') return base.filter(a => a.severity === 'critical')
    if (alertFilter === 'warning') return base.filter(a => a.severity === 'warning')
    if (alertFilter === 'info') return base.filter(a => a.severity === 'info')
    if (alertFilter === 'resolved') return resolvedAlerts
    return base
  }, [alerts, unresolvedAlerts, resolvedAlerts, alertFilter, showResolved])

  /* ─── Render ─── */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-in" style={{ animationDelay: '0s', animationFillMode: 'both' }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert size={28} style={{ color: '#34D399' }} />
            Organic Health Monitor
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8C8C8C' }}>
            Protecting your organic revenue pipeline
            {lastSync && (
              <span className="ml-3">
                Last sync: {new Date(lastSync).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px]"
          style={{ background: '#34D39926', border: '1px solid #34D3994d', color: '#34D399' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Tiles */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-in" style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
          {[
            { key: 'critical', label: 'Critical', count: criticalCount, color: '#EF4444', borderColor: '#EF444466' },
            { key: 'warning', label: 'Opportunity', count: warningCount, color: '#F59E0B', borderColor: '#F59E0B66' },
            { key: 'info', label: 'Info', count: infoCount, color: '#6699ff', borderColor: '#3b82f666' },
            { key: 'resolved', label: 'Resolved', count: resolvedCount, color: '#34D399', borderColor: '#34D39966' },
            { key: null as string | null, label: 'All Active', count: unresolvedAlerts.length, color: '#fff', borderColor: '#404040' },
          ].map((tile, idx) => {
            const active = alertFilter === tile.key
            return (
              <button
                key={idx}
                onClick={() => {
                  if (tile.key === 'resolved') {
                    setShowResolved(true)
                    setAlertFilter('resolved')
                  } else {
                    setShowResolved(false)
                    setAlertFilter(active ? null : tile.key)
                  }
                }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  padding: '14px 16px', borderRadius: 14, minHeight: 44,
                  background: active ? `${tile.color}12` : '#2A2A2A',
                  border: `1.5px solid ${active ? tile.borderColor : '#2A2A2A'}`,
                  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: tile.count > 0 ? tile.color : '#383838', lineHeight: 1 }}>
                  {tile.count}
                </span>
                <span style={{ fontSize: '0.8rem', color: active ? tile.color : '#8A8A8A', fontWeight: 500 }}>
                  {tile.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!hasData && !loading && (
        <div className="glass-card-static text-center py-16 animate-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <Activity size={48} className="mx-auto mb-4" style={{ color: '#404040' }} />
          <h2 className="text-xl font-semibold mb-2">Syncing data...</h2>
          <p style={{ color: '#8C8C8C' }}>Run a GSC sync to populate alerts and monitoring data.</p>
        </div>
      )}

      {/* Top Row: Health Score + Alerts */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Score */}
          <div className="glass-card-static animate-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#9A9A9A' }}>
              <ShieldCheck size={16} /> HEALTH SCORE
            </h2>
            <HealthGauge score={healthScore} />
            <div className="grid grid-cols-3 gap-3 mt-6 text-center text-xs" style={{ color: '#8C8C8C' }}>
              <div>
                <div className="text-lg font-bold" style={{ color: '#f0fdf4' }}>
                  {keywordRows.filter(k => k.currentPosition <= 3).length}
                </div>
                Keywords in Top 3
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: '#f0fdf4' }}>
                  {formatNum(queriesThisWeek.reduce((s, q) => s + q.clicks, 0))}
                </div>
                Clicks (7d)
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: '#f0fdf4' }}>
                  {unresolvedAlerts.length}
                </div>
                Active Alerts
              </div>
            </div>
          </div>

          {/* Active Alerts Feed */}
          <div className="lg:col-span-2 glass-card-static animate-in" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#9A9A9A' }}>
                <AlertTriangle size={16} />
                {alertFilter === 'resolved' ? 'RESOLVED ALERTS' : 'ACTIVE ALERTS'}
              </h2>
              {resolvedCount > 0 && alertFilter !== 'resolved' && (
                <button
                  onClick={() => { setShowResolved(true); setAlertFilter('resolved') }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: '#34D3991a', color: '#34D399', border: '1px solid #34D39933' }}
                >
                  <Archive size={12} /> {resolvedCount} resolved
                </button>
              )}
            </div>

            {/* Severity Group Headers */}
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#8A8A8A' }}>
                <ShieldCheck size={32} className="mx-auto mb-2" style={{ color: '#34D399' }} />
                <p>All clear {alertFilter === 'resolved' ? '-- no resolved alerts' : '-- no alerts detected'}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {/* Group by severity with headers */}
                {(['critical', 'warning', 'info'] as const).map(severity => {
                  const groupAlerts = filteredAlerts.filter(a => a.severity === severity)
                  if (groupAlerts.length === 0) return null
                  const groupCfg = {
                    critical: { label: 'Critical', color: '#EF4444', Icon: AlertTriangle },
                    warning: { label: 'Warnings & Opportunities', color: '#F59E0B', Icon: AlertCircle },
                    info: { label: 'Informational', color: '#34D399', Icon: Info },
                  }[severity]

                  return (
                    <div key={severity}>
                      <div className="flex items-center gap-2 mb-2 mt-1" style={{ color: groupCfg.color }}>
                        <groupCfg.Icon size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">{groupCfg.label}</span>
                        <span className="text-xs font-medium" style={{ color: '#606060' }}>({groupAlerts.length})</span>
                        <div className="flex-1 h-px" style={{ background: `${groupCfg.color}22` }} />
                      </div>
                      <div className="space-y-2 mb-4">
                        {groupAlerts.slice(0, 15).map((alert) => (
                          <div
                            key={alert.id}
                            className="rounded-xl p-3 flex items-start gap-3"
                            style={{
                              background: alert.resolved ? '#34D39908' : '#2A2A2A',
                              border: `1px solid ${alert.resolved ? '#34D3991a' : '#2A2A2A'}`,
                              opacity: alert.resolved ? 0.7 : 1,
                            }}
                          >
                            <div className="mt-0.5">
                              {alert.resolved ? (
                                <ResolvedBadge action={alert.resolvedAction || 'action'} resolvedAt={alert.resolvedAt || ''} />
                              ) : (
                                <SeverityBadge severity={alert.severity} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate" style={{ textDecoration: alert.resolved ? 'line-through' : 'none', opacity: alert.resolved ? 0.6 : 1 }}>
                                {alert.title}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: '#8C8C8C' }}>
                                {alert.detail}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: '#8A8A8A' }}>
                                <span>{alert.metric}: <span style={{ color: '#9A9A9A' }}>{alert.previous}</span> → <span className="font-medium" style={{ color: alert.severity === 'critical' ? '#f87171' : '#F59E0B' }}>{alert.current}</span></span>
                                {alert.estimatedImpact && (
                                  <span style={{ color: '#f87171' }}>
                                    <Zap size={10} className="inline mr-0.5" style={{ verticalAlign: '-1px' }} />
                                    {alert.estimatedImpact}
                                  </span>
                                )}
                              </div>
                              {/* Action buttons — only for unresolved */}
                              {!alert.resolved && (
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                  <button
                                    onClick={() => { setAction(alert.id, 'ignore'); setTimeout(() => handleSave({ ...alert }), 50) }}
                                    disabled={saving[alert.id]}
                                    style={{
                                      padding: '8px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                                      cursor: 'pointer', minHeight: 36, transition: 'all 0.15s ease',
                                      border: '1.5px solid #ffffff', background: 'transparent', color: '#ffffff',
                                    }}
                                  >
                                    Ignore
                                  </button>
                                  <button
                                    onClick={() => { setAction(alert.id, 'recommended_fix' as AlertAction); handleRecommendedFix(alert) }}
                                    disabled={saving[alert.id]}
                                    style={{
                                      padding: '8px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                                      cursor: 'pointer', minHeight: 36, transition: 'all 0.15s ease',
                                      border: 'none', background: '#34D399', color: '#fff',
                                    }}
                                  >
                                    {saving[alert.id] ? 'Analyzing...' : 'Recommended Fix'}
                                  </button>
                                </div>
                              )}
                              {/* Result panel */}
                              {results[alert.id] && (
                                <div className="mt-3 rounded-xl text-xs overflow-hidden" style={{ border: '1px solid #34D39926' }}>
                                  <div className="px-4 py-2.5 font-semibold text-white flex items-center gap-2" style={{ background: '#2A2A2A' }}>
                                    {results[alert.id].heading || 'Result'}
                                  </div>
                                  <div className="p-4" style={{ background: '#1A1A1A' }}>
                                    {results[alert.id].error ? (
                                      <div style={{ color: '#f87171' }}>Error: {results[alert.id].error}</div>
                                    ) : results[alert.id].status === 'dismissed' ? (
                                      <div style={{ color: '#9A9A9A' }}>{results[alert.id].message}</div>
                                    ) : results[alert.id].tasks ? (
                                      <div className="space-y-3">
                                        {results[alert.id].tasks.map((task: any, i: number) => (
                                          <div key={i} className="flex gap-3">
                                            <div className="shrink-0 mt-0.5">
                                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{
                                                background: task.priority === 'high' ? '#EF444426' : task.priority === 'medium' ? '#F59E0B26' : '#333333',
                                                color: task.priority === 'high' ? '#f87171' : task.priority === 'medium' ? '#F59E0B' : '#8C8C8C',
                                              }}>
                                                {i + 1}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="font-semibold text-white">{task.title}</div>
                                              <div className="mt-0.5" style={{ color: '#9A9A9A', lineHeight: 1.6 }}>{task.detail}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : results[alert.id].sections ? (
                                      <div className="space-y-4">
                                        {results[alert.id].sections.map((sec: any, i: number) => (
                                          <div key={i}>
                                            <div className="font-semibold text-white mb-2" style={{ color: '#34D399' }}>{sec.title}</div>
                                            <div className="space-y-1.5">
                                              {sec.items.map((item: string, j: number) => (
                                                <div key={j} className="flex gap-2" style={{ color: '#B0B0B0', lineHeight: 1.5 }}>
                                                  <span style={{ color: '#34D399', flexShrink: 0 }}>&rarr;</span>
                                                  <span>{item}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : results[alert.id].changes ? (
                                      <div>
                                        {results[alert.id].changes.length > 0 && (
                                          <div className="space-y-3 mb-4">
                                            {results[alert.id].changes.map((ch: any, i: number) => (
                                              <div key={i} className="p-3 rounded-lg" style={{ background: '#1A1A1A' }}>
                                                <div className="font-bold mb-2" style={{ color: '#F59E0B', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ch.field}</div>
                                                <div className="p-2 rounded mb-1" style={{ background: '#34D39915', border: '1px solid #34D39926', color: '#34D399', lineHeight: 1.6 }}>
                                                  {ch.suggestion}
                                                </div>
                                                <div style={{ color: '#707070', fontStyle: 'italic', marginTop: 4 }}>{ch.reasoning}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {results[alert.id].steps && (
                                          <div>
                                            <div className="font-semibold text-white mb-2">Steps to implement:</div>
                                            <div className="space-y-1.5">
                                              {results[alert.id].steps.map((step: string, i: number) => (
                                                <div key={i} className="flex gap-2" style={{ color: '#9A9A9A' }}>
                                                  <span className="font-bold" style={{ color: '#4A4A4A', minWidth: 16 }}>{i + 1}.</span>
                                                  <span>{step}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ color: '#8C8C8C' }}>{results[alert.id].message || 'Action completed.'}</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommended Fix Modal */}
      {fixModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setFixModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{ position: 'relative', width: '90%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', background: '#1A1A1A', border: '1px solid #383838', borderRadius: 16, padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #333333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: 0 }}>Recommended Fix</h3>
                <p style={{ fontSize: '0.78rem', color: '#8C8C8C', margin: '4px 0 0' }}>{fixModal.alert.title}</p>
              </div>
              <button onClick={() => setFixModal(null)} style={{ background: '#383838', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
            </div>
            {/* Content */}
            <div style={{ padding: '20px 24px' }}>
              {fixModal.loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: 32, height: 32, border: '2px solid #34D399', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#8C8C8C' }}>Generating analysis...</p>
                </div>
              ) : fixModal.result?.error ? (
                <p style={{ color: '#f87171' }}>Error: {fixModal.result.error}</p>
              ) : fixModal.result?.recommendation ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34D399', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Problem Summary</h4>
                    <p style={{ fontSize: '0.85rem', color: '#CECECE', lineHeight: 1.6 }}>{fixModal.result.recommendation.summary}</p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F59E0B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Root Cause</h4>
                    <p style={{ fontSize: '0.85rem', color: '#CECECE', lineHeight: 1.6 }}>{fixModal.result.recommendation.rootCause}</p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended Fix</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {fixModal.result.recommendation.steps?.map((step: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.85rem', color: '#CECECE' }}>
                          <span style={{ color: '#34D399', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#2A2A2A' }}>
                      <div style={{ fontSize: '0.7rem', color: '#8C8C8C', marginBottom: 4 }}>Priority</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: fixModal.result.recommendation.priority === 'high' ? '#EF4444' : fixModal.result.recommendation.priority === 'medium' ? '#F59E0B' : '#34D399' }}>
                        {fixModal.result.recommendation.priority?.charAt(0).toUpperCase() + fixModal.result.recommendation.priority?.slice(1)}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#2A2A2A' }}>
                      <div style={{ fontSize: '0.7rem', color: '#8C8C8C', marginBottom: 4 }}>Estimated Impact</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34D399' }}>{fixModal.result.recommendation.impact}</div>
                    </div>
                  </div>
                </div>
              ) : fixModal.result?.tasks ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fixModal.result.tasks.map((task: any, i: number) => (
                    <div key={i} style={{ padding: '12px', borderRadius: 10, background: '#2A2A2A' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: 4 }}>{task.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9A9A9A', lineHeight: 1.5 }}>{task.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#8C8C8C' }}>{fixModal.result?.message || 'Analysis complete.'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Money Keywords Tracker */}
      {hasData && (
        <div className="glass-card-static animate-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#9A9A9A' }}>
            <Target size={16} /> MONEY KEYWORDS TRACKER
          </h2>
          {keywordRows.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#8A8A8A' }}>
              <Search size={32} className="mx-auto mb-2" />
              <p>No keyword data yet. Run an SEO keyword sync to populate this table.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: '#8A8A8A' }}>
                    <th className="text-left py-2 pr-4 font-medium">Keyword</th>
                    <th className="text-right py-2 px-3 font-medium">Position</th>
                    <th className="text-right py-2 px-3 font-medium">7d Avg</th>
                    <th className="text-right py-2 px-3 font-medium">Change</th>
                    <th className="text-right py-2 px-3 font-medium">Vol.</th>
                    <th className="text-right py-2 px-3 font-medium">Clicks (7d)</th>
                    <th className="text-right py-2 px-3 font-medium">CTR</th>
                    <th className="text-center py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordRows.slice(0, 30).map((row) => (
                    <tr key={row.keyword} className="border-t" style={{ borderColor: '#333333' }}>
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[260px]">{row.keyword}</td>
                      <td className="text-right py-2.5 px-3 font-mono">
                        <span style={{ color: row.currentPosition <= 3 ? '#34D399' : row.currentPosition <= 10 ? '#f0fdf4' : '#F59E0B' }}>
                          {row.currentPosition.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono" style={{ color: '#8C8C8C' }}>{row.avgPosition.toFixed(1)}</td>
                      <td className="text-right py-2.5 px-3">
                        {row.change > 0.1 ? (
                          <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: '#34D399' }}>&#9650; {row.change.toFixed(1)}</span>
                        ) : row.change < -0.1 ? (
                          <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: '#f87171' }}>&#9660; {Math.abs(row.change).toFixed(1)}</span>
                        ) : (
                          <span style={{ color: '#606060' }}>&mdash;</span>
                        )}
                      </td>
                      <td className="text-right py-2.5 px-3" style={{ color: '#9A9A9A' }}>{formatNum(row.searchVolume)}</td>
                      <td className="text-right py-2.5 px-3 font-mono">{formatNum(row.clicks7d)}</td>
                      <td className="text-right py-2.5 px-3" style={{ color: '#9A9A9A' }}>{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="text-center py-2.5 pl-3">
                        {{
                          top3: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#34D39926', color: '#34D399' }}>Top 3</span>,
                          top10: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#333333', color: '#9A9A9A' }}>Top 10</span>,
                          declining: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#F59E0B26', color: '#F59E0B' }}>Declining</span>,
                          lost: <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#EF444426', color: '#f87171' }}>Lost</span>,
                        }[row.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Page Performance Monitor */}
      {hasData && (
        <div className="glass-card-static animate-in" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#9A9A9A' }}>
            <FileText size={16} /> PAGE PERFORMANCE MONITOR
          </h2>
          {pageRows.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#8A8A8A' }}>
              <FileText size={32} className="mx-auto mb-2" />
              <p>No page data yet. Run a GSC sync to populate page performance.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: '#8A8A8A' }}>
                    <th className="text-left py-2 pr-4 font-medium">Page</th>
                    <th className="text-right py-2 px-3 font-medium">Clicks (7d)</th>
                    <th className="text-right py-2 px-3 font-medium">vs Last Week</th>
                    <th className="text-right py-2 px-3 font-medium">Position</th>
                    <th className="text-right py-2 px-3 font-medium">CTR</th>
                    <th className="text-center py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.page} className="border-t" style={{ borderColor: '#333333' }}>
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[300px]">
                        <span title={row.page}>{cleanUrl(row.page)}</span>
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono">{formatNum(row.clicksThisWeek)}</td>
                      <td className="text-right py-2.5 px-3">
                        {row.pctChange > 1 ? (
                          <span className="inline-flex items-center gap-1" style={{ color: '#34D399' }}>
                            <ArrowUpRight size={14} /> +{row.pctChange.toFixed(0)}%
                          </span>
                        ) : row.pctChange < -1 ? (
                          <span className="inline-flex items-center gap-1" style={{ color: '#f87171' }}>
                            <ArrowDownRight size={14} /> {row.pctChange.toFixed(0)}%
                          </span>
                        ) : (
                          <span style={{ color: '#606060' }}>&mdash;</span>
                        )}
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono" style={{ color: '#9A9A9A' }}>{row.position.toFixed(1)}</td>
                      <td className="text-right py-2.5 px-3" style={{ color: '#9A9A9A' }}>{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="text-center py-2.5 pl-3">
                        {row.declining ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#EF444426', color: '#f87171' }}>Declining</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#34D3991a', color: '#34D399' }}>Stable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
