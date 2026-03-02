'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Database, Globe, BarChart3, Search, Key, RefreshCw, CheckCircle, XCircle, Clock, Users, Shield, Zap } from 'lucide-react'

const TEAL = '#34D399', RED = '#EF4444', NAVY = '#6366f1', GOLD = '#F59E0B', PURPLE = '#8B5CF6'

interface ConnectionStatus {
  name: string
  icon: typeof Database
  status: 'connected' | 'partial' | 'disconnected'
  detail: string
  color: string
  lastSync?: string
  rows?: number
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    async function checkConnections() {
      try {
      // Check each data source
      const [gscQ, gscP, ga4D, ga4Pg, ga4Src, seoKw] = await Promise.all([
        supabase.from('gsc_queries').select('date', { count: 'exact', head: true }),
        supabase.from('gsc_pages').select('date', { count: 'exact', head: true }),
        supabase.from('ga4_daily').select('date', { count: 'exact', head: true }),
        supabase.from('ga4_pages').select('page_path', { count: 'exact', head: true }),
        supabase.from('ga4_traffic_sources').select('source', { count: 'exact', head: true }),
        supabase.from('seo_keywords').select('keyword', { count: 'exact', head: true }),
      ])

      // Get latest dates
      const { data: latestGsc } = await supabase.from('gsc_queries').select('date').order('date', { ascending: false }).limit(1)
      const { data: latestGa4 } = await supabase.from('ga4_daily').select('date').order('date', { ascending: false }).limit(1)

      const conns: ConnectionStatus[] = [
        {
          name: 'Google Search Console',
          icon: Search,
          status: (gscQ.count || 0) > 0 ? 'connected' : 'disconnected',
          detail: `${(gscQ.count || 0).toLocaleString()} query rows, ${(gscP.count || 0).toLocaleString()} page rows`,
          color: TEAL,
          lastSync: latestGsc?.[0]?.date || 'Never',
          rows: (gscQ.count || 0) + (gscP.count || 0),
        },
        {
          name: 'Google Analytics 4',
          icon: BarChart3,
          status: (ga4D.count || 0) > 0 ? 'connected' : 'disconnected',
          detail: `${(ga4D.count || 0)} daily rows, ${(ga4Pg.count || 0)} pages, ${(ga4Src.count || 0)} sources`,
          color: NAVY,
          lastSync: latestGa4?.[0]?.date || 'Never',
          rows: (ga4D.count || 0) + (ga4Pg.count || 0) + (ga4Src.count || 0),
        },
        {
          name: 'DataForSEO Keywords',
          icon: Key,
          status: (seoKw.count || 0) > 0 ? ((seoKw.count || 0) >= 10 ? 'connected' : 'partial') : 'disconnected',
          detail: `${seoKw.count || 0} tracked keywords${(seoKw.count || 0) < 10 ? ' (credits exhausted — 3 failed)' : ''}`,
          color: PURPLE,
          rows: seoKw.count || 0,
        },
        {
          name: 'Google Ads',
          icon: Globe,
          status: 'disconnected',
          detail: 'Requires MCC Developer Token',
          color: GOLD,
        },
        {
          name: 'Affiliate Revenue',
          icon: Zap,
          status: 'disconnected',
          detail: 'Needs click tracking + affiliate network access',
          color: RED,
        },
      ]

      setConnections(conns)
      } catch (e) {
        // Silently handle — shows empty state
      } finally {
        setLoading(false)
      }
    }
    checkConnections()
  }, [])

  const statusIcon = (s: string) => {
    if (s === 'connected') return <CheckCircle size={16} style={{ color: TEAL }} />
    if (s === 'partial') return <Clock size={16} style={{ color: GOLD }} />
    return <XCircle size={16} style={{ color: '#404040' }} />
  }

  const statusLabel = (s: string) => {
    if (s === 'connected') return { text: 'Connected', color: TEAL, bg: `${TEAL}15` }
    if (s === 'partial') return { text: 'Partial', color: GOLD, bg: `${GOLD}12` }
    return { text: 'Not Connected', color: '#606060', bg: '#2A2A2A' }
  }

  const connectedCount = connections.filter(c => c.status === 'connected').length
  const totalRows = connections.reduce((s, c) => s + (c.rows || 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-secondary">Data connections, sync status, and configuration</p>
      </div>

      {/* Overview tiles */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          <div style={{ padding: '20px', borderRadius: 16, background: '#2A2A2A', border: '1px solid #2A2A2A' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: TEAL }}>{connectedCount}</div>
            <div style={{ fontSize: 12, color: '#8A8A8A', marginTop: 2 }}>Data Sources Connected</div>
          </div>
          <div style={{ padding: '20px', borderRadius: 16, background: '#2A2A2A', border: '1px solid #2A2A2A' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'white' }}>{totalRows.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#8A8A8A', marginTop: 2 }}>Total Data Rows</div>
          </div>
          <div style={{ padding: '20px', borderRadius: 16, background: '#2A2A2A', border: '1px solid #2A2A2A' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: NAVY }}>75</div>
            <div style={{ fontSize: 12, color: '#8A8A8A', marginTop: 2 }}>AI Chat Tools</div>
          </div>
        </div>
      )}

      {/* Data Connections */}
      <div className="animate-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Database size={18} style={{ color: TEAL }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Data Connections</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connections.map((conn, i) => {
            const sl = statusLabel(conn.status)
            const Icon = conn.icon
            return (
              <div key={conn.name} className="animate-in" style={{
                animationDelay: `${150 + i * 40}ms`, animationFillMode: 'both',
                padding: '18px 22px', borderRadius: 16,
                background: '#2A2A2A',
                border: `1px solid ${conn.status === 'connected' ? conn.color + '20' : '#2A2A2A'}`,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${conn.color}10`, border: `1.5px solid ${conn.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} style={{ color: conn.color }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{conn.name}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sl.bg, color: sl.color }}>
                      {sl.text}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8A8A8A' }}>{conn.detail}</div>
                </div>

                {/* Meta */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {conn.lastSync && (
                    <div style={{ fontSize: 11, color: '#606060', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <Clock size={11} /> Last: {conn.lastSync}
                    </div>
                  )}
                  {conn.rows !== undefined && (
                    <div style={{ fontSize: 11, color: '#4A4A4A', marginTop: 2 }}>{conn.rows.toLocaleString()} rows</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Team */}
      <div className="animate-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={18} style={{ color: PURPLE }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Team Members</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
          {[
            { name: 'Keith', role: 'Admin', initials: 'KS', color: TEAL, email: 'keith@pointhacks.com.au', status: 'online' },
            { name: 'Daniel', role: 'Editor', initials: 'DW', color: NAVY, email: 'daniel@pointhacks.com.au', status: 'online' },
            { name: 'Sarah', role: 'SEO Lead', initials: 'SM', color: PURPLE, email: 'sarah@pointhacks.com.au', status: 'away' },
            { name: 'James', role: 'Content', initials: 'JL', color: GOLD, email: 'james@pointhacks.com.au', status: 'offline' },
          ].map(member => (
            <div key={member.name} style={{
              padding: '16px 18px', borderRadius: 14,
              background: '#2A2A2A', border: '1px solid #333333',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `${member.color}20`, border: `2px solid ${member.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: member.color,
                }}>
                  {member.initials}
                </div>
                <div style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 10, height: 10, borderRadius: '50%',
                  background: member.status === 'online' ? TEAL : member.status === 'away' ? GOLD : '#383838',
                  border: '2px solid #1E1E1E',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{member.name}</div>
                <div style={{ fontSize: 11, color: '#707070' }}>{member.role} · {member.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="animate-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} style={{ color: GOLD }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Security</h2>
        </div>

        <div style={{
          padding: '18px 22px', borderRadius: 16,
          background: '#2A2A2A', border: '1px solid #333333',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Access Code Authentication</div>
              <div style={{ fontSize: 12, color: '#707070' }}>8-digit access code required to enter dashboard</div>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${TEAL}15`, color: TEAL }}>Active</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#606060' }}>
            <span>Auth method: localStorage</span>
            <span>Session: persistent</span>
            <span>RLS: enabled on all tables</span>
          </div>
        </div>
      </div>

      {/* Sync Schedule */}
      <div className="animate-in" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <RefreshCw size={18} style={{ color: TEAL }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Sync Schedule</h2>
        </div>

        <div style={{
          padding: '18px 22px', borderRadius: 16,
          background: '#2A2A2A', border: '1px solid #333333',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Daily Auto-Sync</div>
              <div style={{ fontSize: 12, color: '#707070' }}>GA4 + GSC data refreshed daily at 6:00 AM AEST</div>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${TEAL}15`, color: TEAL }}>Scheduled</span>
          </div>
        </div>
      </div>
    </div>
  )
}
