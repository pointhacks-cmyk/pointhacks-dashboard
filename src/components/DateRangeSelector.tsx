'use client'

import { useDateRange, DatePreset } from '@/lib/DateRangeContext'
import { Calendar, GitCompareArrows } from 'lucide-react'

const presets: { key: DatePreset; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '28d', label: '28d' },
  { key: '3m', label: '3m' },
  { key: '6m', label: '6m' },
  { key: '12m', label: '12m' },
]

export default function DateRangeSelector() {
  const { dateRange, setPreset, setCustomRange, toggleCompare } = useDateRange()

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '10px 16px',
      background: '#2A2A2A',
      borderRadius: 12,
      border: '1px solid #383838',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    }}>
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: dateRange.preset === p.key ? '#6366f130' : 'transparent',
              color: dateRange.preset === p.key ? '#818cf8' : '#8C8C8C',
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#383838' }} />

      {/* Custom date inputs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={13} style={{ color: '#606060' }} />
        <input
          type="date"
          value={dateRange.startDate}
          onChange={e => setCustomRange(e.target.value, dateRange.endDate)}
          style={{
            background: '#1A1A1A',
            border: '1px solid #383838',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: '0.75rem',
            color: '#ECECEC',
            outline: 'none',
          }}
        />
        <span style={{ color: '#606060', fontSize: '0.75rem' }}>–</span>
        <input
          type="date"
          value={dateRange.endDate}
          onChange={e => setCustomRange(dateRange.startDate, e.target.value)}
          style={{
            background: '#1A1A1A',
            border: '1px solid #383838',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: '0.75rem',
            color: '#ECECEC',
            outline: 'none',
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#383838' }} />

      {/* Compare toggle */}
      <button
        onClick={toggleCompare}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          border: `1px solid ${dateRange.compareEnabled ? '#34D39940' : '#383838'}`,
          background: dateRange.compareEnabled ? '#34D39915' : 'transparent',
          color: dateRange.compareEnabled ? '#34D399' : '#8C8C8C',
          transition: 'all 0.15s',
        }}
      >
        <GitCompareArrows size={13} />
        Compare
      </button>

      {/* Current range text */}
      <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#606060' }}>
        {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}
        {dateRange.compareEnabled && (
          <span style={{ color: '#34D399', marginLeft: 8 }}>
            vs {formatDate(dateRange.compareStartDate)} – {formatDate(dateRange.compareEndDate)}
          </span>
        )}
      </div>
    </div>
  )
}
