'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, Download, Columns, ChevronLeft, ChevronRight } from 'lucide-react'

interface Column {
  key: string
  label: string
  sortable?: boolean
  format?: (val: any, row?: any) => string | React.ReactNode
}

interface FilterOption {
  label: string
  key: string
  fn: (row: any) => boolean
}

interface DataTableProps {
  columns: Column[]
  data: any[]
  searchKeys?: string[]
  pageSize?: number
  onRowClick?: (row: any) => void
  filters?: FilterOption[]
}

export default function DataTable({ columns, data, searchKeys = [], pageSize = 10, onRowClick, filters = [] }: DataTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const tableRef = useRef<HTMLDivElement>(null)

  const visibleColumns = useMemo(() => columns.filter(c => !hiddenCols.has(c.key)), [columns, hiddenCols])

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setPage(0)
  }

  const filtered = useMemo(() => {
    let result = data
    if (search.trim() && searchKeys.length > 0) {
      const q = search.toLowerCase()
      result = result.filter(row =>
        searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q))
      )
    }
    if (activeFilters.size > 0 && filters.length > 0) {
      for (const fKey of activeFilters) {
        const f = filters.find(f => f.key === fKey)
        if (f) result = result.filter(f.fn)
      }
    }
    return result
  }, [data, search, searchKeys, activeFilters, filters])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const start = safePage * pageSize
  const pageData = sorted.slice(start, start + pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const changePage = useCallback((p: number) => {
    setPage(p)
    setAnimKey(k => k + 1)
  }, [])

  const toggleCol = (key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportCSV = () => {
    const header = visibleColumns.map(c => c.label).join(',')
    const rows = sorted.map(row =>
      visibleColumns.map(c => {
        const v = row[c.key]
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeFilterCount = (search.trim() ? 1 : 0) + hiddenCols.size

  // Page number generation
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      if (safePage > 2) pages.push('...')
      for (let i = Math.max(1, safePage - 1); i <= Math.min(totalPages - 2, safePage + 1); i++) pages.push(i)
      if (safePage < totalPages - 3) pages.push('...')
      pages.push(totalPages - 1)
    }
    return pages
  }, [totalPages, safePage])

  return (
    <div className="data-table">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: '0.875rem' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <button className="pill" onClick={() => setColMenuOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Columns size={14} /> Columns
          </button>
          {colMenuOpen && (
            <>
              <div onClick={() => setColMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 50, padding: '8px', borderRadius: '12px',
                minWidth: 200, display: 'flex', flexDirection: 'column', gap: '2px',
                background: '#1E1E1E',  
                border: '1px solid #383838', boxShadow: '0 8px 32px #1A1A1A',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#707070', padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Toggle columns</div>
                {columns.map(col => (
                  <label key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer',
                    fontSize: '0.82rem', borderRadius: '8px', color: hiddenCols.has(col.key) ? '#707070' : 'white',
                    background: 'transparent', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2A2A2A' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleCol(col.key)}
                      style={{ accentColor: '#34D399', width: 16, height: 16, borderRadius: 4 }} />
                    {col.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="pill" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Filter pills */}
      {filters.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                border: '1px solid',
                borderColor: activeFilters.has(f.key) ? '#34D39980' : '#383838',
                background: activeFilters.has(f.key) ? '#34D39926' : '#2A2A2A',
                color: activeFilters.has(f.key) ? '#34D399' : '#8C8C8C',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button
              onClick={() => { setActiveFilters(new Set()); setPage(0) }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                border: '1px solid #EF44444d',
                background: '#EF44441a',
                color: '#EF4444',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Row count summary */}
      <div style={{ fontSize: '0.78rem', opacity: 0.6, marginBottom: '0.75rem' }}>
        Showing {sorted.length} of {data.length} results{(activeFilterCount > 0 || activeFilters.size > 0) && ` · ${activeFilterCount + activeFilters.size} filter${(activeFilterCount + activeFilters.size) > 1 ? 's' : ''} active`}
      </div>

      {/* Table */}
      <div ref={tableRef} style={{ overflowX: 'auto', borderRadius: '0.75rem' }} className="table-scroll-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {visibleColumns.map((col, ci) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={ci === 0 ? 'sticky-col' : undefined}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem 0.5rem',
                    borderBottom: '1px solid #383838',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.7,
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    background: '#1A1A1A',
                    zIndex: ci === 0 ? 12 : 10,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={animKey}>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                  No data found
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={`${start}-${i}`}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: '1px solid #333333',
                    background: i % 2 === 1 ? '#2A2A2A' : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    animation: 'fadeInRow 0.3s ease forwards',
                    animationDelay: `${i * 30}ms`,
                    opacity: 0,
                  }}
                >
                  {visibleColumns.map((col, ci) => (
                    <td
                      key={col.key}
                      className={ci === 0 ? 'sticky-col' : undefined}
                      style={{
                        padding: '0.6rem 0.5rem',
                        fontSize: '0.875rem',
                        ...(ci === 0 ? { position: 'sticky', left: 0, background: i % 2 === 1 ? '#1A1A1A' : '#1A1A1A', zIndex: 5 } : {}),
                      }}
                    >
                      {col.format ? col.format(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7, flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>Page {safePage + 1} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="pill" onClick={() => changePage(Math.max(0, safePage - 1))} disabled={safePage === 0} style={{ opacity: safePage === 0 ? 0.4 : 1, padding: '0.3rem 0.5rem' }}>
              <ChevronLeft size={14} />
            </button>
            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`dot-${idx}`} style={{ padding: '0 0.3rem' }}>…</span>
              ) : (
                <button
                  key={p}
                  className="pill"
                  onClick={() => changePage(p as number)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    background: safePage === p ? '#6366f14d' : undefined,
                    borderColor: safePage === p ? '#6366f180' : undefined,
                  }}
                >
                  {(p as number) + 1}
                </button>
              )
            )}
            <button className="pill" onClick={() => changePage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} style={{ opacity: safePage >= totalPages - 1 ? 0.4 : 1, padding: '0.3rem 0.5rem' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 5;
        }
      `}</style>
    </div>
  )
}
