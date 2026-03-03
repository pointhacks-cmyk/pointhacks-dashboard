'use client'

import { useState, useEffect, useCallback } from 'react'
import { Newspaper, RefreshCw, X, Filter } from 'lucide-react'

interface Story {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  timeAgo: string
  snippet: string
  score: number
  category: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

interface NewsData {
  stories: Story[]
  fetchedAt: string
  sourceCount: number
  scoredCount: number
}

const CATEGORIES = ['All', 'Credit Cards', 'Airlines', 'Loyalty Programs', 'Travel Deals', 'Competitor', 'Industry', 'Other']
const PRIORITIES = ['All', '🔥 High (8+)', 'Medium (5-7)']
const SOURCES = ['All Sources', 'Google News', 'Executive Traveller', 'Australian Business Traveller', 'Reddit']

const CATEGORY_COLORS: Record<string, string> = {
  'Credit Cards': '#8B5CF6',
  'Airlines': '#3B82F6',
  'Loyalty Programs': '#F59E0B',
  'Travel Deals': '#34D399',
  'Competitor': '#EF4444',
  'Industry': '#6B7280',
  'Other': '#6B7280',
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? '#34D399' : score >= 5 ? '#F59E0B' : '#606060'
  return (
    <div style={{
      minWidth: 48, height: 48, borderRadius: 12,
      background: `${color}18`, border: `2px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 800, color,
      flexShrink: 0,
    }}>
      {score >= 8 && '🔥'}{score}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#2A2A2A', border: '1px solid #383838', borderRadius: 14,
      padding: 20, display: 'flex', gap: 16, animation: 'pulse 1.5s infinite',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#383838' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 16, background: '#383838', borderRadius: 8, width: '70%' }} />
        <div style={{ height: 12, background: '#383838', borderRadius: 8, width: '40%' }} />
        <div style={{ height: 12, background: '#383838', borderRadius: 8, width: '90%' }} />
      </div>
    </div>
  )
}

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('All')
  const [priority, setPriority] = useState('All')
  const [source, setSource] = useState('All Sources')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ph-news-dismissed')
    if (stored) setDismissed(new Set(JSON.parse(stored)))
  }, [])

  const fetchNews = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetch(`/api/news${refresh ? '?refresh=1' : ''}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load news. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchNews() }, [fetchNews])

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem('ph-news-dismissed', JSON.stringify([...next]))
  }

  const filtered = (data?.stories || []).filter(s => {
    if (dismissed.has(s.id)) return false
    if (category !== 'All' && s.category !== category) return false
    if (priority === '🔥 High (8+)' && s.score < 8) return false
    if (priority === 'Medium (5-7)' && (s.score < 5 || s.score > 7)) return false
    if (source !== 'All Sources') {
      if (source === 'Reddit' && !s.source.startsWith('Reddit')) return false
      if (source !== 'Reddit' && s.source !== source && !s.source.includes(source.split(' ')[0])) return false
    }
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', color: 'white' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Newspaper size={24} color="#34D399" />
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>News Scanner</h1>
            </div>
            <p style={{ fontSize: 13, color: '#707070', margin: 0 }}>
              Travel &amp; points news scored for Point Hacks relevance
            </p>
            {data && (
              <p style={{ fontSize: 11, color: '#505050', margin: '4px 0 0' }}>
                Last scanned: {new Date(data.fetchedAt).toLocaleTimeString()} · {data.scoredCount} stories from {data.sourceCount} sources
              </p>
            )}
          </div>
          <button
            onClick={() => fetchNews(true)}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              background: '#2A2A2A', border: '1px solid #383838',
              color: '#ECECEC', fontSize: 13, fontWeight: 600,
              cursor: refreshing ? 'wait' : 'pointer',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div style={{
          background: '#2A2A2A', border: '1px solid #383838', borderRadius: 14,
          padding: '14px 16px', marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Category pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: category === c ? '#34D39925' : '#383838',
                color: category === c ? '#34D399' : '#8C8C8C',
              }}>
                {c}
              </button>
            ))}
          </div>
          {/* Priority + Source */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setPriority(p)} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: priority === p ? '#F59E0B25' : '#383838',
                  color: priority === p ? '#F59E0B' : '#8C8C8C',
                }}>
                  {p}
                </button>
              ))}
            </div>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              style={{
                padding: '5px 12px', borderRadius: 10,
                background: '#383838', border: 'none',
                color: '#8C8C8C', fontSize: 12, cursor: 'pointer',
              }}
            >
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div style={{
            background: '#2A2A2A', border: '1px solid #EF444440', borderRadius: 14,
            padding: 40, textAlign: 'center',
          }}>
            <p style={{ color: '#EF4444', fontSize: 15, fontWeight: 600 }}>{error}</p>
            <button onClick={() => fetchNews()} style={{
              marginTop: 12, padding: '8px 20px', borderRadius: 10,
              background: '#383838', border: 'none', color: '#ECECEC',
              fontSize: 13, cursor: 'pointer',
            }}>
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#2A2A2A', border: '1px solid #383838', borderRadius: 14,
            padding: 60, textAlign: 'center',
          }}>
            <Filter size={32} color="#505050" style={{ marginBottom: 12 }} />
            <p style={{ color: '#606060', fontSize: 15 }}>No stories match your filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(story => (
              <div key={story.id} style={{
                background: '#2A2A2A', border: '1px solid #383838', borderRadius: 14,
                padding: 18, display: 'flex', gap: 14,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#505050')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#383838')}
              >
                <ScoreBadge score={story.score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 15, fontWeight: 700, color: '#ECECEC',
                      textDecoration: 'none', lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#34D399')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#ECECEC')}
                  >
                    {story.title}
                  </a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#707070' }}>
                      {story.source} · {story.timeAgo}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                      background: `${CATEGORY_COLORS[story.category] || '#6B7280'}20`,
                      color: CATEGORY_COLORS[story.category] || '#6B7280',
                    }}>
                      {story.category}
                    </span>
                  </div>
                  {story.why && (
                    <p style={{ fontSize: 12, color: '#606060', margin: '6px 0 0', lineHeight: 1.4, fontStyle: 'italic' }}>
                      {story.why}
                    </p>
                  )}
                  {story.snippet && (
                    <p style={{
                      fontSize: 12, color: '#505050', margin: '4px 0 0', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {story.snippet}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(story.id)}
                  title="Dismiss"
                  style={{
                    alignSelf: 'flex-start', background: 'transparent', border: 'none',
                    color: '#505050', cursor: 'pointer', padding: 4, borderRadius: 6,
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#8C8C8C')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#505050')}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
