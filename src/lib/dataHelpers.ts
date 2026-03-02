import { supabase } from '@/lib/supabase'

// Supabase returns max 1000 rows per query. Paginate to fetch all.
export async function fetchAllRows(table: string, startDate: string, endDate: string): Promise<any[]> {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(offset, offset + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return allData
}

export function aggregateRows<T extends Record<string, any>>(raw: any[], groupKey: string): T[] {
  // Step 1: Deduplicate — keep one row per (groupKey + date), taking the first occurrence
  const deduped = new Map<string, any>()
  for (const r of raw) {
    const dedupeKey = `${r[groupKey]}|${r.date}`
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, r)
    }
  }

  // Step 2: Aggregate deduplicated rows by groupKey (sum across dates)
  const map = new Map<string, { clicks: number; impressions: number; ctr_sum: number; pos_sum: number; count: number }>()
  for (const r of deduped.values()) {
    const key = r[groupKey]
    const existing = map.get(key)
    if (existing) {
      existing.clicks += r.clicks || 0
      existing.impressions += r.impressions || 0
      existing.ctr_sum += r.ctr || 0
      existing.pos_sum += r.position || 0
      existing.count++
    } else {
      map.set(key, { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr_sum: r.ctr || 0, pos_sum: r.position || 0, count: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({
      [groupKey]: k,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: (v.ctr_sum / v.count) * 100,
      position: v.pos_sum / v.count,
    } as unknown as T))
    .sort((a: any, b: any) => b.clicks - a.clicks)
}
