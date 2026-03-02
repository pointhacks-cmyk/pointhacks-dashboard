'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FileText, TrendingDown, Search, ExternalLink, ArrowUpDown,
  AlertTriangle, Filter, LayoutGrid, List, Plug, FolderOpen,
  PenLine, Eye, CheckCircle2, Clock, ChevronRight
} from 'lucide-react'

interface PageData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  date: string
}

type ContentStatus = 'draft' | 'review' | 'published'

interface ContentItem {
  url: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  lowCtr: boolean
  declining: boolean
  prevClicks: number | null
  urgency: number
  status: ContentStatus
}

function expectedCtr(pos: number): number {
  if (pos <= 1) return 0.30
  if (pos <= 2) return 0.18
  if (pos <= 3) return 0.12
  if (pos <= 5) return 0.06
  if (pos <= 10) return 0.03
  return 0.01
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function cleanUrl(url: string): string {
  return url.replace('https://www.pointhacks.com.au', '').replace('https://pointhacks.com.au', '') || '/'
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: ContentStatus }) {
  const cfg = {
    draft: { bg: '#8B5CF626', border: '#8B5CF64d', color: '#a78bfa', label: 'Draft', Icon: PenLine },
    review: { bg: '#F59E0B20', border: '#F59E0B40', color: '#F59E0B', label: 'Review', Icon: Eye },
    published: { bg: '#34D39920', border: '#34D39940', color: '#34D399', label: 'Published', Icon: CheckCircle2 },
  }[status]

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}

/* ─── Flag Badge ─── */
function FlagBadge({ type }: { type: 'declining' | 'lowCtr' }) {
  const cfg = type === 'declining'
    ? { bg: '#EF444420', color: '#f87171', label: 'Declining', Icon: TrendingDown }
    : { bg: '#F59E0B20', color: '#F59E0B', label: 'Low CTR', Icon: AlertTriangle }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'urgency' | 'clicks' | 'position'>('urgency')
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [cmsConnected] = useState(false) // Will be true when CMS integration exists

  useEffect(() => {
    async function load() {
      try {
        const { data, error: dbError } = await supabase
          .from('gsc_pages')
          .select('page, clicks, impressions, ctr, position, date')
          .order('date', { ascending: false })

        if (dbError) throw dbError
        if (!data || data.length === 0) {
          setItems([])
          setLoading(false)
          return
        }

        const pageMap = new Map<string, PageData[]>()
        ;(data as PageData[]).forEach((row) => {
          const existing = pageMap.get(row.page) || []
          existing.push(row)
          pageMap.set(row.page, existing)
        })

        const allDates = [...new Set((data as PageData[]).map((d) => d.date))].sort().reverse()
        const latestDate = allDates[0]
        const prevDate = allDates[1] || null

        const results: ContentItem[] = []

        pageMap.forEach((rows, url) => {
          const latest = rows.find((r) => r.date === latestDate)
          const prev = prevDate ? rows.find((r) => r.date === prevDate) : null
          if (!latest) return

          const ctr = latest.ctr
          const pos = latest.position
          const lowCtr = ctr < expectedCtr(pos) * 0.6
          const declining = prev ? latest.clicks < prev.clicks * 0.8 : false
          const prevClicks = prev ? prev.clicks : null

          let urgency = 0
          if (declining) urgency += latest.clicks * 2
          if (lowCtr) urgency += latest.impressions * 0.5

          // Infer status from signals
          let status: ContentStatus = 'published'
          if (latest.impressions === 0 && latest.clicks === 0) status = 'draft'
          else if (lowCtr && declining) status = 'review'

          results.push({ url, clicks: latest.clicks, impressions: latest.impressions, ctr, position: pos, lowCtr, declining, prevClicks, urgency, status })
        })

        const flagged = results.filter((r) => r.lowCtr || r.declining || r.clicks > 10)
        flagged.sort((a, b) => b.urgency - a.urgency)
        setItems(flagged)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sorted = useMemo(() => {
    let filtered = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'urgency') return b.urgency - a.urgency
      if (sortBy === 'clicks') return b.clicks - a.clicks
      return a.position - b.position
    })
  }, [items, sortBy, statusFilter])

  const decliningCount = items.filter(i => i.declining).length
  const lowCtrCount = items.filter(i => i.lowCtr).length
  const statusCounts = {
    draft: items.filter(i => i.status === 'draft').length,
    review: items.filter(i => i.status === 'review').length,
    published: items.filter(i => i.status === 'published').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={28} style={{ color: '#34D399' }} />
          Content Optimization Queue
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8C8C8C' }}>
          Pages that need content attention -- prioritised by real GSC data
        </p>
      </div>

      {loading && (
        <div className="glass-card-static text-center py-16 animate-in" style={{ animationFillMode: 'both' }}>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-3 animate-spin" style={{ borderColor: '#34D399', borderTopColor: 'transparent' }} />
          <p style={{ color: '#8C8C8C' }}>Loading GSC page data...</p>
        </div>
      )}

      {error && (
        <div className="glass-card-static animate-in" style={{ borderLeft: '3px solid #EF4444', animationFillMode: 'both' }}>
          <p style={{ color: '#f87171' }}>Error: {error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && !cmsConnected && (
        <div className="glass-card-static text-center py-16 animate-in" style={{ animationFillMode: 'both' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#34D3991a', border: '1px solid #34D39933' }}>
            <Plug size={32} style={{ color: '#34D399' }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Your CMS</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#8C8C8C' }}>
            Connect your CMS to manage content status, track editorial workflows, and sync publish dates automatically.
          </p>
          <div className="flex justify-center gap-3">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
              style={{ background: '#34D399', color: '#fff' }}
            >
              <Plug size={16} /> Connect CMS <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs mt-6" style={{ color: '#606060' }}>
            Supports WordPress, Ghost, and custom CMS via API
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-in" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            <div className="glass-card-static p-4">
              <p className="text-xs mb-1" style={{ color: '#8A8A8A' }}>Pages Analyzed</p>
              <p className="text-2xl font-bold text-white">{items.length}</p>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={13} style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#8A8A8A' }}>Declining</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#f87171' }}>{decliningCount}</p>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: '#8A8A8A' }}>Low CTR</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{lowCtrCount}</p>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Eye size={13} style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: '#8A8A8A' }}>Needs Review</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{statusCounts.review}</p>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={13} style={{ color: '#34D399' }} />
                <p className="text-xs" style={{ color: '#8A8A8A' }}>Published</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#34D399' }}>{statusCounts.published}</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3 animate-in" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
            {/* Status filter pills */}
            <div className="flex items-center gap-1.5">
              <Filter size={13} style={{ color: '#707070' }} />
              {(['all', 'draft', 'review', 'published'] as const).map(s => {
                const active = statusFilter === s
                const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium min-h-[32px]"
                    style={{
                      background: active ? '#34D39926' : 'transparent',
                      border: `1px solid ${active ? '#34D3994d' : '#333333'}`,
                      color: active ? '#34D399' : '#8A8A8A',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="flex-1" />

            {/* Sort controls */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={13} style={{ color: '#707070' }} />
              {(['urgency', 'clicks', 'position'] as const).map(s => {
                const active = sortBy === s
                return (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium min-h-[32px]"
                    style={{
                      background: active ? '#6366f130' : 'transparent',
                      border: `1px solid ${active ? '#6366f140' : '#333333'}`,
                      color: active ? '#6699ff' : '#8A8A8A',
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content Table */}
          <div className="glass-card-static overflow-hidden animate-in" style={{ animationDelay: '160ms', animationFillMode: 'both', padding: 0 }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #333333' }}>
                    <th className="text-left p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Page</th>
                    <th className="text-center p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Status</th>
                    <th className="text-right p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Clicks</th>
                    <th className="text-right p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Impressions</th>
                    <th className="text-right p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>CTR</th>
                    <th className="text-right p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Position</th>
                    <th className="text-center p-4 text-xs font-medium" style={{ color: '#8A8A8A' }}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((item, i) => (
                    <tr
                      key={item.url}
                      className="animate-in"
                      style={{
                        borderBottom: '1px solid #2A2A2A',
                        animationDelay: `${200 + i * 20}ms`,
                        animationFillMode: 'both',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2A2A2A')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="p-4">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 max-w-xs truncate text-sm font-medium"
                          style={{ color: '#34D399' }}
                        >
                          {cleanUrl(item.url)}
                          <ExternalLink size={12} className="flex-shrink-0" style={{ opacity: 0.5 }} />
                        </a>
                      </td>
                      <td className="p-4 text-center">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-white font-medium">{formatNum(item.clicks)}</span>
                        {item.declining && item.prevClicks !== null && (
                          <span className="text-xs ml-1.5" style={{ color: '#f87171' }}>
                            {'\u2193'}{Math.round((1 - item.clicks / item.prevClicks) * 100)}%
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right" style={{ color: '#9A9A9A' }}>
                        {formatNum(item.impressions)}
                      </td>
                      <td className="p-4 text-right" style={{ color: item.lowCtr ? '#F59E0B' : '#9A9A9A' }}>
                        {(item.ctr * 100).toFixed(1)}%
                      </td>
                      <td className="p-4 text-right" style={{ color: '#9A9A9A' }}>
                        {item.position.toFixed(1)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.declining && <FlagBadge type="declining" />}
                          {item.lowCtr && <FlagBadge type="lowCtr" />}
                          {!item.declining && !item.lowCtr && (
                            <span className="text-xs" style={{ color: '#404040' }}>&mdash;</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 100 && (
              <div className="text-center py-3 text-xs" style={{ color: '#707070', borderTop: '1px solid #2A2A2A' }}>
                Showing 100 of {sorted.length} pages
              </div>
            )}
          </div>

          {/* CMS Prompt if not connected */}
          {!cmsConnected && (
            <div
              className="glass-card-static animate-in flex items-center justify-between gap-4"
              style={{ animationDelay: '300ms', animationFillMode: 'both', borderLeft: '3px solid #8B5CF6' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#8B5CF626' }}>
                  <Plug size={20} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Content status is inferred from GSC signals</p>
                  <p className="text-xs" style={{ color: '#8A8A8A' }}>
                    Connect your CMS for real Draft/Review/Published status tracking
                  </p>
                </div>
              </div>
              <button
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[44px]"
                style={{ background: '#8B5CF6', color: '#fff' }}
              >
                <Plug size={14} /> Connect CMS
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
