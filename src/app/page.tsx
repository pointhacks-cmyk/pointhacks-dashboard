'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  MousePointerClick, Eye, Target, Search, TrendingUp, TrendingDown,
  Globe, FileText, BarChart3, PieChart as PieIcon, Lightbulb, Layers,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from 'recharts'

const NAVY = '#6366f1', TEAL = '#34D399', RED = '#EF4444', GOLD = '#F59E0B', PURPLE = '#8B5CF6'
const CHART_COLORS = [TEAL, NAVY, PURPLE, GOLD, RED, '#ff6b9d', '#66aaff']
const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString()
const fmtFull = (n: number) => n.toLocaleString()

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

interface KPIs { total_clicks: number; total_impressions: number; avg_ctr: number; avg_position: number; unique_queries: number; top3_count: number; top10_count: number }
interface DailyRow { date: string; sessions?: number; active_users?: number; screenPageViews?: number; screen_page_views?: number; totalUsers?: number; total_users?: number; clicks?: number; impressions?: number }
interface TrafficRow { source: string; medium: string; sessions: number }
interface GA4Page { page_path?: string; page?: string; screenPageViews?: number; screen_page_views?: number; sessions?: number; clicks?: number; impressions?: number }
interface CTRByPos { position_bucket: string; avg_ctr: number; query_count: number }
interface PageKPI { page: string; clicks: number; impressions: number; avg_ctr: number; avg_position: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card-static" style={{ padding: '10px 14px', fontSize: 12, border: '1px solid #383838' }}>
      <div className="text-secondary mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white font-semibold">{fmtFull(p.value)}</span>
          <span className="text-secondary">{p.dataKey}</span>
        </div>
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [traffic, setTraffic] = useState<TrafficRow[]>([])
  const [ga4Pages, setGa4Pages] = useState<GA4Page[]>([])
  const [ctrByPos, setCtrByPos] = useState<CTRByPos[]>([])
  const [pageKpis, setPageKpis] = useState<PageKPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [kRes, dailyRes, tRes, pagesRes, ctrRes, pkRes] = await Promise.all([
          supabase.rpc('gsc_kpis'),
          supabase.from('ga4_daily').select('*').order('date', { ascending: true }).limit(28),
          supabase.from('ga4_traffic_sources').select('source,medium,sessions'),
          supabase.from('ga4_pages').select('*').order('screen_page_views', { ascending: false }).limit(20),
          supabase.rpc('gsc_ctr_by_position'),
          supabase.rpc('gsc_page_kpis'),
        ])
        if (kRes.data?.[0]) setKpis(kRes.data[0])
        setDaily((dailyRes.data as DailyRow[]) || [])
        setTraffic((tRes.data as TrafficRow[]) || [])
        setGa4Pages((pagesRes.data as GA4Page[]) || [])
        setCtrByPos((ctrRes.data as CTRByPos[]) || [])
        // gsc_page_kpis may return array of pages or single summary
        if (Array.isArray(pkRes.data)) setPageKpis(pkRes.data)
      } catch (e) {
        // silently handle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Derived data
  const k = kpis || { total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, unique_queries: 0, top3_count: 0, top10_count: 0 }

  const dailyChart = useMemo(() => daily.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    sessions: d.sessions || 0,
    pageViews: d.screenPageViews || d.screen_page_views || 0,
  })), [daily])

  const channelAgg = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of traffic) {
      const channel = (t.medium || '').toLowerCase().includes('organic') ? 'Organic Search'
        : (t.medium || '') === '(none)' || (t.medium || '') === 'direct' ? 'Direct'
        : (t.medium || '').includes('social') || ['facebook', 'instagram', 'youtube', 'twitter', 't.co'].some(s => (t.source || '').includes(s)) ? 'Social'
        : (t.medium || '').includes('referral') ? 'Referral'
        : (t.medium || '').includes('email') ? 'Email'
        : (t.medium || '').includes('cpc') || (t.medium || '').includes('paid') ? 'Paid'
        : 'Other'
      map.set(channel, (map.get(channel) || 0) + (t.sessions || 0))
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [traffic])

  const totalSessions = channelAgg.reduce((s, c) => s + c.value, 0)

  const topPages = useMemo(() => {
    return ga4Pages
      .map(p => ({
        page: p.page_path || p.page || '',
        views: p.screenPageViews || p.screen_page_views || p.sessions || 0,
      }))
      .filter(p => p.page)
      .slice(0, 10)
  }, [ga4Pages])

  const maxPageViews = topPages[0]?.views || 1

  // Position distribution from page KPIs
  const positionDist = useMemo(() => {
    const buckets = { '1-3': 0, '4-10': 0, '11-20': 0, '20+': 0 }
    const source = pageKpis.length ? pageKpis : []
    for (const p of source) {
      const pos = p.avg_position
      if (pos <= 3) buckets['1-3']++
      else if (pos <= 10) buckets['4-10']++
      else if (pos <= 20) buckets['11-20']++
      else buckets['20+']++
    }
    return [{ name: 'Position Distribution', ...buckets }]
  }, [pageKpis])

  // CTR by position chart data
  const ctrChart = useMemo(() => ctrByPos.map(c => ({
    bucket: c.position_bucket,
    ctr: +(c.avg_ctr * 100).toFixed(2),
    queries: c.query_count,
  })), [ctrByPos])

  // Quick insights
  const insights = useMemo(() => {
    const items: { title: string; detail: string; color: string; icon: any }[] = []
    if (k.top3_count > 0) {
      const pct = k.unique_queries > 0 ? ((k.top3_count / k.unique_queries) * 100).toFixed(1) : '0'
      items.push({
        title: `${fmtFull(k.top3_count)} queries in top 3`,
        detail: `${pct}% of all tracked queries rank in the top 3 positions`,
        color: TEAL, icon: TrendingUp,
      })
    }
    const mid = pageKpis.filter(p => p.avg_position > 4 && p.avg_position <= 10).length
    if (mid > 0) {
      items.push({
        title: `${mid} pages in position 4-10`,
        detail: 'These are prime optimization targets — close to page 1 top spots',
        color: GOLD, icon: Lightbulb,
      })
    }
    if (channelAgg.length > 0) {
      const top = channelAgg[0]
      const pct = totalSessions > 0 ? ((top.value / totalSessions) * 100).toFixed(0) : '0'
      items.push({
        title: `${top.name} drives ${pct}% of traffic`,
        detail: `${fmtFull(top.value)} sessions from your dominant traffic source`,
        color: NAVY, icon: Globe,
      })
    }
    if (k.avg_ctr > 0) {
      const ctr = (k.avg_ctr * 100)
      const verdict = ctr > 5 ? 'Above average' : ctr > 3 ? 'Healthy' : 'Room to improve'
      items.push({
        title: `${ctr.toFixed(1)}% average CTR — ${verdict}`,
        detail: 'Improve title tags and meta descriptions on underperforming pages',
        color: PURPLE, icon: Target,
      })
    }
    return items.slice(0, 4)
  }, [k, pageKpis, channelAgg, totalSessions])

  function cleanUrl(url: string) { return url.replace(/https?:\/\/(www\.)?pointhacks\.com\.au/, '').replace(/\/$/, '') || '/' }
  function pageName(url: string) {
    const path = cleanUrl(url)
    if (path === '/') return 'Homepage'
    return path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || path
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-xl h-32" />)}
        </div>
        <div className="skeleton rounded-xl h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 className="text-2xl font-bold text-white">{getGreeting()}</h1>
        <p className="text-secondary">Point Hacks analytics overview · Last 28 days</p>
      </div>

      {/* 1. Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clicks', value: fmt(k.total_clicks), full: fmtFull(k.total_clicks), icon: MousePointerClick, color: TEAL, bg: `${TEAL}12` },
          { label: 'Impressions', value: fmt(k.total_impressions), full: fmtFull(k.total_impressions), icon: Eye, color: NAVY, bg: `${NAVY}20` },
          { label: 'Avg CTR', value: `${(k.avg_ctr * 100).toFixed(1)}%`, full: `${(k.avg_ctr * 100).toFixed(2)}%`, icon: Target, color: PURPLE, bg: `${PURPLE}15` },
          { label: 'Avg Position', value: k.avg_position.toFixed(1), full: k.avg_position.toFixed(2), icon: Search, color: GOLD, bg: `${GOLD}15` },
        ].map((item, i) => (
          <div key={item.label} className="glass-card p-5 animate-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] text-secondary uppercase tracking-wider font-medium">{item.label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: item.bg }}>
                <item.icon size={18} style={{ color: item.color }} />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">{item.value}</div>
            <div className="text-[10px] mt-1.5 text-secondary">{item.full}</div>
          </div>
        ))}
      </div>

      {/* 2. Traffic Trend Chart */}
      {dailyChart.length > 0 && (
        <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <TrendingUp size={16} style={{ color: TEAL }} /> Traffic Trend
          </h2>
          <p className="text-xs text-secondary mb-4">Daily sessions and page views · Last 28 days</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPageViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
              <XAxis dataKey="date" tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sessions" stroke={TEAL} strokeWidth={2} fill="url(#gradSessions)" />
              <Area type="monotone" dataKey="pageViews" stroke={PURPLE} strokeWidth={2} fill="url(#gradPageViews)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Traffic Sources Donut */}
        {channelAgg.length > 0 && (
          <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '310ms', animationFillMode: 'both' }}>
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <PieIcon size={16} style={{ color: PURPLE }} /> Traffic Sources
            </h2>
            <p className="text-xs text-secondary mb-4">{fmtFull(totalSessions)} total sessions</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={channelAgg}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {channelAgg.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {channelAgg.map((c, i) => {
                  const pct = totalSessions > 0 ? (c.value / totalSessions * 100).toFixed(1) : '0'
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-white flex-1">{c.name}</span>
                      <span className="text-xs font-semibold text-secondary">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. Top Pages */}
        <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '370ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FileText size={16} style={{ color: TEAL }} /> Top Pages
          </h2>
          <div className="space-y-2.5">
            {topPages.map((p, i) => (
              <div key={p.page} className="flex items-center gap-3">
                <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? GOLD : '#4A4A4A' }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{pageName(p.page)}</div>
                  <div className="text-[10px] truncate" style={{ opacity: 0.3 }}>{cleanUrl(p.page)}</div>
                </div>
                <div className="w-20 h-2 rounded-full overflow-hidden shrink-0" style={{ background: '#2A2A2A' }}>
                  <div className="h-full rounded-full" style={{ width: `${(p.views / maxPageViews) * 100}%`, background: TEAL }} />
                </div>
                <span className="text-sm font-bold text-white w-16 text-right">{fmt(p.views)}</span>
              </div>
            ))}
            {topPages.length === 0 && <p className="text-xs text-secondary">No page data available</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5. Position Distribution */}
        {(positionDist[0]['1-3'] > 0 || positionDist[0]['4-10'] > 0) && (
          <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '430ms', animationFillMode: 'both' }}>
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Layers size={16} style={{ color: GOLD }} /> Position Distribution
            </h2>
            <p className="text-xs text-secondary mb-4">Pages by ranking position bucket</p>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={positionDist} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="1-3" stackId="a" fill={TEAL} radius={[4, 0, 0, 4]} />
                <Bar dataKey="4-10" stackId="a" fill={NAVY} />
                <Bar dataKey="11-20" stackId="a" fill={GOLD} />
                <Bar dataKey="20+" stackId="a" fill={RED} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3">
              {[
                { label: '1-3', color: TEAL, count: positionDist[0]['1-3'] },
                { label: '4-10', color: NAVY, count: positionDist[0]['4-10'] },
                { label: '11-20', color: GOLD, count: positionDist[0]['11-20'] },
                { label: '20+', color: RED, count: positionDist[0]['20+'] },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                  <span className="text-xs text-secondary">{b.label}</span>
                  <span className="text-xs font-semibold text-white">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. CTR by Position */}
        {ctrChart.length > 0 && (
          <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '490ms', animationFillMode: 'both' }}>
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <BarChart3 size={16} style={{ color: TEAL }} /> CTR by Position
            </h2>
            <p className="text-xs text-secondary mb-4">Average click-through rate per position bucket</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ctrChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis dataKey="bucket" tick={{ fill: '#8C8C8C', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ctr" radius={[6, 6, 0, 0]}>
                  {ctrChart.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 7. Quick Insights */}
      {insights.length > 0 && (
        <div className="animate-in" style={{ animationDelay: '550ms', animationFillMode: 'both' }}>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lightbulb size={16} style={{ color: GOLD }} /> Quick Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {insights.map((ins, i) => (
              <div key={i} className="glass-card p-4" style={{ borderLeft: `3px solid ${ins.color}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <ins.icon size={14} style={{ color: ins.color }} />
                  <span className="text-sm font-semibold text-white">{ins.title}</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">{ins.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-secondary animate-in" style={{ animationDelay: '610ms', animationFillMode: 'both' }}>
        Data: Google Search Console + GA4 · Last synced: {new Date().toLocaleDateString('en-AU')}
      </div>
    </div>
  )
}
