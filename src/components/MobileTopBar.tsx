'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Overview',
  '/pages': 'Pages',
  '/search': 'Search & SEO',
  '/ads': 'Advertising',
  '/seo': 'SEO Intelligence',
  '/recommendations': 'Recommendations',
  '/chat': 'AI Chat',
  '/settings': 'Settings',
  '/monitor': 'Monitor',

  '/audience': 'Audience',
}

export default function MobileTopBar() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || 'Point Hacks'

  return (
    <div
      className="flex md:!hidden items-center fixed top-0 left-0 right-0 z-40"
      style={{
        height: 56,
        background: '#1E1E1E',
        
        
        borderBottom: '1px solid #333333',
        padding: '0 16px',
      }}
    >
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'transparent',
          border: 'none',
          color: '#B0B0B0',
          cursor: 'pointer',
          flexShrink: 0,
          marginLeft: -8,
        }}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.01em', flex: 1, textAlign: 'center', marginRight: 36 }}>
        {title}
      </span>
    </div>
  )
}
