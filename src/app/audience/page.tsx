'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useDateRange } from '@/lib/DateRangeContext';
import { Users, Monitor, Globe, BarChart3, TrendingUp, Database, Activity, Instagram, Youtube, Mail, Hash, Trophy } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line, BarChart, Bar, Cell
} from 'recharts';

const TEAL = '#34D399', RED = '#EF4444', NAVY = '#6366f1', GOLD = '#F59E0B', PURPLE = '#8B5CF6'

interface TrafficRow { source: string; medium: string; sessions: number; date: string }
interface DailyRow { date: string; sessions: number; page_views: number; users: number; bounce_rate: number; avg_session_duration: number }

interface SourceSummary {
  source: string; medium: string; totalSessions: number; percentage: number; trend: number | null;
}

function DeltaIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.01) return <span style={{ color: '#606060' }}>—</span>
  const color = value > 0 ? TEAL : RED
  const arrow = value > 0 ? '▲' : '▼'
  return <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{arrow} {Math.abs(value).toFixed(1)}{suffix}</span>
}

export default function AudiencePage() {
  const { dateRange } = useDateRange();
  const { startDate, endDate, compareEnabled, compareStartDate, compareEndDate } = dateRange;

  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [compareSources, setCompareSources] = useState<SourceSummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [compareDailyData, setCompareDailyData] = useState<DailyRow[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audienceMetrics, setAudienceMetrics] = useState<any[]>([]);

  function aggregateSources(rows: TrafficRow[]): { sources: SourceSummary[]; total: number } {
    const map = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const key = `${r.source} / ${r.medium}`;
      map.set(key, (map.get(key) || 0) + r.sessions);
      total += r.sessions;
    }
    const summaries: SourceSummary[] = [];
    map.forEach((sessions, key) => {
      const [source, medium] = key.split(' / ');
      summaries.push({ source, medium, totalSessions: sessions, percentage: total > 0 ? (sessions / total) * 100 : 0, trend: null });
    });
    summaries.sort((a, b) => b.totalSessions - a.totalSessions);
    return { sources: summaries, total };
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [srcRes, dailyRes, amRes] = await Promise.all([
          supabase.from('ga4_traffic_sources').select('source, medium, sessions, date').gte('date', startDate).lte('date', endDate),
          supabase.from('ga4_daily').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: true }),
          supabase.from('audience_metrics').select('*').order('month', { ascending: true }),
        ]);
        if (amRes.data) setAudienceMetrics(amRes.data);

        if (srcRes.error) throw srcRes.error;
        if (dailyRes.error) throw dailyRes.error;

        const { sources: s, total } = aggregateSources((srcRes.data || []) as TrafficRow[]);
        setSources(s);
        setTotalSessions(total);
        setDailyData((dailyRes.data || []) as DailyRow[]);

        if (compareEnabled) {
          const [cSrcRes, cDailyRes] = await Promise.all([
            supabase.from('ga4_traffic_sources').select('source, medium, sessions, date').gte('date', compareStartDate).lte('date', compareEndDate),
            supabase.from('ga4_daily').select('*').gte('date', compareStartDate).lte('date', compareEndDate).order('date', { ascending: true }),
          ]);
          const { sources: cs } = aggregateSources((cSrcRes.data || []) as TrafficRow[]);
          setCompareSources(cs);
          setCompareDailyData((cDailyRes.data || []) as DailyRow[]);

          // Add trend data
          const prevMap = new Map<string, number>();
          for (const c of cs) prevMap.set(`${c.source} / ${c.medium}`, c.totalSessions);
          setSources(prev => prev.map(src => {
            const prevSessions = prevMap.get(`${src.source} / ${src.medium}`);
            return { ...src, trend: prevSessions ? ((src.totalSessions - prevSessions) / prevSessions) * 100 : null };
          }));
        } else {
          setCompareSources([]);
          setCompareDailyData([]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, compareEnabled, compareStartDate, compareEndDate]);

  const dailyKpis = useMemo(() => {
    const totalSess = dailyData.reduce((s, d) => s + (d.sessions || 0), 0);
    const totalPV = dailyData.reduce((s, d) => s + (d.page_views || 0), 0);
    const totalUsers = dailyData.reduce((s, d) => s + (d.users || 0), 0);
    const avgBounce = dailyData.length > 0 ? dailyData.reduce((s, d) => s + (d.bounce_rate || 0), 0) / dailyData.length : 0;
    const avgDuration = dailyData.length > 0 ? dailyData.reduce((s, d) => s + (d.avg_session_duration || 0), 0) / dailyData.length : 0;

    let sessDelta: number | undefined, pvDelta: number | undefined, usersDelta: number | undefined;
    if (compareEnabled && compareDailyData.length > 0) {
      const prevSess = compareDailyData.reduce((s, d) => s + (d.sessions || 0), 0);
      const prevPV = compareDailyData.reduce((s, d) => s + (d.page_views || 0), 0);
      const prevUsers = compareDailyData.reduce((s, d) => s + (d.users || 0), 0);
      sessDelta = prevSess > 0 ? ((totalSess - prevSess) / prevSess) * 100 : 0;
      pvDelta = prevPV > 0 ? ((totalPV - prevPV) / prevPV) * 100 : 0;
      usersDelta = prevUsers > 0 ? ((totalUsers - prevUsers) / prevUsers) * 100 : 0;
    }

    return { totalSess, totalPV, totalUsers, avgBounce, avgDuration, sessDelta, pvDelta, usersDelta };
  }, [dailyData, compareDailyData, compareEnabled]);

  const channelColor = (source: string): string => {
    const s = source.toLowerCase();
    if (s === 'google') return TEAL;
    if (s === 'direct' || s === '(direct)') return NAVY;
    if (s.includes('facebook') || s.includes('meta')) return PURPLE;
    if (s.includes('bing')) return GOLD;
    if (s.includes('twitter') || s.includes('x.com')) return RED;
    return '#6b7280';
  };

  const fmt = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="skeleton h-8 w-72 rounded-lg" />
        <div className="skeleton h-5 w-96 rounded-lg" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-xl h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="animate-in" style={{ animationFillMode: 'both' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Audience & Traffic Sources</h1>
        <p className="text-secondary">GA4 data filtered by date range</p>
      </div>

      {error && (
        <div className="glass-card-static p-6 animate-in" style={{ borderLeft: `3px solid ${RED}`, animationFillMode: 'both' }}>
          <p style={{ color: RED }}>Error: {error}</p>
        </div>
      )}

      {!error && sources.length === 0 && dailyData.length === 0 && (
        <div className="glass-card-static p-16 text-center animate-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          <Users size={40} style={{ color: '#383838', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No data for this date range</h3>
          <p className="text-secondary" style={{ maxWidth: 400, margin: '0 auto' }}>
            Try selecting a different date range or ensure the GA4 pipeline is populating data.
          </p>
        </div>
      )}

      {!error && (sources.length > 0 || dailyData.length > 0) && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Users size={14} style={{ color: TEAL }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sessions</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{fmt(dailyKpis.totalSess || totalSessions)}</div>
                {dailyKpis.sessDelta !== undefined && <DeltaIndicator value={dailyKpis.sessDelta} suffix="%" />}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BarChart3 size={14} style={{ color: NAVY }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pageviews</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{fmt(dailyKpis.totalPV)}</div>
                {dailyKpis.pvDelta !== undefined && <DeltaIndicator value={dailyKpis.pvDelta} suffix="%" />}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Users size={14} style={{ color: PURPLE }} />
                <span style={{ fontSize: '0.75rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Users</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{fmt(dailyKpis.totalUsers)}</div>
                {dailyKpis.usersDelta !== undefined && <DeltaIndicator value={dailyKpis.usersDelta} suffix="%" />}
              </div>
            </div>
          </div>

          {/* Engagement metrics */}
          {dailyData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in" style={{ animationDelay: '75ms', animationFillMode: 'both' }}>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#8C8C8C', marginBottom: '0.5rem' }}>Avg Bounce Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: dailyKpis.avgBounce > 60 ? GOLD : TEAL }}>{dailyKpis.avgBounce.toFixed(1)}%</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#8C8C8C', marginBottom: '0.5rem' }}>Avg Session Duration</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{Math.floor(dailyKpis.avgDuration / 60)}m {Math.round(dailyKpis.avgDuration % 60)}s</div>
              </div>
            </div>
          )}

          {/* Session trend chart (simple bar) */}
          {dailyData.length > 1 && (
            <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '100ms', animationFillMode: 'both' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} style={{ color: TEAL }} /> Session Trend
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                {dailyData.map((d, i) => {
                  const max = Math.max(...dailyData.map(dd => dd.sessions || 0), 1);
                  const h = ((d.sessions || 0) / max) * 100;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.sessions} sessions`}
                      style={{ flex: 1, height: `${h}%`, background: TEAL, borderRadius: '2px 2px 0 0', minWidth: 2, opacity: 0.7, transition: 'height 0.3s' }}
                    />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#606060', marginTop: 4 }}>
                <span>{dailyData[0]?.date}</span>
                <span>{dailyData[dailyData.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Traffic source breakdown */}
          {sources.length > 0 && (
            <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '150ms', animationFillMode: 'both' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={16} style={{ color: TEAL }} /> Traffic Source Breakdown
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sources.slice(0, 15).map((s, i) => {
                  const color = channelColor(s.source);
                  return (
                    <div key={`${s.source}-${s.medium}`} className="animate-in" style={{ animationDelay: `${200 + i * 30}ms`, animationFillMode: 'both' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                        <span style={{ color: 'white' }}>{s.source} <span style={{ color: '#606060' }}>/ {s.medium}</span></span>
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
                        <div style={{ height: '100%', borderRadius: 3, width: `${s.percentage}%`, background: color, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full table */}
          {sources.length > 0 && (
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
          )}
        </>
      )}

      {/* ═══ Social & Audience Growth (Source: Internal P&L Spreadsheet) ═══ */}
      {audienceMetrics.length > 0 && (
        <div className="space-y-6" style={{ marginTop: '2rem' }}>
          {/* Source label */}
          <div className="flex items-center gap-2">
            <Database size={14} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#F59E0B18', color: '#F59E0B', border: '1px solid #F59E0B30' }}>
              Source: Internal P&amp;L Spreadsheet
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Social &amp; Audience Growth</h2>

          {/* Latest month KPI cards */}
          {(() => {
            const latest = audienceMetrics[audienceMetrics.length - 1]
            const prev = audienceMetrics.length >= 2 ? audienceMetrics[audienceMetrics.length - 2] : null
            const delta = (c: number, p: number) => p ? ((c - p) / Math.abs(p)) * 100 : 0
            const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString()
            const monthLabel = new Date(latest.month).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
            const cards = [
              { label: 'Facebook', value: latest.facebook_followers, prev: prev?.facebook_followers, color: '#1877F2' },
              { label: 'Instagram', value: latest.instagram_followers, prev: prev?.instagram_followers, color: '#E4405F' },
              { label: 'TikTok', value: latest.tiktok_followers, prev: prev?.tiktok_followers, color: '#00f2ea' },
              { label: 'YouTube', value: latest.youtube_subscribers, prev: prev?.youtube_subscribers, color: '#FF0000' },
              { label: 'Email Subs', value: latest.email_subscribers, prev: prev?.email_subscribers, color: TEAL },
            ]
            return (
              <>
                <p className="text-secondary" style={{ fontSize: '0.8rem' }}>As of {monthLabel}</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 animate-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                  {cards.map(c => {
                    const d = c.prev ? delta(c.value, c.prev) : null
                    return (
                      <div key={c.label} className="glass-card" style={{ padding: '1.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{c.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{fmtK(c.value)}</div>
                        {d != null && (
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: d >= 0 ? TEAL : RED, marginTop: 4 }}>
                            {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% MoM
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}

          {/* Follower Growth Chart */}
          <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '350ms', animationFillMode: 'both' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} style={{ color: TEAL }} /> Follower Growth Over Time
            </h2>
            <p style={{ fontSize: '0.7rem', color: '#606060', marginBottom: '1rem' }}>Monthly totals across platforms</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={audienceMetrics.map(m => ({
                month: new Date(m.month).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
                Facebook: m.facebook_followers,
                Instagram: m.instagram_followers,
                TikTok: m.tiktok_followers,
                YouTube: m.youtube_subscribers,
              }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis dataKey="month" tick={{ fill: '#8A8A8A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                <Tooltip contentStyle={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => Number(v).toLocaleString()} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8C8C8C' }} />
                <Line type="monotone" dataKey="Facebook" stroke="#1877F2" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Instagram" stroke="#E4405F" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="TikTok" stroke="#00f2ea" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="YouTube" stroke="#FF0000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Email Subscribers Growth */}
          <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '400ms', animationFillMode: 'both' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} style={{ color: TEAL }} /> Email Subscriber Growth
            </h2>
            <p style={{ fontSize: '0.7rem', color: '#606060', marginBottom: '1rem' }}>Newsletter subscriber count over time</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={audienceMetrics.map(m => ({
                month: new Date(m.month).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
                subscribers: m.email_subscribers,
              }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEmail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis dataKey="month" tick={{ fill: '#8A8A8A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => Number(v).toLocaleString()} />
                <Area type="monotone" dataKey="subscribers" stroke={TEAL} strokeWidth={2} fill="url(#gradEmail)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Keyword Rankings vs Competitors */}
          {audienceMetrics.some(m => m.ph_top3_keywords > 0) && (
            <div className="glass-card-static animate-in" style={{ padding: '1.5rem', animationDelay: '450ms', animationFillMode: 'both' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={16} style={{ color: GOLD }} /> Top 3 Keyword Rankings vs Competitors
              </h2>
              <p style={{ fontSize: '0.7rem', color: '#606060', marginBottom: '1rem' }}>Top 500 keywords — positions 1-3 count by month</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={audienceMetrics.filter(m => m.ph_top3_keywords > 0).map(m => ({
                  month: new Date(m.month).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
                  'Point Hacks': m.ph_top3_keywords,
                  'AFF': m.aff_top3_keywords,
                  'Finder': Math.round(m.finder_top3_keywords),
                  'Exec Traveller': m.exec_traveller_top3_keywords,
                }))} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="month" tick={{ fill: '#8A8A8A', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8A8A8A', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8C8C8C' }} />
                  <Line type="monotone" dataKey="Point Hacks" stroke={TEAL} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="AFF" stroke={PURPLE} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Finder" stroke={RED} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Exec Traveller" stroke={GOLD} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
