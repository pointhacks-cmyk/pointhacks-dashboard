'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

interface DailyChartProps {
  data: Array<{ date: string; sessions: number; users: number }>
}

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatK(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v)
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="p-3 text-sm rounded-lg"
      style={{
        background: '#2A2A2A',
        
        border: '1px solid #383838',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <p className="text-white/70 text-xs mb-2">{formatDateLong(label)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white">{p.name}:</span>
          <span className="text-white font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function DailyChart({ data }: DailyChartProps) {
  const [range, setRange] = useState(30)

  const filtered = useMemo(() => {
    if (!data.length) return data
    return data.slice(-range)
  }, [data, range])

  const avgSessions = useMemo(() => {
    if (!filtered.length) return 0
    return Math.round(filtered.reduce((s, r) => s + r.sessions, 0) / filtered.length)
  }, [filtered])

  const totalSessions = filtered.reduce((s, r) => s + r.sessions, 0)
  const totalUsers = filtered.reduce((s, r) => s + r.users, 0)

  return (
    <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Traffic Overview</h3>
          <p className="text-secondary text-sm">Last {range} days</p>
        </div>
        <div className="flex gap-1 bg-[#2A2A2A] rounded-full p-1">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                range === r.days
                  ? 'bg-[#404040] text-white shadow-sm'
                  : 'text-secondary hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={filtered} style={{ cursor: 'crosshair' }}>
          <defs>
            <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="50%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity={0.5} />
              <stop offset="50%" stopColor="#34D399" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatK} tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: 16 }} />
          <ReferenceLine y={avgSessions} stroke="#404040" strokeDasharray="6 4" label={{ value: `Avg: ${avgSessions.toLocaleString()}`, fill: '#606060', fontSize: 11, position: 'insideTopRight' }} />
          <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#6366f1" strokeWidth={2} fill="url(#gradSessions)" animationDuration={1200} />
          <Area type="monotone" dataKey="users" name="Users" stroke="#34D399" strokeWidth={2} fill="url(#gradUsers)" animationDuration={1200} animationBegin={200} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-6 text-xs text-secondary">
        <span>Total Sessions: <span className="text-white font-medium">{totalSessions.toLocaleString()}</span></span>
        <span>Total Users: <span className="text-white font-medium">{totalUsers.toLocaleString()}</span></span>
      </div>
    </div>
  )
}
