'use client'

import { useState, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'

interface TrafficPieChartProps {
  data: Array<{ source: string; sessions: number }>
}

const COLORS = [
  '#6366f1', // indigo
  '#34D399', // teal
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F59E0B', // gold
  '#3b82f6', // blue
  '#f97316', // orange
  '#9ca3af', // grey (other)
]

function categorizeSource(source: string): string {
  const s = source.toLowerCase()
  if (s === 'google' || s === 'bing' || s === 'duckduckgo' || s.includes('yahoo') || s.includes('search')) return 'Organic Search'
  if (s === '(direct)' || s === 'direct') return 'Direct'
  if (s.includes('facebook') || s.includes('instagram') || s.includes('reddit') || s.includes('youtube') || s === 'social') return 'Social'
  if (s.includes('newsletter') || s.includes('email') || s.includes('mail')) return 'Email'
  if (s.includes('chatgpt') || s.includes('ai') || s.includes('perplexity')) return 'AI / Chat'
  if (s === 'paid' || s === 'cpc' || s === 'ads') return 'Paid'
  if (s === '(not set)') return 'Other'
  return 'Referral'
}

function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.85} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

export default function TrafficPieChart({ data }: TrafficPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  // Group sources into categories
  const grouped = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of data) {
      const cat = categorizeSource(entry.source)
      map.set(cat, (map.get(cat) || 0) + entry.sessions)
    }
    return Array.from(map, ([source, sessions]) => ({ source, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
  }, [data])

  const total = grouped.reduce((s, d) => s + d.sessions, 0)

  const onEnter = useCallback((_: any, index: number) => setActiveIndex(index), [])
  const onLeave = useCallback(() => setActiveIndex(undefined), [])

  return (
    <div className="glass-card p-6 animate-in" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
      <h3 className="text-lg font-semibold text-white mb-4">Traffic Sources</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={grouped}
              dataKey="sessions"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              strokeWidth={2}
              stroke="#1E1E1E"
              {...{ activeIndex } as any}
              activeShape={renderActiveShape}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              animationBegin={0}
              animationDuration={1200}
            >
              {grouped.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-white metric-number">{total.toLocaleString()}</div>
            <div className="text-[10px] text-secondary uppercase tracking-wider">Total Sessions</div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {grouped.map((entry, i) => {
          const pct = total ? (entry.sessions / total) * 100 : 0
          const isActive = activeIndex === i
          return (
            <div
              key={entry.source}
              className="text-sm transition-all duration-200"
              style={{ opacity: activeIndex !== undefined && !isActive ? 0.4 : 1 }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-white font-medium">{entry.source}</span>
                </div>
                <span className="text-secondary text-xs font-medium">
                  {entry.sessions.toLocaleString()} <span className="text-muted">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden ml-5">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
