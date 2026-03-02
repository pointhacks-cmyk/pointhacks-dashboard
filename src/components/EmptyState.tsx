'use client'

import Link from 'next/link'
import { Database } from 'lucide-react'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
}

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in" style={{ animationFillMode: 'both' }}>
      {/* Animated chart SVG */}
      <div className="mb-6 relative">
        <svg width="120" height="80" viewBox="0 0 120 80" fill="none" className="opacity-30">
          <rect x="10" y="50" width="14" height="25" rx="3" fill="url(#emptyGrad)" className="animate-pulse" />
          <rect x="30" y="35" width="14" height="40" rx="3" fill="url(#emptyGrad)" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
          <rect x="50" y="20" width="14" height="55" rx="3" fill="url(#emptyGrad)" className="animate-pulse" style={{ animationDelay: '0.4s' }} />
          <rect x="70" y="30" width="14" height="45" rx="3" fill="url(#emptyGrad)" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
          <rect x="90" y="10" width="14" height="65" rx="3" fill="url(#emptyGrad)" className="animate-pulse" style={{ animationDelay: '0.8s' }} />
          <defs>
            <linearGradient id="emptyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#606060" />
              <stop offset="100%" stopColor="#404040" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Icon */}
      <div className="mb-4" style={{ color: '#404040' }}>
        {icon}
      </div>

      {/* Gradient title */}
      <h3
        className="text-xl font-bold mb-3 bg-clip-text text-transparent"
        style={{ backgroundImage: 'linear-gradient(135deg, #F5F5F5 0%, #9A9A9A 100%)' }}
      >
        {title}
      </h3>

      <p className="text-secondary max-w-[440px] mb-8 leading-relaxed">{description}</p>

      <div className="flex items-center gap-4">
        {action && (
          <Link
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-full text-white text-sm font-semibold transition-all duration-300"
            style={{ background: '#6366f1' }}
          >
            {action.label}
          </Link>
        )}
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-full text-secondary hover:text-white text-sm font-medium transition-colors border border-white/10"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  )
}
