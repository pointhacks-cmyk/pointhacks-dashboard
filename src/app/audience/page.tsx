'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Monitor, Globe, BarChart3, TrendingUp, Database } from 'lucide-react';

const TEAL = '#34D399', RED = '#EF4444', NAVY = '#6366f1', GOLD = '#F59E0B', PURPLE = '#8B5CF6'

interface TrafficRow {
  source: string;
  medium: string;
  sessions: number;
  date: string;
}

interface SourceSummary {
  source: string;
  medium: string;
  totalSessions: number;
  percentage: number;
  trend: number | null;
}

export default function AudiencePage() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data, error: dbError } = await supabase
          .from('ga4_traffic_sources')
          .select('source, medium, sessions, date')
          .order('date', { ascending: false });

        if (dbError) throw dbError;
        if (!data || data.length === 0) {
          setLoading(false);
          return;
        }

        const rows = data as TrafficRow[];
        const allDates = [...new Set(rows.map((r) => r.date))].sort().reverse();
        setDates(allDates);

        const latestDate = allDates[0];
        const prevDate = allDates[1] || null;

        const currentRows = rows.filter((r) => r.date === latestDate);
        const prevRows = prevDate ? rows.filter((r) => r.date === prevDate) : [];

        const currentMap = new Map<string, number>();
        let total = 0;
        currentRows.forEach((r) => {
          const key = `${r.source} / ${r.medium}`;
          currentMap.set(key, (currentMap.get(key) || 0) + r.sessions);
          total += r.sessions;
        });

        const prevMap = new Map<string, number>();
        prevRows.forEach((r) => {
          const key = `${r.source} / ${r.medium}`;
          prevMap.set(key, (prevMap.get(key) || 0) + r.sessions);
        });

        const summaries: SourceSummary[] = [];
        currentMap.forEach((sessions, key) => {
          const [source, medium] = key.split(' / ');
          const prevSessions = prevMap.get(key);
          summaries.push({
            source,
            medium,
            totalSessions: sessions,
            percentage: total > 0 ? (sessions / total) * 100 : 0,
            trend: prevSessions ? ((sessions - prevSessions) / prevSessions) * 100 : null,
          });
        });

        summaries.sort((a, b) => b.totalSessions - a.totalSessions);
        setSources(summaries);
        setTotalSessions(total);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const channelColor = (source: string): string => {
    const s = source.toLowerCase();
    if (s === 'google') return TEAL;
    if (s === 'direct' || s === '(direct)') return NAVY;
    if (s.includes('facebook') || s.includes('meta')) return PURPLE;
    if (s.includes('bing')) return GOLD;
    if (s.includes('twitter') || s.includes('x.com')) return RED;
    return '#6b7280';
  };

  const fmt = (n: number) => n.toLocaleString()

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="skeleton h-8 w-72 rounded-lg" />
        <div className="skeleton h-5 w-96 rounded-lg" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-xl h-24" />)}
        </div>
        <div className="skeleton rounded-xl h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Audience & Traffic Sources</h1>
        <p className="text-secondary">Real traffic source data from GA4</p>
      </div>

      {error && (
        <div className="glass-card-static p-6 animate-in" style={{ borderLeft: `3px solid ${RED}`, animationFillMode: 'both' }}>
          <p style={{ color: RED }}>Error: {error}</p>
        </div>
      )}

      {!error && sources.length === 0 && (
        <div className="glass-card-static p-16 text-center animate-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          <Users size={40} style={{ color: '#383838', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No traffic source data found</h3>
          <p className="text-secondary" style={{ maxWidth: 400, margin: '0 auto' }}>
            Ensure the GA4 pipeline is populating ga4_traffic_sources.
          </p>
        </div>
      )}

      {!error && sources.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Users size={14} style={{ color: TEAL }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sessions</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{fmt(totalSessions)}</div>
              <div style={{ fontSize: '0.65rem', color: '#4A4A4A', marginTop: 4 }}>Period: {dates[0]}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Globe size={14} style={{ color: NAVY }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traffic Sources</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{sources.length}</div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BarChart3 size={14} style={{ color: PURPLE }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Points</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{dates.length} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#8A8A8A' }}>periods</span></div>
            </div>
          </div>

          {/* Traffic source breakdown */}
          <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '100ms', animationFillMode: 'both' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={16} style={{ color: TEAL }} />
              Traffic Source Breakdown
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sources.slice(0, 15).map((s, i) => {
                const color = channelColor(s.source)
                return (
                  <div key={`${s.source}-${s.medium}`} className="animate-in" style={{ animationDelay: `${150 + i * 30}ms`, animationFillMode: 'both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                      <span style={{ color: 'white' }}>
                        {s.source} <span style={{ color: '#606060' }}>/ {s.medium}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {s.trend !== null && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.trend >= 0 ? TEAL : RED }}>
                            {s.trend >= 0 ? '+' : ''}{s.trend.toFixed(0)}%
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: '#8C8C8C' }}>{fmt(s.totalSessions)} ({s.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#2A2A2A', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${s.percentage}%`,
                        background: color,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Full table */}
          <div className="glass-card-static animate-in" style={{ animationDelay: '250ms', animationFillMode: 'both', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Medium</th>
                    <th style={{ textAlign: 'right' }}>Sessions</th>
                    <th style={{ textAlign: 'right' }}>Share</th>
                    <th style={{ textAlign: 'right' }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={`${s.source}-${s.medium}`}>
                      <td style={{ color: 'white' }}>{s.source}</td>
                      <td style={{ color: '#8C8C8C' }}>{s.medium}</td>
                      <td style={{ textAlign: 'right', color: 'white', fontWeight: 500 }}>{fmt(s.totalSessions)}</td>
                      <td style={{ textAlign: 'right', color: '#9A9A9A' }}>{s.percentage.toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>
                        {s.trend !== null ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: s.trend >= 0 ? TEAL : RED, fontSize: '0.85rem', fontWeight: 600 }}>
                            <TrendingUp size={12} style={s.trend < 0 ? { transform: 'rotate(180deg)' } : {}} />
                            {Math.abs(s.trend).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: '#383838' }}>&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Connect Data Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
        {[
          { icon: Monitor, title: 'Device Breakdown', desc: 'Connect GA4 Demographics to see desktop vs mobile vs tablet split.', color: TEAL },
          { icon: Globe, title: 'Geographic Data', desc: 'Connect GA4 Demographics for country and city-level audience data.', color: NAVY },
          { icon: BarChart3, title: 'Browser & OS', desc: 'Connect GA4 Demographics to see browser and operating system distribution.', color: PURPLE },
        ].map((card) => (
          <div key={card.title} className="glass-card-static" style={{ padding: '1.25rem', borderTop: `2px solid ${card.color}25` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${card.color}10`, marginBottom: '0.75rem' }}>
              <card.icon size={18} style={{ color: card.color }} />
            </div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '0.35rem' }}>{card.title}</h3>
            <p style={{ fontSize: '0.75rem', color: '#8A8A8A', marginBottom: '0.75rem', lineHeight: 1.5 }}>{card.desc}</p>
            <button style={{
              fontSize: '0.75rem', color: TEAL, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              Connect GA4 Demographics →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
