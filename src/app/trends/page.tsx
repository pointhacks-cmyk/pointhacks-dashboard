'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Search, X, Loader2 } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

const CHART_COLORS = ['#34D399', '#6366f1', '#8B5CF6', '#F59E0B', '#EF4444', '#ff6b9d', '#66aaff']

const KEYWORD_GROUPS: Record<string, string[]> = {
  'Credit Cards': ['best credit cards australia', 'credit card comparison', 'credit card rewards'],
  'Points Programs': ['qantas points', 'velocity frequent flyer', 'flybuys points'],
  'Travel': ['business class flights', 'lounge access', 'frequent flyer'],
  'Competitors': ['finder credit cards', 'canstar credit cards', 'money.com.au'],
}

const TIME_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
]

interface TrendsData {
  keywords: string[]
  timeline: { date: string; timestamp: number; values: number[] }[]
  averages: number[]
  topRelated: { query: string; value: number }[]
  risingRelated: { query: string; value: string }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#8C8C8C', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'white', fontWeight: 600 }}>{p.value}</span>
          <span style={{ color: '#8C8C8C', fontSize: 11 }}>{p.dataKey}</span>
        </div>
      ))}
    </div>
  )
}

export default function TrendsPage() {
  const [keywords, setKeywords] = useState<string[]>([
    'best credit cards australia', 'qantas points', 'frequent flyer credit card',
    'credit card rewards', 'velocity frequent flyer'
  ])
  const [inputValue, setInputValue] = useState('')
  const [days, setDays] = useState(90)
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrends = useCallback(async (kws: string[], d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/trends?keywords=${encodeURIComponent(kws.join(','))}&days=${d}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch trends')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrends(keywords, days) }, [keywords, days, fetchTrends])

  const chartData = data?.timeline.map(t => {
    const row: any = { date: t.date }
    data.keywords.forEach((kw, i) => { row[kw] = t.values[i] })
    return row
  }) || []

  const addKeyword = () => {
    const kw = inputValue.trim().toLowerCase()
    if (kw && keywords.length < 5 && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setInputValue('')
    }
  }

  const removeKeyword = (kw: string) => {
    if (keywords.length > 1) setKeywords(keywords.filter(k => k !== kw))
  }

  const selectGroup = (group: string) => {
    setKeywords(KEYWORD_GROUPS[group].slice(0, 5))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={24} style={{ color: '#34D399' }} /> Search Trends
        </h1>
        <p className="text-secondary">Google Trends data for Australian search interest</p>
      </div>

      {/* Controls */}
      <div className="glass-card p-5 space-y-4 animate-in" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
        {/* Keyword Groups */}
        <div>
          <div className="text-xs text-secondary uppercase tracking-wider font-medium mb-2">Quick Select</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(KEYWORD_GROUPS).map(group => (
              <button key={group} onClick={() => selectGroup(group)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: '#383838', color: '#ECECEC', border: 'none', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#484848'}
              onMouseLeave={e => e.currentTarget.style.background = '#383838'}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <div className="text-xs text-secondary uppercase tracking-wider font-medium mb-2">Keywords ({keywords.length}/5)</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((kw, i) => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: `${CHART_COLORS[i]}20`, color: CHART_COLORS[i],
                border: `1px solid ${CHART_COLORS[i]}40`,
              }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: CHART_COLORS[i], opacity: 0.7, display: 'flex',
                }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          {keywords.length < 5 && (
            <div className="flex gap-2">
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
                placeholder="Add keyword..."
                style={{
                  flex: 1, padding: '8px 14px', borderRadius: 10, fontSize: 13,
                  background: '#1A1A1A', border: '1px solid #383838', color: 'white',
                  outline: 'none',
                }}
              />
              <button onClick={addKeyword} style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: '#34D399', color: '#1A1A1A', border: 'none', cursor: 'pointer',
              }}>
                Add
              </button>
            </div>
          )}
        </div>

        {/* Time Range */}
        <div>
          <div className="text-xs text-secondary uppercase tracking-wider font-medium mb-2">Time Range</div>
          <div className="flex gap-2">
            {TIME_RANGES.map(tr => (
              <button key={tr.days} onClick={() => setDays(tr.days)} style={{
                padding: '6px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: days === tr.days ? '#34D399' : '#383838',
                color: days === tr.days ? '#1A1A1A' : '#ECECEC',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 animate-in" style={{ borderLeft: '3px solid #EF4444' }}>
          <p className="text-sm text-red-400">⚠️ {error}</p>
          <p className="text-xs text-secondary mt-1">Google Trends may be rate-limiting requests. Try again in a few minutes.</p>
        </div>
      )}

      {/* Chart */}
      <div className="glass-card-static p-6 animate-in" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <TrendingUp size={16} style={{ color: '#34D399' }} /> Interest Over Time
        </h2>
        <p className="text-xs text-secondary mb-4">Relative search interest (0-100) in Australia</p>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 350 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: '#34D399' }} />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
              <XAxis dataKey="date" tick={{ fill: '#8C8C8C', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8C8C8C' }} />
              {(data?.keywords || []).map((kw, i) => (
                <Line key={kw} type="monotone" dataKey={kw} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center text-secondary text-sm" style={{ height: 350 }}>
            No trend data available
          </div>
        )}
      </div>

      {/* Related Queries */}
      {data && (data.topRelated.length > 0 || data.risingRelated.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
          {/* Top Related */}
          {data.topRelated.length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Search size={16} style={{ color: '#6366f1' }} /> Top Related Queries
              </h2>
              <p className="text-xs text-secondary mb-4">Most searched related terms</p>
              <div className="space-y-2">
                {data.topRelated.map((q, i) => (
                  <div key={i} className="flex items-center justify-between" style={{ padding: '6px 0', borderBottom: '1px solid #2A2A2A' }}>
                    <span className="text-sm text-white">{q.query}</span>
                    <span className="text-xs text-secondary font-mono">{q.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rising Related */}
          {data.risingRelated.length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <TrendingUp size={16} style={{ color: '#F59E0B' }} /> Rising Queries
              </h2>
              <p className="text-xs text-secondary mb-4">Breakout and fast-growing search terms</p>
              <div className="flex flex-wrap gap-2">
                {data.risingRelated.map((q, i) => {
                  const isBreakout = q.value === 'Breakout'
                  return (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: isBreakout ? '#34D39915' : '#F59E0B15',
                      color: isBreakout ? '#34D399' : '#F59E0B',
                      border: `1px solid ${isBreakout ? '#34D39930' : '#F59E0B30'}`,
                    }}>
                      {q.query}
                      <span style={{ fontSize: 10, opacity: 0.8 }}>{isBreakout ? '🚀' : `+${q.value}`}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center text-xs text-secondary animate-in" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
        Data: Google Trends · Region: Australia
      </div>
    </div>
  )
}
