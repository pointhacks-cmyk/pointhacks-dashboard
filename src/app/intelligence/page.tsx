'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign,
  ChevronDown, CreditCard, BarChart3, Zap, Eye, RefreshCw, Loader2,
  CheckCircle, XCircle, ArrowRight, Gauge, CalendarDays, Handshake
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, Cell, LineChart, Line
} from 'recharts'

const TEAL = '#34D399', RED = '#EF4444', GOLD = '#F59E0B', BLUE = '#3B82F6', PURPLE = '#8B5CF6'
const PARTNER_COLORS: Record<string, string> = {
  'American Express': '#006FCF', 'ANZ': '#004B8D', 'NAB': '#D4A843',
  'Westpac': '#B0B0B0', 'Qantas': '#E0001A', 'Citi': '#1A8FCE', 'HSBC': '#DB0011',
}

function fmtCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)
}

function pctBadge(pct: number | null) {
  if (pct == null) return <span className="text-zinc-600 text-xs">N/A</span>
  const color = pct >= 0 ? TEAL : RED
  const icon = pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      {icon} {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#2A2A2A] border border-[#383838] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="text-white font-medium">
            {typeof p.value === 'number' && p.value > 100 ? fmtCurrency(p.value) : p.value?.toFixed?.(1) ?? p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

type TabId = 'projections' | 'anomalies' | 'placements'

export default function IntelligencePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('projections')
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/intelligence')
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-blue-500" />
    </div>
  )

  if (!data || data.error) return (
    <div className="glass-card-static p-8 text-center">
      <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
      <p className="text-zinc-400">{data?.error || 'Failed to load intelligence data'}</p>
    </div>
  )

  const { asOf, daysInMonth, dayOfMonth, monthlyGPTarget, totalMTD, totalProjected, gpOnTrack, projections, anomalies, trends } = data

  const gpProgress = (totalMTD.gp / monthlyGPTarget) * 100
  const expectedProgress = (dayOfMonth / daysInMonth) * 100
  const aheadBehind = gpProgress - expectedProgress

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain size={28} style={{ color: PURPLE }} />
            <h1 className="text-2xl font-bold text-white">Forecasting & Intelligence</h1>
          </div>
          <p className="text-zinc-400 text-sm">Revenue projections, anomaly detection, and partner insights — data as of {asOf}</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-sm transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-1 w-fit">
        {[
          { id: 'projections' as TabId, label: 'Projections', icon: Target, badge: null },
          { id: 'anomalies' as TabId, label: 'Anomalies', icon: AlertTriangle, badge: anomalies.length || null },
          { id: 'placements' as TabId, label: 'Placement Optimiser', icon: Zap, badge: null },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <t.icon size={14} />
            {t.label}
            {t.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== PROJECTIONS TAB ==================== */}
      {tab === 'projections' && (
        <div className="space-y-6">
          {/* GP Target Tracker */}
          <div className="glass-card-static p-6" style={{ borderLeft: `3px solid ${gpOnTrack ? TEAL : RED}` }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target size={22} style={{ color: gpOnTrack ? TEAL : RED }} />
                <div>
                  <h2 className="text-lg font-semibold text-white">Monthly GP Target</h2>
                  <p className="text-xs text-zinc-500">Day {dayOfMonth} of {daysInMonth} — {((dayOfMonth / daysInMonth) * 100).toFixed(0)}% through the month</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: gpOnTrack ? TEAL : RED }}>{fmtCurrency(totalProjected.gp)}</div>
                <div className="text-xs text-zinc-500">projected vs {fmtCurrency(monthlyGPTarget)} target</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-6 bg-[#2A2A2A] rounded-full overflow-hidden mb-2">
              <div className="absolute h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(gpProgress, 100)}%`, background: gpOnTrack ? TEAL : RED, opacity: 0.8 }} />
              <div className="absolute h-full border-l-2 border-dashed border-zinc-500" style={{ left: `${expectedProgress}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {fmtCurrency(totalMTD.gp)} MTD ({gpProgress.toFixed(1)}%)
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>$0</span>
              <span className={`font-medium ${aheadBehind >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {aheadBehind >= 0 ? '↑' : '↓'} {Math.abs(aheadBehind).toFixed(1)}% {aheadBehind >= 0 ? 'ahead' : 'behind'} pace
              </span>
              <span>{fmtCurrency(monthlyGPTarget)}</span>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} style={{ color: BLUE }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Projected Revenue</span>
              </div>
              <div className="text-xl font-bold text-white">{fmtCurrency(totalProjected.rev)}</div>
              <div className="text-[10px] text-zinc-500 mt-1">MTD: {fmtCurrency(totalMTD.rev)}</div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} style={{ color: TEAL }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Projected GP</span>
              </div>
              <div className="text-xl font-bold" style={{ color: gpOnTrack ? TEAL : GOLD }}>{fmtCurrency(totalProjected.gp)}</div>
              <div className="text-[10px] text-zinc-500 mt-1">Target: {fmtCurrency(monthlyGPTarget)}</div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} style={{ color: PURPLE }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Projected Apps</span>
              </div>
              <div className="text-xl font-bold text-white">{fmtNum(projections.reduce((s: number, p: any) => s + p.projectedApps, 0))}</div>
              <div className="text-[10px] text-zinc-500 mt-1">MTD: {fmtNum(projections.reduce((s: number, p: any) => s + p.mtdApps, 0))}</div>
            </div>
            <div className="glass-card-static p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} style={{ color: GOLD }} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Days Remaining</span>
              </div>
              <div className="text-xl font-bold text-white">{daysInMonth - dayOfMonth}</div>
              <div className="text-[10px] text-zinc-500 mt-1">Need {fmtCurrency((monthlyGPTarget - totalMTD.gp) / (daysInMonth - dayOfMonth))}/day to hit target</div>
            </div>
          </div>

          {/* Projection Bar Chart */}
          <div className="glass-card-static p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={20} style={{ color: BLUE }} />
              Projected Revenue by Partner
            </h2>
            <div style={{ width: '100%', height: Math.max(250, projections.length * 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projections} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v)} />
                  <YAxis type="category" dataKey="partner" tick={{ fill: '#aaa', fontSize: 11 }} width={140} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="mtdRev" name="MTD Actual" stackId="rev" radius={[0, 0, 0, 0]}>
                    {projections.map((p: any) => (
                      <Cell key={p.partner} fill={PARTNER_COLORS[p.partner] || BLUE} />
                    ))}
                  </Bar>
                  <Bar dataKey="projectedRev" name="Projected (full month)" fillOpacity={0.3} radius={[0, 4, 4, 0]}>
                    {projections.map((p: any) => (
                      <Cell key={p.partner} fill={PARTNER_COLORS[p.partner] || BLUE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Partner Projections Table */}
          <div className="glass-card-static overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#383838] text-[10px] text-zinc-500 uppercase">
                    <th className="text-left p-3">Partner</th>
                    <th className="text-right p-3">MTD Rev</th>
                    <th className="text-right p-3">Projected Rev</th>
                    <th className="text-right p-3 hidden md:table-cell">Projected GP</th>
                    <th className="text-right p-3 hidden md:table-cell">MTD Apps</th>
                    <th className="text-right p-3">Rev/App</th>
                    <th className="text-right p-3 hidden lg:table-cell">YoY</th>
                    <th className="text-right p-3">Daily Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((p: any) => (
                    <tr key={p.partner} className="border-b border-[#383838] last:border-0 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setExpandedPartner(expandedPartner === p.partner ? null : p.partner)}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: PARTNER_COLORS[p.partner] || BLUE }} />
                          <span className="text-sm text-white font-medium">{p.partner}</span>
                          <ChevronDown size={12} className={`text-zinc-600 transition-transform ${expandedPartner === p.partner ? 'rotate-180' : ''}`} />
                        </div>
                      </td>
                      <td className="p-3 text-right text-sm text-zinc-300">{fmtCurrency(p.mtdRev)}</td>
                      <td className="p-3 text-right text-sm text-white font-medium">{fmtCurrency(p.projectedRev)}</td>
                      <td className="p-3 text-right text-sm text-zinc-300 hidden md:table-cell">{fmtCurrency(p.projectedGP)}</td>
                      <td className="p-3 text-right text-sm text-zinc-400 hidden md:table-cell">{fmtNum(p.mtdApps)}</td>
                      <td className="p-3 text-right text-sm text-zinc-300">${p.revPerApp.toFixed(0)}</td>
                      <td className="p-3 text-right hidden lg:table-cell">{pctBadge(p.yoyChange)}</td>
                      <td className="p-3 text-right text-sm text-zinc-400">{fmtCurrency(p.dailyRevRate)}/d</td>
                    </tr>
                  ))}
                  {expandedPartner && (() => {
                    const p = projections.find((p: any) => p.partner === expandedPartner)
                    if (!p?.revPerAppTrend?.length) return null
                    return (
                      <tr>
                        <td colSpan={8} className="p-4 bg-[#1A1A1A]">
                          <div className="text-xs text-zinc-500 mb-2">Rev/App trend (last 3 months):</div>
                          <div className="flex gap-4">
                            {p.revPerAppTrend.map((t: any) => (
                              <div key={t.month} className="text-center">
                                <div className="text-xs text-zinc-500">{t.month}</div>
                                <div className="text-sm font-medium text-white">${t.revPerApp.toFixed(0)}</div>
                              </div>
                            ))}
                            <div className="text-center">
                              <div className="text-xs text-zinc-500">Current</div>
                              <div className="text-sm font-bold" style={{ color: BLUE }}>${p.revPerApp.toFixed(0)}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Partner Trends — Revenue over last 6 months */}
          {trends?.length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} style={{ color: TEAL }} />
                Partner Revenue Trends (Monthly)
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends[0]?.months?.map((_: any, i: number) => {
                    const point: any = { month: trends[0].months[i].month }
                    for (const t of trends) {
                      point[t.partner] = t.months[i]?.rev || 0
                    }
                    return point
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="month" tick={{ fill: '#aaa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v: number) => fmtCurrency(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {trends.map((t: any) => (
                      <Line key={t.partner} type="monotone" dataKey={t.partner} stroke={PARTNER_COLORS[t.partner] || BLUE} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== ANOMALIES TAB ==================== */}
      {tab === 'anomalies' && (
        <div className="space-y-6">
          {anomalies.length === 0 ? (
            <div className="glass-card-static p-12 text-center" style={{ borderLeft: `3px solid ${TEAL}` }}>
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: TEAL }} />
              <h3 className="text-lg font-semibold text-white mb-2">All Clear</h3>
              <p className="text-zinc-500 text-sm">No anomalies detected in the last 2 days. All partners reporting normally.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <AlertTriangle size={16} style={{ color: GOLD }} />
                <span>{anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected in the last 2 days</span>
              </div>

              <div className="space-y-3">
                {anomalies.map((a: any, i: number) => (
                  <div key={i} className="glass-card-static p-4" style={{
                    borderLeft: `3px solid ${a.severity === 'critical' ? RED : GOLD}`
                  }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {a.severity === 'critical'
                            ? <XCircle size={18} style={{ color: RED }} />
                            : <AlertTriangle size={18} style={{ color: GOLD }} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">{a.partner}</span>
                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                              a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{a.severity}</span>
                            <span className="text-[10px] text-zinc-600 uppercase px-2 py-0.5 rounded bg-white/5">
                              {a.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-300">{a.message}</p>
                          <p className="text-[10px] text-zinc-600 mt-1">{a.date}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Anomaly summary by partner */}
              <div className="glass-card-static p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Partner Health Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {Object.keys(PARTNER_COLORS).map(partner => {
                    const partnerAnomalies = anomalies.filter((a: any) => a.partner === partner)
                    const hasCritical = partnerAnomalies.some((a: any) => a.severity === 'critical')
                    const hasWarning = partnerAnomalies.length > 0
                    return (
                      <div key={partner} className="text-center p-3 rounded-lg bg-[#1A1A1A]">
                        <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{
                          background: hasCritical ? RED : hasWarning ? GOLD : TEAL
                        }} />
                        <div className="text-xs text-white font-medium">{partner}</div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {hasCritical ? `${partnerAnomalies.length} issues` : hasWarning ? `${partnerAnomalies.length} warning${partnerAnomalies.length > 1 ? 's' : ''}` : 'Healthy'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== PLACEMENTS TAB ==================== */}
      {tab === 'placements' && (
        <div className="space-y-6">
          <div className="glass-card-static p-12 text-center">
            <Zap size={48} className="mx-auto mb-4" style={{ color: '#383838' }} />
            <h3 className="text-lg font-bold text-white mb-2">Placement Optimiser</h3>
            <p className="text-zinc-500 text-sm mb-4">
              This feature will analyse your card placements across the site and recommend optimal positioning based on conversion rates, revenue per application, and page traffic.
            </p>
            <div className="glass-card-static p-4 max-w-md mx-auto text-left">
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Eye size={14} style={{ color: PURPLE }} /> What we need:
              </h4>
              <ul className="text-sm text-zinc-400 space-y-1.5">
                <li className="flex items-start gap-2"><ArrowRight size={12} className="mt-1 shrink-0 text-zinc-600" />Current card placements (which card, which page, what position)</li>
                <li className="flex items-start gap-2"><ArrowRight size={12} className="mt-1 shrink-0 text-zinc-600" />Page URLs where cards are displayed</li>
                <li className="flex items-start gap-2"><ArrowRight size={12} className="mt-1 shrink-0 text-zinc-600" />Any click tracking per position (if available)</li>
              </ul>
            </div>
            <p className="text-zinc-600 text-xs mt-4">Send Keith the placement data and this section will light up ✨</p>
          </div>
        </div>
      )}
    </div>
  )
}
