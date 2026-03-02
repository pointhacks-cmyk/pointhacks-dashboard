'use client'
import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

export type DatePreset = '7d' | '28d' | '3m' | '6m' | '12m' | 'custom'

interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  preset: DatePreset
  compareEnabled: boolean
  compareStartDate: string
  compareEndDate: string
}

interface DateRangeContextType {
  dateRange: DateRange
  setPreset: (preset: DatePreset) => void
  setCustomRange: (start: string, end: string) => void
  toggleCompare: () => void
}

function computeRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  switch (preset) {
    case '7d': start.setDate(end.getDate() - 7); break
    case '28d': start.setDate(end.getDate() - 28); break
    case '3m': start.setMonth(end.getMonth() - 3); break
    case '6m': start.setMonth(end.getMonth() - 6); break
    case '12m': start.setFullYear(end.getFullYear() - 1); break
    default: start.setDate(end.getDate() - 28)
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function computeCompareRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start), e = new Date(end)
  const diff = e.getTime() - s.getTime()
  const compEnd = new Date(s.getTime() - 86400000) // day before start
  const compStart = new Date(compEnd.getTime() - diff)
  return { start: compStart.toISOString().slice(0, 10), end: compEnd.toISOString().slice(0, 10) }
}

const DateRangeContext = createContext<DateRangeContextType | null>(null)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const initial = computeRange('28d')
  const initialComp = computeCompareRange(initial.start, initial.end)
  
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: initial.start,
    endDate: initial.end,
    preset: '28d',
    compareEnabled: false,
    compareStartDate: initialComp.start,
    compareEndDate: initialComp.end,
  })

  const setPreset = useCallback((preset: DatePreset) => {
    if (preset === 'custom') return
    const { start, end } = computeRange(preset)
    const comp = computeCompareRange(start, end)
    setDateRange(prev => ({ ...prev, preset, startDate: start, endDate: end, compareStartDate: comp.start, compareEndDate: comp.end }))
  }, [])

  const setCustomRange = useCallback((start: string, end: string) => {
    const comp = computeCompareRange(start, end)
    setDateRange(prev => ({ ...prev, preset: 'custom' as DatePreset, startDate: start, endDate: end, compareStartDate: comp.start, compareEndDate: comp.end }))
  }, [])

  const toggleCompare = useCallback(() => {
    setDateRange(prev => ({ ...prev, compareEnabled: !prev.compareEnabled }))
  }, [])

  return (
    <DateRangeContext.Provider value={{ dateRange, setPreset, setCustomRange, toggleCompare }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
