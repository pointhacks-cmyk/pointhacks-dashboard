'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquarePlus, MessageSquare, BarChart3, Search, TrendingUp, AlertTriangle, FileText, Globe, Activity, Zap, Clock, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ChatInterface from '@/components/ChatInterface'

interface WelcomeStats {
  totalSessions: number
  topKeyword: string
  topKeywordClicks: number
  topPage: string
  trafficTrend: number
}

interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatThread {
  id: string
  title: string
  messages: StoredMessage[]
  history: { role: string; content: string }[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'ph-chat-threads'

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

function saveThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  } catch {}
}

function timeLabel(d: string): string {
  const now = new Date()
  const date = new Date(d)
  const diff = now.getTime() - date.getTime()
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff/60000))}m ago`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
  if (diff < 172800000) return 'Yesterday'
  return `${Math.floor(diff/86400000)}d ago`
}

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [welcomeStats, setWelcomeStats] = useState<WelcomeStats | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Key to force ChatInterface remount on thread switch
  const [chatKey, setChatKey] = useState(0)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadThreads()
    if (stored.length > 0) {
      setThreads(stored)
      setActiveThreadId(stored[0].id)
    }
    setLoaded(true)
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    if (loaded) saveThreads(threads)
  }, [threads, loaded])

  // Load welcome stats
  useEffect(() => {
    async function loadStats() {
      try {
        const [dailyRes, gscRes, pagesRes] = await Promise.all([
          supabase.from('ga4_daily').select('date, sessions').order('date', { ascending: false }).limit(14),
          supabase.from('gsc_queries').select('query, clicks, impressions, position').order('clicks', { ascending: false }).limit(1),
          supabase.from('ga4_pages').select('page_path, sessions').order('sessions', { ascending: false }).limit(1),
        ])
        const daily = dailyRes.data || []
        const thisWeek = daily.slice(0, 7).reduce((s: number, d: any) => s + (d.sessions || 0), 0)
        const lastWeek = daily.slice(7, 14).reduce((s: number, d: any) => s + (d.sessions || 0), 0)
        const trend = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0
        setWelcomeStats({
          totalSessions: thisWeek,
          topKeyword: gscRes.data?.[0]?.query || 'point hacks',
          topKeywordClicks: gscRes.data?.[0]?.clicks || 0,
          topPage: pagesRes.data?.[0]?.page_path || '/',
          trafficTrend: Math.round(trend),
        })
      } catch {}
    }
    loadStats()
  }, [])

  const createThread = useCallback(() => {
    const id = `thread-${Date.now()}`
    const thread: ChatThread = {
      id,
      title: 'New conversation',
      messages: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setThreads(prev => [thread, ...prev])
    setActiveThreadId(id)
    setChatKey(k => k + 1)
    return id
  }, [])

  // Create initial thread if none exist
  useEffect(() => {
    if (loaded && threads.length === 0) createThread()
  }, [loaded, threads.length, createThread])

  const deleteThread = useCallback((threadId: string) => {
    setThreads(prev => {
      const updated = prev.filter(t => t.id !== threadId)
      if (activeThreadId === threadId) {
        if (updated.length > 0) {
          setActiveThreadId(updated[0].id)
          setChatKey(k => k + 1)
        } else {
          setActiveThreadId(null)
        }
      }
      return updated
    })
  }, [activeThreadId])

  const switchThread = useCallback((threadId: string) => {
    if (threadId !== activeThreadId) {
      setActiveThreadId(threadId)
      setChatKey(k => k + 1)
    }
  }, [activeThreadId])

  const handleMessagesChange = useCallback((messages: any[], history: { role: string; content: string }[]) => {
    setThreads(prev => prev.map(t => {
      if (t.id !== activeThreadId) return t
      return {
        ...t,
        messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp })),
        history,
        updatedAt: new Date().toISOString(),
      }
    }))
  }, [activeThreadId])

  const handleTitleUpdate = useCallback((title: string) => {
    setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, title } : t))
  }, [activeThreadId])

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0]

  if (!loaded) return null

  return (
    <div className="flex gap-0 h-[calc(100vh-120px)]">
      {/* Left Panel */}
      <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: '1px solid #2A2A2A' }}>
        {/* New Chat Button */}
        <div className="p-4 pb-3">
          <button
            onClick={createThread}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#6366f1', boxShadow: '0 4px 16px #6366f140' }}
          >
            <MessageSquarePlus size={16} />
            New Chat
          </button>
        </div>

        {/* Dashboard Insights Panel */}
        <div className="px-4 pb-3">
          <div className="rounded-xl p-3" style={{ background: '#34D39910', border: '1px solid #34D3991a' }}>
            <div className="text-[10px] uppercase tracking-wider text-[#34D399] font-semibold mb-2 flex items-center gap-1">
              <Zap size={10} /> Live Snapshot
            </div>
            {welcomeStats && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Sessions (7d)</span>
                  <span className="text-white font-medium">{welcomeStats.totalSessions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Trend</span>
                  <span className={welcomeStats.trafficTrend >= 0 ? 'text-green-400' : 'text-red-400'} style={{fontWeight:600}}>
                    {welcomeStats.trafficTrend >= 0 ? '+' : ''}{welcomeStats.trafficTrend}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Top keyword</span>
                  <span className="text-white font-medium truncate ml-2 max-w-[120px]">{welcomeStats.topKeyword}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Queries */}
        <div className="px-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-2 px-1">Ask About</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { icon: BarChart3, label: 'Traffic', query: 'Give me a full traffic report for this week', color: '#6366f1' },
              { icon: Search, label: 'Keywords', query: 'Analyze my top performing keywords', color: '#34D399' },
              { icon: FileText, label: 'Pages', query: 'Which pages perform best?', color: '#8B5CF6' },
              { icon: AlertTriangle, label: 'Issues', query: 'Show me any issues or declining metrics', color: '#EF4444' },
              { icon: Globe, label: 'SEO', query: 'Show keyword opportunities', color: '#F59E0B' },
              { icon: TrendingUp, label: 'Trends', query: 'Compare this week vs last week', color: '#6366f1' },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  const ev = new CustomEvent('chat-submit', { detail: a.query })
                  window.dispatchEvent(ev)
                }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] text-secondary hover:text-white transition-all"
                style={{ background: '#2A2A2A', border: '1px solid #2A2A2A' }}
              >
                <a.icon size={12} style={{ color: a.color }} />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-2 px-1">History</p>
          <div className="space-y-0.5">
            {threads.map((t) => (
              <div
                key={t.id}
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all group/thread cursor-pointer"
                style={{
                  background: activeThreadId === t.id ? '#6366f130' : 'transparent',
                  borderLeft: activeThreadId === t.id ? '2px solid #6366f1' : '2px solid transparent',
                }}
                onClick={() => switchThread(t.id)}
              >
                <MessageSquare size={14} className="shrink-0 opacity-40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs" style={{ color: activeThreadId === t.id ? 'white' : '#8C8C8C' }}>{t.title}</p>
                  <p className="text-[10px] text-white/25">{timeLabel(t.updatedAt || t.createdAt)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteThread(t.id) }}
                  className="shrink-0 p-1 rounded opacity-0 group-hover/thread:opacity-60 hover:!opacity-100 hover:bg-white/10 transition-all"
                  title="Delete thread"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-2" style={{ borderTop: '1px solid #2A2A2A' }}>
          <div className="flex items-center gap-2 text-[10px] text-white/25">
            <Activity size={10} />
            <span>Powered by Point Hacks</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thread Header */}
        <div className="px-6 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #2A2A2A' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6366f1' }}>
            <MessageSquare size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{activeThread?.title || 'New conversation'}</h2>
            <p className="text-[10px] text-white/30">Ask about traffic, keywords, pages, revenue, or technical metrics</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-white/20">
            <Clock size={10} />
            {activeThread ? timeLabel(activeThread.updatedAt || activeThread.createdAt) : ''}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          {activeThread && (
            <ChatInterface
              key={chatKey}
              welcomeStats={welcomeStats}
              onTitleUpdate={handleTitleUpdate}
              initialMessages={activeThread.messages.length > 0 ? activeThread.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) : undefined}
              initialHistory={activeThread.history}
              onMessagesChange={handleMessagesChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
