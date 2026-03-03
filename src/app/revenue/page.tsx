'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, MousePointerClick,
  CreditCard, ArrowUpDown, ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts'

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

type RangeKey = '7d' | '30d' | '90d' | '12m' | 'all'
type BrandKey = 'all' | 'Point Hacks' | 'Australian Frequent Flyer'

function fmtCurrency(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function rangeStart(range: RangeKey): string {
  const d = new Date()
  switch (range) {
    case '7d': d.setDate(d.getDate() - 7); break
    case '30d': d.setDate(d.getDate() - 30); break
    case '90d': d.setDate(d.getDate() - 90); break
    case '12m': d.setFullYear(d.getFullYear() - 1); break
    case 'all': return '2023-01-01'
  }
  return d.toISOString().slice(0, 10)
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#888', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#ccc' }}>{p.name}:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenuePage() {
  const [data, setData] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeKey>('30d')
  const [brand, setBrand] = useState<BrandKey>('all')
  const [sortCol, setSortCol] = useState<'gross_profit' | 'revenue' | 'bank_clicks' | 'applications'>('gross_profit')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const start = rangeStart(range)
      const allRows: PartnerRow[] = []
      let from = 0
      while (true) {
        let q = supabase
          .from('partner_performance')
          .select('date, brand, partner, bank_clicks, credit_card_applications, revenue, marketing_expenses, gross_profit')
          .gte('date', start)
          .order('date', { ascending: true })
          .range(from, from + 999)
        if (brand !== 'all') q = q.eq('brand', brand)
        const { data: batch, error } = await q
        if (cancelled) return
        if (error || !batch || batch.length === 0) break
        allRows.push(...batch)
        if (batch.length < 1000) break
        from += 1000
      }
      if (!cancelled) { setData(allRows); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [range, brand])

  const partnerAgg = useMemo<AggPartner[]>(() => {
    const map = new Map<string, AggPartner>()
    for (const r of data) {
      if (r.partner === 'Total') continue
      const e = map.get(r.partner) || { partner: r.partner, revenue: 0, gross_profit: 0, bank_clicks: 0, applications: 0, marketing_expenses: 0, margin: 0 }
      e.revenue += Number(r.revenue) || 0
      e.gross_profit += Number(r.gross_profit) || 0
      e.bank_clicks += Number(r.bank_clicks) || 0
      e.applications += Number(r.credit_card_applications) || 0
      e.marketing_expenses += Number(r.marketing_expenses) || 0
      map.set(r.partner, e)
    }
    const arr = Array.from(map.values()).map(p => ({ ...p, margin: p.revenue ? (p.gross_profit / p.revenue) * 100 : 0 }))
    arr.sort((a, b) => sortDir === 'desc' ? (b as any)[sortCol] - (a as any)[sortCol] : (a as any)[sortCol] - (b as any)[sortCol])
    return arr
  }, [data, sortCol, sortDir])

  const totals = useMemo(() => partnerAgg.reduce((a, p) => ({
    revenue: a.revenue + p.revenue, gross_profit: a.gross_profit + p.gross_profit,
    bank_clicks: a.bank_clicks + p.bank_clicks, applications: a.applications + p.applications,
    marketing_expenses: a.marketing_expenses + p.marketing_expenses,
  }), { revenue: 0, gross_profit: 0, bank_clicks: 0, applications: 0, marketing_expenses: 0 }), [partnerAgg])

  const chartData = useMemo(() => {
    const partners = [...new Set(data.filter(r => r.partner !== 'Total').map(r => r.partner))]
    const dayMap = new Map<string, Record<string, number>>()
    for (const r of data) {
      if (r.partner === 'Total') continue
      const d = r.date.slice(0, 10)
      if (!dayMap.has(d)) dayMap.set(d, {})
      const entry = dayMap.get(d)!
      entry[r.partner] = (entry[r.partner] || 0) + (Number(r.gross_profit) || 0)
    }
    let points = Array.from(dayMap.entries()).map(([date, vals]) => ({ date, ...vals })).sort((a, b) => a.date.localeCompare(b.date))
    // Aggregate to weekly for longer ranges
    if (range !== '7d' && range !== '30d') {
      const weekMap = new Map<string, Record<string, number>>()
      for (const row of points) {
        const d = new Date(row.date)
        const ws = new Date(d.getTime() - d.getDay() * 86400000).toISOString().slice(0, 10)
        if (!weekMap.has(ws)) weekMap.set(ws, {})
        const e = weekMap.get(ws)!
        for (const p of partners) e[p] = (e[p] || 0) + ((row as any)[p] || 0)
      }
      points = Array.from(weekMap.entries()).map(([date, vals]) => ({ date, ...vals })).sort((a, b) => a.date.localeCompare(b.date))
    }
    return { data: points, partners }
  }, [data, range])

  const pieData = useMemo(() =>
    partnerAgg.filter(p => p.gross_profit > 0).map(p => ({ name: p.partner, value: Math.round(p.gross_profit) })),
  [partnerAgg])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <DollarSign size={28} className="text-green-400" />
          <h1 className="text-2xl font-bold text-white">Revenue &amp; Partners</h1>
        </div>
        <p className="text-zinc-400 text-sm">Gross profit, revenue, and application performance by bank partner</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex bg-[#2A2A2A] rounded-lg border border-[#383838] overflow-hidden">
          {(['7d', '30d', '90d', '12m', 'all'] as RangeKey[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
              {r === 'all' ? 'All' : r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="relative">
          <select value={brand} onChange={e => setBrand(e.target.value as BrandKey)}
            className="appearance-none bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-1.5 pr-8 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50">
            <option value="all">All Brands</option>
            <option value="Point Hacks">Point Hacks</option>
            <option value="Australian Frequent Flyer">Australian Frequent Flyer</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
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
            {[
              { label: 'Gross Profit', value: totals.gross_profit, icon: DollarSign, prefix: '$' },
              { label: 'Revenue', value: totals.revenue, icon: BarChart3, prefix: '$' },
              { label: 'Bank Clicks', value: totals.bank_clicks, icon: MousePointerClick, prefix: '' },
              { label: 'Applications', value: totals.applications, icon: CreditCard, prefix: '' },
              { label: 'Marketing Spend', value: totals.marketing_expenses, icon: TrendingDown, prefix: '$' },
            ].map(item => (
              <div key={item.label} className="glass-card-static p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">{item.label}</span>
                  <item.icon size={16} className="text-zinc-500" />
                </div>
                <span className="text-2xl font-bold text-white">
                  {item.prefix === '$' ? fmtCurrency(item.value) : fmtNum(item.value)}
                </span>
              </div>
            ))}
          </div>

          {/* GP Trend Chart */}
          {chartData.data.length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-400" />
                Gross Profit by Partner
              </h2>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }}
                      tickFormatter={(d: string) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}` }} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {chartData.partners.map((p, i) => (
                      <Area key={p} type="monotone" dataKey={p} stackId="1"
                        fill={PARTNER_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        stroke={PARTNER_COLORS[p] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                        fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Revenue Split + Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie */}
            {pieData.length > 0 && (
              <div className="glass-card-static p-6">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Revenue Share</h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {pieData.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-zinc-300 flex-1">{p.name}</span>
                      <span className="text-zinc-500">{fmtCurrency(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      <td className="p-4 text-right text-sm text-white font-medium">{fmtCurrency(p.gross_profit)}</td>
                      <td className="p-4 text-right text-sm text-zinc-300">{fmtCurrency(p.revenue)}</td>
                      <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{fmtNum(p.bank_clicks)}</td>
                      <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{fmtNum(p.applications)}</td>
                      <td className="p-4 text-right hidden lg:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded ${p.margin >= 80 ? 'bg-green-500/20 text-green-400' : p.margin >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          {p.margin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.03] font-semibold">
                    <td className="p-4 text-sm text-zinc-300">Total</td>
                    <td className="p-4 text-right text-sm text-white">{fmtCurrency(totals.gross_profit)}</td>
                    <td className="p-4 text-right text-sm text-zinc-300">{fmtCurrency(totals.revenue)}</td>
                    <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{fmtNum(totals.bank_clicks)}</td>
                    <td className="p-4 text-right text-sm text-zinc-400 hidden md:table-cell">{fmtNum(totals.applications)}</td>
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

          {/* Revenue vs Spend */}
          {partnerAgg.filter(p => p.revenue > 0).length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-400" />
                Revenue per Partner
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partnerAgg.filter(p => p.revenue > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="partner" tick={{ fill: '#aaa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v)} />
                    <Tooltip content={<ChartTooltip />} />
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
          )}
        </div>
      )}
    </div>
  )
}
