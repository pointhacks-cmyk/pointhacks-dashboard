'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SyncStatusProps {
  syncs: Array<{ source: string; status: string; completed_at: string; records_synced: number }>
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  running: '#eab308',
  failed: '#ef4444',
  pending: '#9ca3af',
}

function relativeTime(dateStr: string) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 30) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function SyncStatus({ syncs: initialSyncs }: SyncStatusProps) {
  const [syncs, setSyncs] = useState(initialSyncs)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data } = await supabase.from('data_syncs').select('*').order('completed_at', { ascending: false }).limit(5)
      if (data) setSyncs(data as any)
    } finally {
      setRefreshing(false)
    }
  }, [])

  return (
    <div className="glass-card p-6 animate-in" style={{ animationDelay: '800ms', animationFillMode: 'both' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Data Sync Status</h3>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-secondary hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-3">
        {syncs.map((s) => (
          <div key={s.source}>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${s.status === 'running' ? 'animate-pulse' : ''}`}
                  style={{ background: STATUS_COLORS[s.status] || STATUS_COLORS.pending }}
                />
                <span className="text-white">{s.source}</span>
              </div>
              <div className="flex items-center gap-4 text-secondary text-xs">
                <span>{s.records_synced.toLocaleString()} records</span>
                <span>{relativeTime(s.completed_at)}</span>
              </div>
            </div>
            {s.status === 'running' && (
              <div className="mt-1 ml-4 h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-yellow-500/60 animate-indeterminate" />
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 40%; }
          50% { width: 60%; }
          100% { transform: translateX(250%); width: 40%; }
        }
        .animate-indeterminate {
          animation: indeterminate 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
