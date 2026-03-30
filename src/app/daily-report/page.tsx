'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  FileSpreadsheet, Download, ChevronDown, Loader2, RefreshCw,
  Calendar, DollarSign, CreditCard, MousePointerClick, TrendingUp,
  AlertTriangle, CheckCircle, Clock, ArrowUpDown
} from 'lucide-react'

const TEAL = '#34D399', RED = '#EF4444', GOLD = '#F59E0B', BLUE = '#3B82F6', PURPLE = '#8B5CF6'
const PARTNER_COLORS: Record<string, string> = {
  'American Express': '#006FCF', 'ANZ': '#004B8D', 'NAB': '#D4A843',
  'Westpac': '#B0B0B0', 'Qantas Money': '#E0001A', 'HSBC': '#DB0011', 'Citi': '#1A8FCE',
}

function fmtCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

interface ReportSummary {
  report_date: string
  updated_at: string
}

interface ReportData {
  report_date: string
  report_data: {
    date: string
    month: string
    cards_with_apps: string[]
    cards_with_clicks: string[]
    partner_totals: Record<string, { apps: number; revenue: number }>
    sources_used: { type: string; subject: string }[]
  }
  created_at: string
  updated_at: string
}

export default function DailyReportPage() {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [selected, setSelected] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [sortCol, setSortCol] = useState<'partner' | 'apps' | 'revenue'>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    setLoading(true)
    const res = await fetch('/api/daily-report')
    const data = await res.json()
    if (Array.isArray(data)) setReports(data)
    setLoading(false)

    // Auto-load latest
    if (data?.[0]?.report_date) {
      loadReport(data[0].report_date)
    }
  }

  async function loadReport(date: string) {
    setLoadingReport(true)
    const res = await fetch(`/api/daily-report?date=${date}`)
    const data = await res.json()
    if (data.report_date) setSelected(data)
    setLoadingReport(false)
  }

  function downloadExcel(date: string) {
    window.open(`/api/daily-report?download=true&date=${date}`, '_blank')
  }

  const partnerRows = useMemo(() => {
    if (!selected?.report_data?.partner_totals) return []
    const rows = Object.entries(selected.report_data.partner_totals)
      .map(([partner, data]) => ({ partner, apps: data.apps, revenue: data.revenue }))
      .filter(r => r.apps > 0 || r.revenue > 0)

    rows.sort((a, b) => {
      const av = sortCol === 'partner' ? a.partner : sortCol === 'apps' ? a.apps : a.revenue
      const bv = sortCol === 'partner' ? b.partner : sortCol === 'apps' ? b.apps : b.revenue
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return rows
  }, [selected, sortCol, sortDir])

  const totals = useMemo(() => {
    return partnerRows.reduce((acc, r) => ({ apps: acc.apps + r.apps, revenue: acc.revenue + r.revenue }), { apps: 0, revenue: 0 })
  }, [partnerRows])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet size={28} style={{ color: TEAL }} />
            <h1 className="text-2xl font-bold text-white">Daily Report</h1>
          </div>
          <p className="text-zinc-400 text-sm">Partner applications and revenue — compiled from Metabase, email reports, and Impact API</p>
        </div>
        <div className="flex gap-2">
          {selected && (
            <button onClick={() => downloadExcel(selected.report_date)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors">
              <Download size={14} /> Download Excel
            </button>
          )}
          <button onClick={loadReports} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-sm transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Selector */}
      {reports.length > 0 && (
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-zinc-500" />
          <div className="relative">
            <select
              value={selected?.report_date || ''}
              onChange={e => loadReport(e.target.value)}
              className="appearance-none bg-[#2A2A2A] border border-[#383838] rounded-lg px-4 py-2 pr-8 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50"
            >
              {reports.map(r => (
                <option key={r.report_date} value={r.report_date}>
                  {new Date(r.report_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          {selected && (
            <span className="text-[10px] text-zinc-600">
              Updated {new Date(selected.updated_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="glass-card-static p-16 text-center">
          <FileSpreadsheet size={48} className="mx-auto mb-4" style={{ color: '#383838' }} />
          <h3 className="text-lg font-bold text-white mb-2">No reports yet</h3>
          <p className="text-zinc-500 text-sm">Daily reports will appear here once the automated pipeline runs. Forward partner emails to pointhacks@yottadigital.ai and the report will be compiled automatically.</p>
        </div>
      ) : loadingReport ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : selected ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} style={{ color: TEAL }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">MTD Revenue</span>
              </div>
              <div className="text-xl font-bold text-white">{fmtCurrency(totals.revenue)}</div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} style={{ color: BLUE }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">MTD Applications</span>
              </div>
              <div className="text-xl font-bold text-white">{totals.apps.toLocaleString()}</div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} style={{ color: PURPLE }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Rev/App</span>
              </div>
              <div className="text-xl font-bold text-white">
                ${totals.apps > 0 ? (totals.revenue / totals.apps).toFixed(0) : '0'}
              </div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick size={14} style={{ color: GOLD }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Data Sources</span>
              </div>
              <div className="text-xl font-bold text-white">{selected.report_data.sources_used?.length || 0}</div>
              <div className="text-[10px] text-zinc-500 mt-1">{selected.report_data.cards_with_apps?.length || 0} card products</div>
            </div>
          </div>

          {/* Partner Table */}
          <div className="glass-card-static overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#383838] text-[10px] text-zinc-500 uppercase">
                    <th className="text-left p-3 cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('partner')}>
                      <span className="inline-flex items-center gap-1">Partner <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="text-right p-3 cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('apps')}>
                      <span className="inline-flex items-center gap-1 justify-end">Applications <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="text-right p-3 cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('revenue')}>
                      <span className="inline-flex items-center gap-1 justify-end">Revenue <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="text-right p-3">Rev/App</th>
                    <th className="text-right p-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerRows.map(r => (
                    <tr key={r.partner} className="border-b border-[#383838] last:border-0 hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: PARTNER_COLORS[r.partner] || BLUE }} />
                          <span className="text-sm text-white font-medium">{r.partner}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-sm text-zinc-300">{r.apps.toLocaleString()}</td>
                      <td className="p-3 text-right text-sm text-white font-medium">{fmtCurrency(r.revenue)}</td>
                      <td className="p-3 text-right text-sm text-zinc-400">${r.apps > 0 ? (r.revenue / r.apps).toFixed(0) : '0'}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${totals.revenue > 0 ? (r.revenue / totals.revenue) * 100 : 0}%`,
                              background: PARTNER_COLORS[r.partner] || BLUE
                            }} />
                          </div>
                          <span className="text-xs text-zinc-500 w-10 text-right">
                            {totals.revenue > 0 ? ((r.revenue / totals.revenue) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.03] font-semibold">
                    <td className="p-3 text-sm text-zinc-300">Total</td>
                    <td className="p-3 text-right text-sm text-zinc-300">{totals.apps.toLocaleString()}</td>
                    <td className="p-3 text-right text-sm text-white">{fmtCurrency(totals.revenue)}</td>
                    <td className="p-3 text-right text-sm text-zinc-400">${totals.apps > 0 ? (totals.revenue / totals.apps).toFixed(0) : '0'}</td>
                    <td className="p-3 text-right text-sm text-zinc-500">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sources Used */}
          {selected.report_data.sources_used?.length > 0 && (
            <div className="glass-card-static p-4">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle size={12} style={{ color: TEAL }} /> Data Sources Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {selected.report_data.sources_used.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded bg-white/5 text-zinc-400">
                    {s.type}: {s.subject.slice(0, 50)}{s.subject.length > 50 ? '...' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Data Warning */}
          {selected.report_data.cards_with_apps?.length === 0 && (
            <div className="glass-card-static p-4 flex items-center gap-3" style={{ borderLeft: `3px solid ${GOLD}` }}>
              <AlertTriangle size={18} style={{ color: GOLD }} />
              <div>
                <div className="text-sm font-medium text-white">No application data found</div>
                <div className="text-xs text-zinc-500">Make sure partner emails have been forwarded to pointhacks@yottadigital.ai</div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
