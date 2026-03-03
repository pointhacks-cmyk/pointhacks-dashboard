'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Users, MousePointerClick,
  CreditCard, Filter, Calendar, ArrowUpDown, ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts'

// ── Types ──
interface PartnerRow {
  date: string
  brand: string
  partner: string
  bank_clicks: number
  credit_card_applications: number
  revenue: number
  marketing_expenses: number
  gross_profit: number
}

interface AggPartner {
  partner: string
  revenue: number
  gross_profit: number
  bank_clicks: number
  applications: number
  marketing_expenses: number
  margin: number
}

const PARTNER_COLORS: Record<string, string> = {
  'American Express': '#006FCF',
  'ANZ': '#003DA5',
  'NAB': '#C8102E',
  'Westpac': '#D5002B',
  'Qantas': '#E0001A',
  'Citi': '#003B70',
  'HSBC': '#DB0011',
}
const FALLBACK_COLORS = ['#5FD6BF', '#7B4397', '#ffc107', '#4ade80', '#f472b6', '#60a5fa', '#fb923c']

const PIE_COLORS = ['#006FCF', '#003DA5', '#C8102E', '#D5002B', '#E0001A', '#003B70', '#DB0011']

type DateRange = '7d' | '30d' | '90d' | '12m' | 'all'
type Brand = 'all' | 'Point Hacks' | 'Australian Frequent Flyer'

function formatCurrency(n: number) {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

function getDateRange(range: DateRange): string {
  const now = new Date()
  switch (range) {
    case '7d': return new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    case '30d': return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    case '90d': return new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)
    case '12m': return new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10)
    case 'all': return '2023-01-01'
  }
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, prevValue, icon: Icon, prefix }: {
  label: string; value: number; prevValue?: number; icon: any; prefix?: string
}) {
  return (
    <div className="glass-card-static p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
        <Icon size={16} className="text-zinc-500" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">
          {prefix === '$' ? formatCurrency(value) : formatNumber(value)}
        </span>
        {prevValue != null && <DeltaBadge current={value} previous={prevValue} />}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#2A2A2A] border border-[#383838] rounded-lg px-4 py-3 shadow-xl">
      <div className="text-xs text-zinc-400 mb-2">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenuePage() {
  const [data, setData] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>('30d')
  const [brand, setBrand] = useState<Brand>('all')
  const [sortCol, setSortCol] = useState<'gross_profit' | 'revenue' | 'bank_clicks' | 'applications'>('gross_profit')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const startDate = getDateRange(range)
      let query = supabase
        .from('partner_performance')
        .select('date, brand, partner, bank_clicks, credit_card_applications, revenue, marketing_expenses, gross_profit')
        .gte('date', startDate)
        .order('date', { ascending: true })

      if (brand !== 'all') query = query.eq('brand', brand)

      // Paginate to get all rows
      const allRows: PartnerRow[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data: batch, error } = await query.range(from, from + pageSize - 1)
        if (error || !batch || batch.length === 0) break
        allRows.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }
      setData(allRows)
      setLoading(false)
    }
    load()
  }, [range, brand])

  // ── Aggregations ──
  const partnerAgg = useMemo<AggPartner[]>(() => {
    const map = new Map<string, AggPartner>()
    for (const r of data) {
      if (r.partner === 'Total') continue
      const existing = map.get(r.partner) || {
        partner: r.partner, revenue: 0, gross_profit: 0, bank_clicks: 0,
        applications: 0, marketing_expenses: 0, margin: 0,
      }
      existing.revenue += Number(r.revenue) || 0
      existing.gross_profit += Number(r.gross_profit) || 0
      existing.bank_clicks += Number(r.bank_clicks) || 0
      existing.applications += Number(r.credit_card_applications) || 0
      existing.marketing_expenses += Number(r.marketing_expenses) || 0
      map.set(r.partner, existing)
    }
    const arr = Array.from(map.values()).map(p => ({
      ...p,
      margin: p.revenue ? (p.gross_profit / p.revenue) * 100 : 0,
    }))
    arr.sort((a, b) => sortDir === 'desc' ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol])
    return arr
  }, [data, sortCol, sortDir])

  const totals = useMemo(() => {
    return partnerAgg.reduce((acc, p) => ({
      revenue: acc.revenue + p.revenue,
      gross_profit: acc.gross_profit + p.gross_profit,
      bank_clicks: acc.bank_clicks + p.bank_clicks,
      applications: acc.applications + p.applications,
      marketing_expenses: acc.marketing_expenses + p.marketing_expenses,
    }), { revenue: 0, gross_profit: 0, bank_clicks: 0, applications: 0, marketing_expenses: 0 })
  }, [partnerAgg])

  // ── Daily trend (grouped by date, stacked by partner) ──
  const dailyTrend = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    for (const r of data) {
      if (r.partner === 'Total') continue
      const d = r.date.slice(0, 10)
      if (!map.has(d)) map.set(d, { date: 0 } as any)
      const entry = map.get(d)!
      entry[r.partner] = (entry[r.partner] || 0) + (Number(r.gross_profit) || 0)
    }
    const partners = [...new Set(data.filter(r => r.partner !== 'Total').map(r => r.partner))]
    return {
      data: Array.from(map.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      partners,
    }
  }, [data])

  // ── Weekly aggregation for cleaner charts on longer ranges ──
  const chartData = useMemo(() => {
    if (range === '7d' || range === '30d') return dailyTrend
    // Aggregate to weekly
    const map = new Map<string, Record<string, number>>()
    for (const row of dailyTrend.data) {
      const d = new Date(row.date)
      const weekStart = new Date(d.getTime() - d.getDay() * 86400000)
      const key = weekStart.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, {})
      const entry = map.get(key)!
      for (const p of dailyTrend.partners) {
        entry[p] = (entry[p] || 0) + ((row as any)[p] || 0)
      }
    }
    return {
      data: Array.from(map.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      partners: dailyTrend.partners,
    }
  }, [dailyTrend, range])

  // Pie data
  const pieData = useMemo(() => {
    return partnerAgg
      .filter(p => p.gross_profit > 0)
      .map(p => ({ name: p.partner, value: Math.round(p.gross_profit) }))
  }, [partnerAgg])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <DollarSign size={28} className="text-green-400" />
              <h1 className="text-2xl font-bold">Revenue &amp; Partners</h1>
            </div>
            <p className="text-zinc-400 text-sm">Gross profit, revenue, and application performance by bank partner</p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {/* Date Range */}
            <div className="flex bg-[#2A2A2A] rounded-lg border border-[#383838] overflow-hidden">
              {(['7d', '30d', '90d', '12m', 'all'] as DateRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  {r === 'all' ? 'All' : r.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Brand */}
            <div className="relative">
              <select
                value={brand}
                onChange={e => setBrand(e.target.value as Brand)}
                className="appearance-none bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-1.5 pr-8 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Brands</option>
                <option value="Point Hacks">Point Hacks</option>
                <option value="Australian Frequent Flyer">Australian Frequent Flyer</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard label="Gross Profit" value={totals.gross_profit} icon={DollarSign} prefix="$" />
              <KpiCard label="Revenue" value={totals.revenue} icon={BarChart3} prefix="$" />
              <KpiCard label="Bank Clicks" value={totals.bank_clicks} icon={MousePointerClick} />
              <KpiCard label="Applications" value={totals.applications} icon={CreditCard} />
              <KpiCard label="Marketing Spend" value={totals.marketing_expenses} icon={TrendingDown} prefix="$" />
            </div>

            {/* GP Trend Chart */}
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-400" />
                Gross Profit by Partner
              </h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#666', fontSize: 11 }}
                      tickFormatter={d => {
                        const dt = new Date(d)
                        return `${dt.getDate()}/${dt.getMonth() + 1}`
                      }}
                    />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(v: string) => <span style={{ color: '#aaa' }}>{v}</span>}
                    />
                    {chartData.partners.map((p, i) => (
                      <Area
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stackId="1"
                        fill={PARTNER_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        stroke={PARTNER_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Split + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pie Chart */}
              <div className="glass-card-static p-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Revenue Share</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {pieData.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-zinc-300 flex-1">{p.name}</span>
                      <span className="text-zinc-500">{formatCurrency(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Partner Table */}
              <div className="glass-card-static overflow-hidden lg:col-span-2">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#383838] text-xs text-zinc-500 uppercase">
                      <th className="text-left p-4">Partner</th>
                      <th className="text-right p-4 cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('gross_profit')}>
                        <span className="inline-flex items-center gap-1 justify-end">GP <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="text-right p-4 cursor-pointer hover:text-zinc-300" onClick={() => toggleSort('revenue')}>
                        <span className="inline-flex items-center gap-1 justify-end">Revenue <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="text-right p-4 cursor-pointer hover:text-zinc-300 hidden md:table-cell" onClick={() => toggleSort('bank_clicks')}>
                        <span className="inline-flex items-center gap-1 justify-end">Clicks <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="text-right p-4 cursor-pointer hover:text-zinc-300 hidden md:table-cell" onClick={() => toggleSort('applications')}>
                        <span className="inline-flex items-center gap-1 justify-end">Apps <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="text-right p-4 hidden lg:table-cell">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerAgg.map((p, i) => (
                      <tr key={p.partner} className="border-b border-[#383838] last:border-0 hover:bg-white/[0.02]">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: PARTNER_COLORS[p.partner] || FALLBACK_COLORS[i] }} />
                            <span className="text-sm text-white font-medium">{p.partner}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right text-sm text-white font-medium">{formatCurrency(p.gross_profit)}</td>
                        <td className="p-4 text-right text-sm text-zinc-300">{formatCurrency(p.revenue)}</td>
                        <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{formatNumber(p.bank_clicks)}</td>
                        <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{formatNumber(p.applications)}</td>
                        <td className="p-4 text-right hidden lg:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded ${p.margin >= 80 ? 'bg-green-500/20 text-green-400' : p.margin >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                            {p.margin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-white/[0.03] font-semibold">
                      <td className="p-4 text-sm text-zinc-300">Total</td>
                      <td className="p-4 text-right text-sm text-white">{formatCurrency(totals.gross_profit)}</td>
                      <td className="p-4 text-right text-sm text-zinc-300">{formatCurrency(totals.revenue)}</td>
                      <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{formatNumber(totals.bank_clicks)}</td>
                      <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{formatNumber(totals.applications)}</td>
                      <td className="p-4 text-right hidden lg:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                          {totals.revenue ? ((totals.gross_profit / totals.revenue) * 100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Application Conversion by Partner */}
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-400" />
                Revenue per Partner
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partnerAgg.filter(p => p.revenue > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="partner" tick={{ fill: '#aaa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                      {partnerAgg.filter(p => p.revenue > 0).map((p, i) => (
                        <Cell key={p.partner} fill={PARTNER_COLORS[p.partner] || FALLBACK_COLORS[i]} />
                      ))}
                    </Bar>
                    <Bar dataKey="marketing_expenses" name="Marketing Spend" fill="#ef4444" radius={[4, 4, 0, 0]} fillOpacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
