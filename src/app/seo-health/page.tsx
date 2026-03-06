'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Link2, Image, Type,
  FileText, Gauge, Loader2, Play, ChevronDown, ArrowUpDown, ExternalLink,
  Zap, Eye, Search, RefreshCw, Info
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'

interface AuditRow {
  id: number
  page_path: string
  url: string
  has_h1: boolean
  h1_text: string
  has_meta_description: boolean
  meta_description: string
  meta_description_length: number
  internal_link_count: number
  external_link_count: number
  total_images: number
  images_with_alt: number
  alt_text_coverage: number
  lcp_ms: number | null
  cls: number | null
  inp_ms: number | null
  performance_score: number | null
  accessibility_score: number | null
  seo_score: number | null
  page_size_kb: number | null
  created_at: string
}

const TEAL = '#34D399', RED = '#EF4444', GOLD = '#F59E0B', BLUE = '#3B82F6', PURPLE = '#8B5CF6'

function scoreColor(score: number | null, thresholds: [number, number] = [50, 90]) {
  if (score == null) return '#666'
  if (score >= thresholds[1]) return TEAL
  if (score >= thresholds[0]) return GOLD
  return RED
}

function ScoreBadge({ value, suffix, thresholds }: { value: number | null; suffix?: string; thresholds?: [number, number] }) {
  if (value == null) return <span className="text-zinc-600">—</span>
  const color = scoreColor(value, thresholds)
  return (
    <span className="text-sm font-semibold" style={{ color }}>
      {value}{suffix}
    </span>
  )
}

function PassFail({ pass }: { pass: boolean }) {
  return pass
    ? <CheckCircle size={16} style={{ color: TEAL }} />
    : <XCircle size={16} style={{ color: RED }} />
}

const DEFAULT_PAGES = [
  '/',
  '/credit-cards/',
  '/qantas/best-frequent-flyer-credit-card/',
  '/velocity/best-frequent-flyer-credit-card/',
  '/news/',
  '/guides/',
  '/credit-cards/compare/',
  '/qantas/',
  '/velocity/',
  '/tools/points-calculator/',
]

export default function SEOHealthPage() {
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [customPaths, setCustomPaths] = useState('')
  const [sortCol, setSortCol] = useState<string>('performance_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    loadAudits()
  }, [])

  async function loadAudits() {
    setLoading(true)
    const res = await fetch('/api/seo-audit?latest=true')
    const data = await res.json()
    if (Array.isArray(data)) setAudits(data)
    setLoading(false)
  }

  async function runAudit() {
    const paths = customPaths.trim()
      ? customPaths.split('\n').map(p => p.trim()).filter(Boolean)
      : DEFAULT_PAGES
    setRunning(true)
    setProgress({ done: 0, total: paths.length, current: '' })

    // Run in batches of 2 to avoid timeout
    for (let i = 0; i < paths.length; i += 2) {
      const batch = paths.slice(i, i + 2)
      setProgress({ done: i, total: paths.length, current: batch[0] })
      try {
        await fetch('/api/seo-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: batch }),
        })
      } catch {}
    }
    setProgress({ done: paths.length, total: paths.length, current: 'Done!' })
    setRunning(false)
    await loadAudits()
  }

  const sorted = useMemo(() => {
    const arr = [...audits]
    arr.sort((a, b) => {
      const av = (a as any)[sortCol] ?? -1
      const bv = (b as any)[sortCol] ?? -1
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return arr
  }, [audits, sortCol, sortDir])

  const summary = useMemo(() => {
    if (audits.length === 0) return null
    const total = audits.length
    const h1Pass = audits.filter(a => a.has_h1).length
    const metaPass = audits.filter(a => a.has_meta_description).length
    const avgLinks = Math.round(audits.reduce((s, a) => s + a.internal_link_count, 0) / total)
    const avgAlt = Math.round(audits.reduce((s, a) => s + (a.alt_text_coverage || 0), 0) / total)
    const withCWV = audits.filter(a => a.performance_score != null)
    const avgPerf = withCWV.length > 0 ? Math.round(withCWV.reduce((s, a) => s + (a.performance_score || 0), 0) / withCWV.length) : null
    const avgLCP = withCWV.length > 0 ? Math.round(withCWV.reduce((s, a) => s + (a.lcp_ms || 0), 0) / withCWV.length) : null
    const avgSEO = withCWV.length > 0 ? Math.round(withCWV.reduce((s, a) => s + (a.seo_score || 0), 0) / withCWV.length) : null
    return { total, h1Pass, metaPass, avgLinks, avgAlt, avgPerf, avgLCP, avgSEO }
  }, [audits])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const cwvChartData = useMemo(() =>
    audits.filter(a => a.performance_score != null).map(a => ({
      page: a.page_path.length > 25 ? '...' + a.page_path.slice(-22) : a.page_path,
      score: a.performance_score!,
    })).sort((a, b) => a.score - b.score),
  [audits])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Shield size={28} style={{ color: BLUE }} />
          <h1 className="text-2xl font-bold text-white">SEO Health</h1>
        </div>
        <p className="text-zinc-400 text-sm">Technical SEO audit — H1 tags, meta descriptions, internal links, image alt text, Core Web Vitals</p>
      </div>

      {/* Run Audit Controls */}
      <div className="glass-card-static p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Pages to audit (one per line, or leave blank for defaults)</label>
            <textarea
              value={customPaths}
              onChange={e => setCustomPaths(e.target.value)}
              placeholder={DEFAULT_PAGES.slice(0, 4).join('\n') + '\n...'}
              className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none"
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-2 justify-end">
            <button
              onClick={runAudit}
              disabled={running}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              style={{ background: running ? '#383838' : BLUE, color: 'white' }}
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Auditing...' : 'Run Audit'}
            </button>
            {audits.length > 0 && (
              <button onClick={loadAudits} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-sm transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            )}
          </div>
        </div>
        {running && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Auditing: {progress.current}</span>
              <span>{progress.done}/{progress.total}</span>
            </div>
            <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, background: BLUE }} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : audits.length === 0 ? (
        <div className="glass-card-static p-16 text-center">
          <Shield size={48} className="mx-auto mb-4" style={{ color: '#383838' }} />
          <h3 className="text-lg font-bold text-white mb-2">No audits yet</h3>
          <p className="text-zinc-500">Run your first audit to see SEO health metrics across your pages.</p>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Type size={14} style={{ color: BLUE }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">H1 Tags</span>
                </div>
                <div className="text-xl font-bold" style={{ color: summary.h1Pass === summary.total ? TEAL : RED }}>
                  {summary.h1Pass}/{summary.total}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">{Math.round((summary.h1Pass / summary.total) * 100)}% pass</div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} style={{ color: PURPLE }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Meta Desc</span>
                </div>
                <div className="text-xl font-bold" style={{ color: summary.metaPass === summary.total ? TEAL : GOLD }}>
                  {summary.metaPass}/{summary.total}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">{Math.round((summary.metaPass / summary.total) * 100)}% have meta</div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 size={14} style={{ color: TEAL }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Int. Links</span>
                </div>
                <div className="text-xl font-bold" style={{ color: summary.avgLinks >= 20 ? TEAL : summary.avgLinks >= 10 ? GOLD : RED }}>
                  {summary.avgLinks}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Target: 25-40+</div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image size={14} style={{ color: GOLD }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Alt Coverage</span>
                </div>
                <div className="text-xl font-bold" style={{ color: summary.avgAlt >= 90 ? TEAL : summary.avgAlt >= 60 ? GOLD : RED }}>
                  {summary.avgAlt}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Target: 90%+</div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge size={14} style={{ color: BLUE }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Perf Score</span>
                </div>
                <div className="text-xl font-bold" style={{ color: scoreColor(summary.avgPerf) }}>
                  {summary.avgPerf ?? '—'}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">{summary.avgLCP ? `LCP: ${(summary.avgLCP / 1000).toFixed(1)}s` : 'No CWV data'}</div>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={14} style={{ color: TEAL }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg SEO Score</span>
                </div>
                <div className="text-xl font-bold" style={{ color: scoreColor(summary.avgSEO) }}>
                  {summary.avgSEO ?? '—'}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Lighthouse SEO</div>
              </div>
            </div>
          )}

          {/* Performance Score Chart */}
          {cwvChartData.length > 0 && (
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Gauge size={20} style={{ color: BLUE }} />
                Performance Scores by Page
              </h2>
              <div style={{ width: '100%', height: Math.max(200, cwvChartData.length * 35) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cwvChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#666', fontSize: 11 }} />
                    <YAxis type="category" dataKey="page" tick={{ fill: '#aaa', fontSize: 10 }} width={180} />
                    <Tooltip contentStyle={{ background: '#2A2A2A', border: '1px solid #383838', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="score" name="Performance" radius={[0, 4, 4, 0]}>
                      {cwvChartData.map((d, i) => (
                        <Cell key={i} fill={scoreColor(d.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Issues Summary */}
          {(() => {
            const issues = []
            const noH1 = audits.filter(a => !a.has_h1)
            const noMeta = audits.filter(a => !a.has_meta_description)
            const lowLinks = audits.filter(a => a.internal_link_count < 10)
            const lowAlt = audits.filter(a => a.alt_text_coverage < 80 && a.total_images > 0)
            const slowPages = audits.filter(a => a.performance_score != null && a.performance_score < 50)
            if (noH1.length > 0) issues.push({ icon: Type, color: RED, label: 'Missing H1 Tag', count: noH1.length, pages: noH1.map(a => a.page_path) })
            if (noMeta.length > 0) issues.push({ icon: FileText, color: RED, label: 'Missing Meta Description', count: noMeta.length, pages: noMeta.map(a => a.page_path) })
            if (lowLinks.length > 0) issues.push({ icon: Link2, color: GOLD, label: 'Low Internal Links (<10)', count: lowLinks.length, pages: lowLinks.map(a => `${a.page_path} (${a.internal_link_count})`) })
            if (lowAlt.length > 0) issues.push({ icon: Image, color: GOLD, label: 'Low Alt Text Coverage (<80%)', count: lowAlt.length, pages: lowAlt.map(a => `${a.page_path} (${a.alt_text_coverage}%)`) })
            if (slowPages.length > 0) issues.push({ icon: Zap, color: RED, label: 'Poor Performance (<50)', count: slowPages.length, pages: slowPages.map(a => `${a.page_path} (${a.performance_score})`) })

            if (issues.length === 0) return (
              <div className="glass-card-static p-6 flex items-center gap-3" style={{ borderLeft: `3px solid ${TEAL}` }}>
                <CheckCircle size={24} style={{ color: TEAL }} />
                <div>
                  <h3 className="text-sm font-semibold text-white">All checks passed</h3>
                  <p className="text-xs text-zinc-500">No critical SEO issues found across audited pages.</p>
                </div>
              </div>
            )

            return (
              <div className="glass-card-static p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} style={{ color: GOLD }} />
                  Issues Found
                </h2>
                <div className="space-y-3">
                  {issues.map(issue => (
                    <div key={issue.label} className="bg-[#1A1A1A] rounded-lg p-4">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedRow(expandedRow === issue.label ? null : issue.label)}>
                        <issue.icon size={18} style={{ color: issue.color }} />
                        <span className="text-sm text-white font-medium flex-1">{issue.label}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: issue.color + '20', color: issue.color }}>{issue.count} page{issue.count > 1 ? 's' : ''}</span>
                        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${expandedRow === issue.label ? 'rotate-180' : ''}`} />
                      </div>
                      {expandedRow === issue.label && (
                        <div className="mt-3 pl-8 space-y-1">
                          {issue.pages.map(p => <div key={p} className="text-xs text-zinc-400">{p}</div>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Full Table */}
          <div className="glass-card-static overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#383838] text-[10px] text-zinc-500 uppercase">
                    <th className="text-left p-3">Page</th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center" onClick={() => toggleSort('has_h1')}>H1</th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center" onClick={() => toggleSort('has_meta_description')}>Meta</th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center" onClick={() => toggleSort('internal_link_count')}>
                      <span className="inline-flex items-center gap-1">Links <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center" onClick={() => toggleSort('alt_text_coverage')}>
                      <span className="inline-flex items-center gap-1">Alt % <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center hidden md:table-cell" onClick={() => toggleSort('performance_score')}>
                      <span className="inline-flex items-center gap-1">Perf <ArrowUpDown size={10} /></span>
                    </th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center hidden md:table-cell" onClick={() => toggleSort('lcp_ms')}>LCP</th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center hidden lg:table-cell" onClick={() => toggleSort('cls')}>CLS</th>
                    <th className="p-3 cursor-pointer hover:text-zinc-300 text-center hidden lg:table-cell" onClick={() => toggleSort('seo_score')}>SEO</th>
                    <th className="p-3 text-center hidden lg:table-cell">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(a => (
                    <tr key={a.page_path} className="border-b border-[#383838] last:border-0 hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm text-white truncate max-w-[250px]" title={a.page_path}>{a.page_path}</span>
                          <a href={a.url} target="_blank" rel="noopener" className="shrink-0 text-zinc-600 hover:text-zinc-400">
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        {a.h1_text && !a.h1_text.startsWith('Error') && (
                          <div className="text-[10px] text-zinc-600 truncate max-w-[250px] mt-0.5" title={a.h1_text}>H1: {a.h1_text}</div>
                        )}
                      </td>
                      <td className="p-3 text-center"><PassFail pass={a.has_h1} /></td>
                      <td className="p-3 text-center"><PassFail pass={a.has_meta_description} /></td>
                      <td className="p-3 text-center">
                        <span className="text-sm font-medium" style={{ color: a.internal_link_count >= 20 ? TEAL : a.internal_link_count >= 10 ? GOLD : RED }}>
                          {a.internal_link_count}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {a.total_images > 0 ? (
                          <span className="text-sm" style={{ color: a.alt_text_coverage >= 90 ? TEAL : a.alt_text_coverage >= 60 ? GOLD : RED }}>
                            {a.alt_text_coverage}%
                            <span className="text-[10px] text-zinc-600 ml-1">({a.images_with_alt}/{a.total_images})</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">No imgs</span>
                        )}
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        <ScoreBadge value={a.performance_score} />
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        {a.lcp_ms != null ? (
                          <span className="text-sm" style={{ color: a.lcp_ms <= 2500 ? TEAL : a.lcp_ms <= 4000 ? GOLD : RED }}>
                            {(a.lcp_ms / 1000).toFixed(1)}s
                          </span>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {a.cls != null ? (
                          <span className="text-sm" style={{ color: a.cls <= 0.1 ? TEAL : a.cls <= 0.25 ? GOLD : RED }}>
                            {a.cls.toFixed(3)}
                          </span>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        <ScoreBadge value={a.seo_score} />
                      </td>
                      <td className="p-3 text-center hidden lg:table-cell">
                        {a.page_size_kb != null ? (
                          <span className="text-xs text-zinc-400">{a.page_size_kb}KB</span>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Last Audit Info */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <Info size={12} />
            <span>
              Last audit: {new Date(audits[0]?.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}{audits.length} pages audited
              {' · '}CWV data from Google PageSpeed Insights (mobile)
            </span>
          </div>
        </>
      )}
    </div>
  )
}
