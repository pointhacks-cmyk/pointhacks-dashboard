'use client'

import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

interface TopPagesCardProps {
  data: Array<{ page_path: string; page_title: string; page_views: number }>
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function formatPageName(path: string, title: string): { name: string; subtitle: string } {
  if (path === '/') return { name: title || 'Homepage', subtitle: 'pointhacks.com.au' }
  const clean = title || path.replace(/^\/|\/$/g, '').replace(/-/g, ' ').replace(/\//g, ' › ')
  return { name: clean, subtitle: path }
}

export default function TopPagesCard({ data }: TopPagesCardProps) {
  const maxViews = Math.max(...data.map(r => r.page_views), 1)

  return (
    <div className="glass-card p-6 animate-in" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
      <h3 className="text-lg font-semibold text-white mb-4">Top Pages</h3>
      <div className="space-y-3">
        {data.slice(0, 5).map((row, i) => (
          <div key={i} className="group hover:bg-white/5 rounded-lg p-2 -mx-2 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: '#404040' }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate" title={formatPageName(row.page_path, row.page_title).name}>
                  {truncate(formatPageName(row.page_path, row.page_title).name, 50)}
                </div>
                <div className="text-secondary/50 text-xs truncate">{formatPageName(row.page_path, row.page_title).subtitle}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <TrendingUp size={12} style={{ color: '#34D39999' }} />
                <span className="text-white text-sm font-medium">{row.page_views.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-1.5 ml-10 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(row.page_views / maxViews) * 100}%`,
                  background: '#404040',
                  opacity: 0.5,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <Link href="/pages" className="block mt-5 text-center text-xs text-[#34D399] hover:text-white transition-colors font-medium">
        Click for deeper insights →
      </Link>
    </div>
  )
}
