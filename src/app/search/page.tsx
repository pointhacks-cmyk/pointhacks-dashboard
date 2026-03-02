'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useDateRange } from '@/lib/DateRangeContext'
import DataTable from '@/components/DataTable'
import { MousePointerClick, Eye, Target, TrendingUp, TrendingDown, Lightbulb, Flame, Zap, Search, BarChart3, Filter, ArrowUp, ArrowDown, Activity } from 'lucide-react'

type Tab = 'queries' | 'pages' | 'fluctuations'

interface QueryRow { query: string; clicks: number; impressions: number; ctr: number; position: number }
interface PageRow { page: string; clicks: number; impressions: number; ctr: number; position: number }
interface CompareRow { clicks: number; impressions: number; ctr: number; position: number; clicksDelta: number; impressionsDelta: number; ctrDelta: number; positionDelta: number }

const fmt = (n: number) => n.toLocaleString()
const NAVY = '#6366f1'
const TEAL = '#34D399'
const RED = '#EF4444'
const GOLD = '#F59E0B'
const PURPLE = '#8B5CF6'

const CLUSTER_DEFS: Record<string, string[]> = {
  'Qantas': ['qantas', 'qff', 'qantas frequent flyer'],
  'Velocity': ['velocity', 'virgin australia'],
  'Credit Cards': ['credit card', 'credit cards', 'card review', 'card comparison'],
  'Points Transfer': ['transfer partner', 'transfer points', 'point transfer'],
  'Lounge': ['lounge', 'lounge access', 'priority pass'],
  'Hotels': ['hotel', 'marriott', 'hilton', 'hyatt', 'accor', 'ihg'],
  'Amex': ['amex', 'american express'],
  'Business Class': ['business class', 'j class'],
  'First Class': ['first class', 'f class'],
  'KrisFlyer': ['krisflyer', 'singapore airlines', 'sq'],
}

function classifyQuery(query: string): string {
  const q = query.toLowerCase()
  for (const [cluster, keywords] of Object.entries(CLUSTER_DEFS)) {
    if (keywords.some(kw => q.includes(kw))) return cluster
  }
  return 'Other'
}

function PositionBadge({ v }: { v: number }) {
  let bg: string, color: string
  if (v <= 3) { bg = '#34D39926'; color = TEAL }
  else if (v <= 10) { bg = '#6366f120'; color = '#6699ff' }
  else if (v <= 20) { bg = '#F59E0B26'; color = GOLD }
  else { bg = '#EF444426'; color = RED }
  return (
    <span style={{ background: bg, color, padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600 }}>
      {v.toFixed(1)}
    </span>
  )
}

function CTRBar({ v }: { v: number }) {
  const pct = Math.min(100, v)
  let color: string
  if (v >= 5) color = TEAL
  else if (v >= 2) color = GOLD
  else color = RED
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#333333', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 3}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.4s ease', maxWidth: '100%' }} />
      </div>
      <span style={{ fontSize: '0.78rem', color, minWidth: 40, textAlign: 'right' }}>{v.toFixed(2)}%</span>
    </div>
  )
}

function DeltaIndicator({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (Math.abs(value) < 0.01) return <span style={{ color: '#606060' }}>—</span>
  const positive = invert ? value < 0 : value > 0
  const color = positive ? TEAL : RED
  const arrow = positive ? '▲' : '▼'
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}

function SearchVisibilityScore({ queries }: { queries: QueryRow[] }) {
  const score = useMemo(() => {
    if (queries.length === 0) return 0
    let weighted = 0, maxPossible = 0
    for (const q of queries) {
      const posFactor = Math.max(0, 1 - (q.position - 1) / 50)
      weighted += q.impressions * posFactor
      maxPossible += q.impressions
    }
    return maxPossible > 0 ? Math.round((weighted / maxPossible) * 100) : 0
  }, [queries])

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference
  const scoreColor = score >= 60 ? TEAL : score >= 35 ? GOLD : RED

  return (
    <div className="glass-card animate-in" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.25rem' }}>Search Visibility Score</div>
      <div style={{ position: 'relative', width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="54" fill="none" stroke="#2A2A2A" strokeWidth="10" />
          <circle cx="64" cy="64" r="54" fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 64 64)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor }}>{score}</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'center', maxWidth: 200 }}>Weighted by impressions × position factor</div>
    </div>
  )
}

function QueryClusters({ queries }: { queries: QueryRow[] }) {
  const clusters = useMemo(() => {
    const map = new Map<string, { clicks: number; impressions: number; count: number }>()
    for (const q of queries) {
      const cluster = classifyQuery(q.query)
      const existing = map.get(cluster) || { clicks: 0, impressions: 0, count: 0 }
      existing.clicks += q.clicks
      existing.impressions += q.impressions
      existing.count++
      map.set(cluster, existing)
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).filter(c => c.name !== 'Other').sort((a, b) => b.clicks - a.clicks).slice(0, 8)
  }, [queries])

  if (clusters.length === 0) return null
  const colors = [NAVY, TEAL, PURPLE, GOLD, RED, '#6699ff', '#ff6b9d', '#66cccc']

  return (
    <div className="glass-card animate-in" style={{ padding: '1.25rem', borderRadius: '1rem', animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Search size={16} style={{ color: PURPLE }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Topic Clusters</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {clusters.map((c, i) => {
          const maxClicks = Math.max(...clusters.map(cl => cl.clicks), 1)
          const barPct = (c.clicks / maxClicks) * 100
          const color = colors[i % colors.length]
          return (
            <div key={c.name} style={{ padding: '1rem', borderRadius: '0.75rem', background: '#2A2A2A', border: '1px solid #2A2A2A', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: `${barPct}%`, height: 3, background: color, borderRadius: '0 0 0 0.75rem', transition: 'width 0.8s ease' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'white' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                <div><div style={{ color, fontWeight: 700, fontSize: '1rem' }}>{fmt(c.clicks)}</div><div style={{ opacity: 0.4, fontSize: '0.65rem' }}>clicks</div></div>
                <div><div style={{ color: 'white', fontWeight: 600, fontSize: '1rem' }}>{fmt(c.impressions)}</div><div style={{ opacity: 0.4, fontSize: '0.65rem' }}>impressions</div></div>
                <div><div style={{ color: '#9A9A9A', fontWeight: 600, fontSize: '1rem' }}>{c.count}</div><div style={{ opacity: 0.4, fontSize: '0.65rem' }}>queries</div></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CTRvsPosition({ queries }: { queries: QueryRow[] }) {
  const analysis = useMemo(() => {
    const buckets = [
      { label: '1–3', min: 0, max: 3.5, expectedCTR: 30 },
      { label: '4–10', min: 3.5, max: 10.5, expectedCTR: 8 },
      { label: '11–20', min: 10.5, max: 20.5, expectedCTR: 3 },
      { label: '20+', min: 20.5, max: 999, expectedCTR: 1 },
    ]
    return buckets.map(b => {
      const inBucket = queries.filter(q => q.position >= b.min && q.position < b.max)
      const avgCTR = inBucket.length > 0 ? inBucket.reduce((s, q) => s + q.ctr, 0) / inBucket.length : 0
      return { ...b, actualCTR: avgCTR, count: inBucket.length }
    })
  }, [queries])

  const maxCTR = Math.max(...analysis.map(a => Math.max(a.expectedCTR, a.actualCTR)), 1)

  return (
    <div className="glass-card animate-in" style={{ padding: '1.25rem', borderRadius: '1rem', animationDelay: '0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <BarChart3 size={16} style={{ color: TEAL }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>CTR vs Position</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {analysis.map(b => {
          const beating = b.actualCTR >= b.expectedCTR * 0.8
          const actW = Math.max(4, (b.actualCTR / maxCTR) * 100)
          const expW = Math.max(4, (b.expectedCTR / maxCTR) * 100)
          return (
            <div key={b.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', minWidth: 40 }}>Pos {b.label}</span>
                  <span style={{ fontSize: '0.7rem', color: '#707070' }}>{b.count.toLocaleString()} queries</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: beating ? TEAL : RED }}>{b.actualCTR.toFixed(1)}%</span>
                  <span style={{ fontSize: '0.65rem', color: '#606060' }}>/ {b.expectedCTR}% exp</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: '#2A2A2A' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${expW}%`, borderRadius: 4, background: '#333333', transition: 'width 0.8s ease' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${actW}%`, borderRadius: 4, background: beating ? TEAL : RED, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end', marginTop: '1rem', fontSize: '0.6rem', color: '#606060' }}>
        <span>▪ Expected</span><span>▪ Actual</span>
      </div>
    </div>
  )
}

function TrendingQueries({ queries }: { queries: QueryRow[] }) {
  const trending = useMemo(() => [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 8), [queries])
  if (trending.length === 0) return null
  return (
    <div className="glass-card animate-in" style={{ padding: '1.25rem', borderRadius: '1rem', animationDelay: '0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Flame size={16} style={{ color: RED }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Trending Queries</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>By impression volume</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {trending.map((q, i) => (
          <div key={q.query} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', borderRadius: '0.5rem', background: i < 3 ? '#EF444410' : '#2A2A2A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', opacity: 0.6, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span>{fmt(q.impressions)} imp</span>
              <span>{fmt(q.clicks)} clicks</span>
              <PositionBadge v={q.position} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickWins({ queries }: { queries: QueryRow[] }) {
  const wins = useMemo(() => {
    const candidates = queries.filter(q => q.position >= 4 && q.position <= 10 && q.impressions > 100)
    const avgCTR = candidates.length > 0 ? candidates.reduce((s, q) => s + q.ctr, 0) / candidates.length : 5
    return candidates.filter(q => q.ctr < avgCTR).map(q => {
      const potentialCTR = avgCTR * 1.5
      const estimatedGain = Math.round(q.impressions * (potentialCTR - q.ctr) / 100)
      return { ...q, estimatedGain, avgCTR }
    }).sort((a, b) => b.estimatedGain - a.estimatedGain).slice(0, 8)
  }, [queries])

  if (wins.length === 0) return null
  return (
    <div className="glass-card animate-in" style={{ padding: '1.25rem', borderRadius: '1rem', animationDelay: '0.4s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Zap size={16} style={{ color: GOLD }} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Quick Wins</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Improve title/meta for easy click gains</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {wins.map(q => (
          <div key={q.query} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', borderRadius: '0.5rem', background: '#F59E0B0d' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>Pos {q.position.toFixed(1)} · CTR {q.ctr.toFixed(2)}% · {fmt(q.impressions)} imp</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: TEAL, fontWeight: 600 }}>+{fmt(q.estimatedGain)} clicks</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PositionDistribution({ data }: { data: QueryRow[] }) {
  const buckets = useMemo(() => {
    const b = { top3: 0, top10: 0, top20: 0, rest: 0 }
    for (const r of data) {
      if (r.position <= 3) b.top3++
      else if (r.position <= 10) b.top10++
      else if (r.position <= 20) b.top20++
      else b.rest++
    }
    return b
  }, [data])

  const bars = [
    { label: '1–3', count: buckets.top3, color: TEAL },
    { label: '4–10', count: buckets.top10, color: NAVY },
    { label: '11–20', count: buckets.top20, color: GOLD },
    { label: '20+', count: buckets.rest, color: RED },
  ]
  const total = bars.reduce((s, b) => s + b.count, 0) || 1

  return (
    <div className="glass-card-static" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
      <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>Position Distribution</div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, marginBottom: '1rem' }}>
        {bars.map(b => (
          <div key={b.label} style={{ width: `${(b.count / total) * 100}%`, background: b.color, transition: 'width 0.8s ease', minWidth: b.count > 0 ? 20 : 0 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        {bars.map(b => (
          <div key={b.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: b.color }}>{b.count}</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{b.label}</div>
            <div style={{ fontSize: '0.6rem', opacity: 0.3 }}>{((b.count / total) * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, delta, delay = '0s' }: { icon: React.ReactNode; label: string; value: string; delta?: number; delay?: string }) {
  return (
    <div className="glass-card animate-in" style={{ padding: '1rem 1.25rem', borderRadius: '1rem', flex: '1 1 calc(50% - 0.5rem)', minWidth: 120, animationDelay: delay }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', opacity: 0.6, fontSize: '0.75rem' }}>
        {icon} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
        {delta !== undefined && <DeltaIndicator value={delta} suffix="%" />}
      </div>
    </div>
  )
}

// Supabase returns max 1000 rows per query. Paginate to fetch all.
async function fetchAllRows(table: string, startDate: string, endDate: string): Promise<any[]> {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return allData
}

function aggregateRows<T extends Record<string, any>>(raw: any[], groupKey: string): T[] {
  const map = new Map<string, { clicks: number; impressions: number; ctr_sum: number; pos_sum: number; count: number }>()
  for (const r of raw) {
    const key = r[groupKey]
    const existing = map.get(key)
    if (existing) {
      existing.clicks += r.clicks || 0
      existing.impressions += r.impressions || 0
      existing.ctr_sum += r.ctr || 0
      existing.pos_sum += r.position || 0
      existing.count++
    } else {
      map.set(key, { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr_sum: r.ctr || 0, pos_sum: r.position || 0, count: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({
      [groupKey]: k,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: (v.ctr_sum / v.count) * 100,
      position: v.pos_sum / v.count,
    } as unknown as T))
    .sort((a: any, b: any) => b.clicks - a.clicks)
}

// --- Folder Filter ---
function FolderFilter({ pages, selectedFolders, onToggle, onClear }: {
  pages: PageRow[]
  selectedFolders: string[]
  onToggle: (folder: string) => void
  onClear: () => void
}) {
  const folders = useMemo(() => {
    const known = ['/credit-cards/', '/qantas/', '/velocity/', '/amex/', '/guides/']
    const detected = new Set<string>()
    for (const p of pages) {
      const path = p.page.replace(/^https?:\/\/[^/]+/, '')
      const parts = path.split('/').filter(Boolean)
      if (parts.length > 0) detected.add('/' + parts[0] + '/')
    }
    const all = [...new Set([...known, ...detected])].sort()
    return all.map(f => ({ folder: f, count: pages.filter(p => p.page.replace(/^https?:\/\/[^/]+/, '').startsWith(f)).length })).filter(f => f.count > 0)
  }, [pages])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      <Filter size={14} style={{ color: '#606060' }} />
      <button
        onClick={onClear}
        style={{
          padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${selectedFolders.length === 0 ? '#34D39940' : '#383838'}`,
          background: selectedFolders.length === 0 ? '#34D39915' : 'transparent', color: selectedFolders.length === 0 ? TEAL : '#8C8C8C',
        }}
      >
        All Pages
      </button>
      {folders.map(f => {
        const active = selectedFolders.includes(f.folder)
        return (
          <button
            key={f.folder}
            onClick={() => onToggle(f.folder)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${active ? '#6366f140' : '#383838'}`,
              background: active ? '#6366f120' : 'transparent',
              color: active ? '#818cf8' : '#8C8C8C',
            }}
          >
            {f.folder} <span style={{ opacity: 0.5 }}>({f.count})</span>
          </button>
        )
      })}
      {selectedFolders.length > 0 && (
        <span style={{ fontSize: '0.7rem', color: '#606060' }}>
          {pages.filter(p => selectedFolders.some(f => p.page.replace(/^https?:\/\/[^/]+/, '').startsWith(f))).length} pages matched
        </span>
      )}
    </div>
  )
}

// --- Fluctuations Section ---
function FluctuationsSection({ pages, comparePages, queries, compareQueries, selectedFolders }: {
  pages: PageRow[]
  comparePages: PageRow[]
  queries: QueryRow[]
  compareQueries: QueryRow[]
  selectedFolders: string[]
}) {
  const filterPage = (p: { page: string }) => selectedFolders.length === 0 || selectedFolders.some(f => p.page.replace(/^https?:\/\/[^/]+/, '').startsWith(f))

  const pageFluctuations = useMemo(() => {
    const currentMap = new Map<string, PageRow>()
    const prevMap = new Map<string, PageRow>()
    for (const p of pages.filter(filterPage)) currentMap.set(p.page, p)
    for (const p of comparePages.filter(filterPage)) prevMap.set(p.page, p)

    const rows: { page: string; currentPos: number; prevPos: number; posDelta: number; currentClicks: number; prevClicks: number; clicksDelta: number; currentImpressions: number; prevImpressions: number; impressionsDelta: number; currentCtr: number; prevCtr: number; ctrDelta: number; absChange: number }[] = []

    const allPages = new Set([...currentMap.keys(), ...prevMap.keys()])
    for (const page of allPages) {
      const curr = currentMap.get(page)
      const prev = prevMap.get(page)
      if (!curr && !prev) continue
      const currentPos = curr?.position ?? 100
      const prevPos = prev?.position ?? 100
      const currentClicks = curr?.clicks ?? 0
      const prevClicks = prev?.clicks ?? 0
      const currentImpressions = curr?.impressions ?? 0
      const prevImpressions = prev?.impressions ?? 0
      const currentCtr = curr?.ctr ?? 0
      const prevCtr = prev?.ctr ?? 0
      rows.push({
        page,
        currentPos, prevPos, posDelta: prevPos - currentPos,
        currentClicks, prevClicks, clicksDelta: currentClicks - prevClicks,
        currentImpressions, prevImpressions, impressionsDelta: currentImpressions - prevImpressions,
        currentCtr, prevCtr, ctrDelta: currentCtr - prevCtr,
        absChange: Math.abs(prevPos - currentPos),
      })
    }
    return rows.sort((a, b) => b.absChange - a.absChange)
  }, [pages, comparePages, selectedFolders])

  const improved = pageFluctuations.filter(p => p.posDelta > 0.5).length
  const declined = pageFluctuations.filter(p => p.posDelta < -0.5).length
  const biggestWinner = pageFluctuations.find(p => p.posDelta > 0)
  const biggestLoser = [...pageFluctuations].sort((a, b) => a.posDelta - b.posDelta).find(p => p.posDelta < 0)

  const cleanUrl = (url: string) => url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'

  if (pages.length === 0 || comparePages.length === 0) {
    return (
      <div className="glass-card-static" style={{ padding: '3rem', textAlign: 'center' }}>
        <Activity size={32} style={{ color: '#383838', margin: '0 auto 1rem' }} />
        <p style={{ color: '#8A8A8A' }}>Enable comparison to see fluctuations between periods</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#8C8C8C', marginBottom: 4 }}>Position Movers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            <span style={{ color: TEAL }}>{improved}</span>
            <span style={{ color: '#606060' }}> / </span>
            <span style={{ color: RED }}>{declined}</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#606060' }}>improved / declined</div>
        </div>
        {biggestWinner && (
          <div className="glass-card" style={{ padding: '1rem', borderLeft: `3px solid ${TEAL}` }}>
            <div style={{ fontSize: '0.75rem', color: TEAL, marginBottom: 4 }}>Biggest Winner</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanUrl(biggestWinner.page)}</div>
            <div style={{ fontSize: '0.7rem', color: TEAL }}>▲ {biggestWinner.posDelta.toFixed(1)} positions</div>
          </div>
        )}
        {biggestLoser && (
          <div className="glass-card" style={{ padding: '1rem', borderLeft: `3px solid ${RED}` }}>
            <div style={{ fontSize: '0.75rem', color: RED, marginBottom: 4 }}>Biggest Loser</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanUrl(biggestLoser.page)}</div>
            <div style={{ fontSize: '0.7rem', color: RED }}>▼ {Math.abs(biggestLoser.posDelta).toFixed(1)} positions</div>
          </div>
        )}
      </div>

      {/* Position movers table */}
      <div className="glass-card-static" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #333333' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} style={{ color: PURPLE }} /> Position Movers
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Page</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Current Pos</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Previous Pos</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Position Δ</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Clicks Δ</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Impressions Δ</th>
                <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>CTR Δ</th>
              </tr>
            </thead>
            <tbody>
              {pageFluctuations.slice(0, 30).map(row => (
                <tr key={row.page}>
                  <td style={{ padding: '0.6rem 1rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.82rem' }}>{cleanUrl(row.page)}</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}><PositionBadge v={row.currentPos} /></td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem', color: '#8C8C8C', fontSize: '0.82rem' }}>{row.prevPos.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>
                    <DeltaIndicator value={row.posDelta} invert />
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>
                    <DeltaIndicator value={row.clicksDelta} />
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>
                    <DeltaIndicator value={row.impressionsDelta} />
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>
                    <DeltaIndicator value={row.ctrDelta} suffix="%" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  const { dateRange } = useDateRange()
  const [tab, setTab] = useState<Tab>('queries')
  const [queries, setQueries] = useState<QueryRow[]>([])
  const [pages, setPages] = useState<PageRow[]>([])
  const [compareQueries, setCompareQueries] = useState<QueryRow[]>([])
  const [comparePages, setComparePages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])

  const { startDate, endDate, compareEnabled, compareStartDate, compareEndDate } = dateRange

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [qRaw, pRaw] = await Promise.all([
          fetchAllRows('gsc_queries', startDate, endDate),
          fetchAllRows('gsc_pages', startDate, endDate),
        ])
        setQueries(aggregateRows<QueryRow>(qRaw, 'query'))
        setPages(aggregateRows<PageRow>(pRaw, 'page'))

        if (compareEnabled) {
          const [cqRaw, cpRaw] = await Promise.all([
            fetchAllRows('gsc_queries', compareStartDate, compareEndDate),
            fetchAllRows('gsc_pages', compareStartDate, compareEndDate),
          ])
          setCompareQueries(aggregateRows<QueryRow>(cqRaw, 'query'))
          setComparePages(aggregateRows<PageRow>(cpRaw, 'page'))
        } else {
          setCompareQueries([])
          setComparePages([])
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [startDate, endDate, compareEnabled, compareStartDate, compareEndDate])

  // Folder-filtered pages
  const filteredPages = useMemo(() => {
    if (selectedFolders.length === 0) return pages
    return pages.filter(p => selectedFolders.some(f => p.page.replace(/^https?:\/\/[^/]+/, '').startsWith(f)))
  }, [pages, selectedFolders])

  const compareMap = useMemo(() => {
    const qMap = new Map<string, QueryRow>()
    const pMap = new Map<string, PageRow>()
    for (const q of compareQueries) qMap.set(q.query, q)
    for (const p of comparePages) pMap.set(p.page, p)
    return { queries: qMap, pages: pMap }
  }, [compareQueries, comparePages])

  const cleanUrl = (url: string): { path: string; label: string } => {
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
    const label = path === '/' ? 'Homepage' : path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || path
    return { path, label }
  }

  const queryCols = useMemo(() => {
    const cols: any[] = [
      { key: 'query', label: 'Query', format: (v: string) => <span>{v}</span> },
      { key: 'clicks', label: 'Clicks', sortable: true, format: (v: number) => fmt(v) },
      { key: 'impressions', label: 'Impressions', sortable: true, format: (v: number) => fmt(v) },
      { key: 'ctr', label: 'CTR', sortable: true, format: (v: number) => <CTRBar v={v} /> },
      { key: 'position', label: 'Avg Position', sortable: true, format: (v: number) => <PositionBadge v={v} /> },
    ]
    if (compareEnabled) {
      cols.push({
        key: '_clicksDelta', label: 'Clicks Δ', sortable: true,
        format: (_: any, row: any) => {
          const prev = compareMap.queries.get(row.query)
          if (!prev) return <span style={{ color: '#606060' }}>New</span>
          return <DeltaIndicator value={row.clicks - prev.clicks} />
        }
      })
      cols.push({
        key: '_posDelta', label: 'Pos Δ', sortable: true,
        format: (_: any, row: any) => {
          const prev = compareMap.queries.get(row.query)
          if (!prev) return <span style={{ color: '#606060' }}>—</span>
          return <DeltaIndicator value={prev.position - row.position} invert />
        }
      })
    }
    return cols
  }, [compareEnabled, compareMap])

  const pageCols = useMemo(() => {
    const cols: any[] = [
      {
        key: 'page', label: 'Page', format: (v: string) => {
          const { path, label } = cleanUrl(v)
          return (
            <div style={{ maxWidth: 360 }}>
              <div style={{ fontWeight: 600, color: 'white', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</div>
            </div>
          )
        }
      },
      {
        key: 'clicks', label: 'Clicks', sortable: true, format: (v: number) => {
          const maxClicks = Math.max(...filteredPages.map(p => p.clicks), 1)
          const pct = (v / maxClicks) * 100
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#2A2A2A', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: TEAL, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', minWidth: 48, textAlign: 'right' }}>{fmt(v)}</span>
            </div>
          )
        }
      },
      { key: 'impressions', label: 'Impressions', sortable: true, format: (v: number) => <span style={{ opacity: 0.7 }}>{fmt(v)}</span> },
      { key: 'ctr', label: 'CTR', sortable: true, format: (v: number) => <CTRBar v={v} /> },
      { key: 'position', label: 'Position', sortable: true, format: (v: number) => <PositionBadge v={v} /> },
    ]
    if (compareEnabled) {
      cols.push({
        key: '_clicksDelta', label: 'Clicks Δ', sortable: true,
        format: (_: any, row: any) => {
          const prev = compareMap.pages.get(row.page)
          if (!prev) return <span style={{ color: '#606060' }}>New</span>
          return <DeltaIndicator value={row.clicks - prev.clicks} />
        }
      })
      cols.push({
        key: '_posDelta', label: 'Pos Δ', sortable: true,
        format: (_: any, row: any) => {
          const prev = compareMap.pages.get(row.page)
          if (!prev) return <span style={{ color: '#606060' }}>—</span>
          return <DeltaIndicator value={prev.position - row.position} invert />
        }
      })
    }
    return cols
  }, [filteredPages, compareEnabled, compareMap])

  const kpis = useMemo(() => {
    const d = tab === 'queries' ? queries : filteredPages
    const totalClicks = d.reduce((s, r) => s + r.clicks, 0)
    const totalImpressions = d.reduce((s, r) => s + r.impressions, 0)
    const avgCTR = d.length > 0 ? d.reduce((s, r) => s + r.ctr, 0) / d.length : 0
    const avgPos = d.length > 0 ? d.reduce((s, r) => s + r.position, 0) / d.length : 0

    let clicksDelta: number | undefined
    let impressionsDelta: number | undefined
    let ctrDelta: number | undefined
    let posDelta: number | undefined

    if (compareEnabled) {
      const cd = tab === 'queries' ? compareQueries : comparePages
      const prevClicks = cd.reduce((s, r) => s + r.clicks, 0)
      const prevImpressions = cd.reduce((s, r) => s + r.impressions, 0)
      const prevAvgCTR = cd.length > 0 ? cd.reduce((s, r) => s + r.ctr, 0) / cd.length : 0
      const prevAvgPos = cd.length > 0 ? cd.reduce((s, r) => s + r.position, 0) / cd.length : 0
      clicksDelta = prevClicks > 0 ? ((totalClicks - prevClicks) / prevClicks) * 100 : 0
      impressionsDelta = prevImpressions > 0 ? ((totalImpressions - prevImpressions) / prevImpressions) * 100 : 0
      ctrDelta = avgCTR - prevAvgCTR
      posDelta = prevAvgPos - avgPos
    }

    return { totalClicks, totalImpressions, avgCTR, avgPos, clicksDelta, impressionsDelta, ctrDelta, posDelta }
  }, [queries, filteredPages, compareQueries, comparePages, tab, compareEnabled])

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => prev.includes(folder) ? prev.filter(f => f !== folder) : [...prev, folder])
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Search &amp; SEO</h1>
      <p style={{ opacity: 0.6, marginBottom: '1rem' }}>Google Search Console data</p>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {([
          { key: 'queries' as Tab, label: 'Queries', icon: Search, count: queries.length },
          { key: 'pages' as Tab, label: 'Pages', icon: Eye, count: filteredPages.length },
          { key: 'fluctuations' as Tab, label: 'Fluctuations', icon: Activity, count: 0 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', minHeight: 44,
              borderRadius: '0.75rem', border: `1px solid ${tab === t.key ? '#6366f150' : '#333333'}`,
              background: tab === t.key ? '#6366f130' : '#2A2A2A', color: tab === t.key ? 'white' : '#8A8A8A',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: tab === t.key ? 600 : 400, transition: 'all 0.2s ease',
            }}
          >
            <t.icon size={15} />
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 999, background: tab === t.key ? '#34D39933' : '#2A2A2A', color: tab === t.key ? TEAL : '#606060', fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KPI Bar */}
      {!loading && tab !== 'fluctuations' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <KPICard icon={<MousePointerClick size={14} />} label="Total Clicks" value={fmt(kpis.totalClicks)} delta={kpis.clicksDelta} delay="0s" />
          <KPICard icon={<Eye size={14} />} label="Total Impressions" value={fmt(kpis.totalImpressions)} delta={kpis.impressionsDelta} delay="0.05s" />
          <KPICard icon={<TrendingUp size={14} />} label="Avg CTR" value={`${kpis.avgCTR.toFixed(2)}%`} delta={kpis.ctrDelta} delay="0.1s" />
          <KPICard icon={<Target size={14} />} label="Avg Position" value={kpis.avgPos.toFixed(1)} delta={kpis.posDelta} delay="0.15s" />
        </div>
      )}

      {/* Query-specific panels */}
      {!loading && tab === 'queries' && (
        <>
          <div className="search-top-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
            <style>{`.search-top-grid { grid-template-columns: 1fr; } @media (min-width: 768px) { .search-top-grid { grid-template-columns: 200px 1fr 1.2fr; } }`}</style>
            <SearchVisibilityScore queries={queries} />
            <PositionDistribution data={queries} />
            <CTRvsPosition queries={queries} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}><QueryClusters queries={queries} /></div>
          <div className="search-two-col" style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
            <style>{`.search-two-col { grid-template-columns: 1fr; } @media (min-width: 768px) { .search-two-col { grid-template-columns: 1fr 1fr; } }`}</style>
            <TrendingQueries queries={queries} />
            <QuickWins queries={queries} />
          </div>
        </>
      )}

      {/* Pages-specific analysis */}
      {!loading && tab === 'pages' && (() => {
        const topPages = [...filteredPages].sort((a, b) => b.clicks - a.clicks).slice(0, 5)
        const totalClicks = filteredPages.reduce((s, p) => s + p.clicks, 0)
        const top5Clicks = topPages.reduce((s, p) => s + p.clicks, 0)
        const top5Pct = totalClicks > 0 ? (top5Clicks / totalClicks * 100).toFixed(0) : '0'
        const lowCtrPages = filteredPages.filter(p => p.ctr < 1 && p.impressions > 5000).length

        return (
          <>
            {/* Folder Filter */}
            <FolderFilter pages={pages} selectedFolders={selectedFolders} onToggle={toggleFolder} onClear={() => setSelectedFolders([])} />

            <div className="search-two-col" style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="glass-card-static" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={16} style={{ color: TEAL }} /> Top Pages by Clicks
                </div>
                {topPages.map((p, i) => {
                  const { label } = cleanUrl(p.page)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < 4 ? '1px solid #2A2A2A' : 'none' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: TEAL, width: 18 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{fmt(p.clicks)}</span>
                    </div>
                  )
                })}
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: '#34D39910', fontSize: '0.72rem', color: TEAL }}>
                  Top 5 pages drive <strong>{top5Pct}%</strong> of all search clicks
                </div>
              </div>

              <div className="glass-card-static" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target size={16} style={{ color: GOLD }} /> Page Insights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 8, background: '#2A2A2A' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{filteredPages.length}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Total pages in search</div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: 8, background: '#2A2A2A' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: TEAL }}>{filteredPages.filter(p => p.position <= 10).length}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Pages in top 10</div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: 8, background: '#2A2A2A' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: GOLD }}>{filteredPages.filter(p => p.position > 10 && p.position <= 20).length}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Striking distance (11-20)</div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: 8, background: lowCtrPages > 0 ? '#EF444410' : '#2A2A2A' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lowCtrPages > 0 ? RED : 'white' }}>{lowCtrPages}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Low CTR, high impressions</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* Fluctuations tab */}
      {!loading && tab === 'fluctuations' && (
        <>
          <FolderFilter pages={pages} selectedFolders={selectedFolders} onToggle={toggleFolder} onClear={() => setSelectedFolders([])} />
          <FluctuationsSection pages={filteredPages} comparePages={comparePages} queries={queries} compareQueries={compareQueries} selectedFolders={selectedFolders} />
        </>
      )}

      {loading ? (
        <p style={{ opacity: 0.5 }}>Loading…</p>
      ) : tab === 'queries' ? (
        <DataTable columns={queryCols} data={queries} searchKeys={['query']} pageSize={20} />
      ) : tab === 'pages' ? (
        <DataTable columns={pageCols} data={filteredPages} searchKeys={['page']} pageSize={20} />
      ) : null}
    </div>
  )
}
