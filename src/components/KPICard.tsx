'use client'

import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface KPICardProps {
  title: string
  value: string
  change: number
  sparklineData: number[]
  icon: React.ReactNode
  index?: number
}

function useCountUp(target: string, duration = 1000) {
  const [display, setDisplay] = useState('0')
  const rafRef = useRef<number>(null)

  useEffect(() => {
    const isPercent = target.endsWith('%')
    const numeric = parseFloat(target.replace(/[^0-9.\-]/g, ''))
    if (isNaN(numeric)) { setDisplay(target); return }

    const start = performance.now()
    const fmt = (n: number) => {
      if (isPercent) return `${n.toFixed(1)}%`
      return Math.round(n).toLocaleString()
    }

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(fmt(numeric * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return display
}

export default function KPICard({ title, value, change, sparklineData, icon, index = 0 }: KPICardProps) {
  const isPositive = change >= 0
  const chartData = sparklineData.map((v, i) => ({ i, v }))
  const animatedValue = useCountUp(value)
  const gradientId = `spark-${title.replace(/\s/g, '-')}`

  return (
    <div
      className="glass-card p-5 flex items-center justify-between gap-4 group animate-in"
      style={{
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'both',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#404040' }}
          >
            {icon}
          </div>
          <span className="text-secondary text-[13px] uppercase tracking-wider font-medium">{title}</span>
        </div>
        <div className="metric-number text-3xl font-bold mb-1">{animatedValue}</div>
        <div className="flex items-center gap-1 text-sm" style={{ color: isPositive ? '#34D399' : '#EF4444' }}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
        </div>
        <div className="text-[11px] text-secondary/60 mt-0.5">vs last 7 days</div>
      </div>
      <div className="w-[80px] h-[50px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="#34D399"
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={true}
              animationDuration={1500}
              animationBegin={index * 100 + 300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>


    </div>
  )
}
