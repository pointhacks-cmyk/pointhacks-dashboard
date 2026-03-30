import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// We query Supabase directly via postgres connection for the materialized view
// Since Supabase client can query views, let's use raw SQL via RPC or direct table access

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const intent = parseInt(searchParams.get('intent') || '0')
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
  const sort = searchParams.get('sort') || 'opportunity'
  const search = searchParams.get('q') || ''

  try {
    let query = supabase
      .from('keyword_intelligence')
      .select('*')
      .gte('intent_score', intent)

    if (search) {
      query = query.ilike('query', `%${search}%`)
    }

    const orderCol = sort === 'opportunity' ? 'opportunity_score'
      : sort === 'impressions' ? 'impressions'
      : sort === 'clicks' ? 'clicks'
      : sort === 'position' ? 'avg_position'
      : sort === 'trend' ? 'impression_trend'
      : 'opportunity_score'

    const ascending = sort === 'position'
    query = query.order(orderCol, { ascending, nullsFirst: false }).limit(limit)

    const { data, error } = await query
    if (error) throw error

    // Compute summary stats
    const commercial = (data || []).filter(r => r.intent_score >= 2)
    const quickWins = commercial.filter(r => r.avg_position >= 4 && r.avg_position <= 15 && r.impressions >= 500)
    const rising = (data || []).filter(r => r.impression_trend && r.impression_trend > 50 && r.intent_score >= 1)
    const declining = (data || []).filter(r => r.impression_trend && r.impression_trend < -30 && r.intent_score >= 1 && r.clicks > 10)
    const positionGains = commercial.filter(r => r.position_change && r.position_change < -2)
    const positionLosses = commercial.filter(r => r.position_change && r.position_change > 2)

    return NextResponse.json({
      keywords: data || [],
      summary: {
        total: data?.length || 0,
        commercial: commercial.length,
        quickWins: quickWins.length,
        rising: rising.length,
        declining: declining.length,
        positionGains: positionGains.length,
        positionLosses: positionLosses.length,
      },
      quickWins: quickWins.sort((a, b) => b.impressions - a.impressions).slice(0, 20),
      rising: rising.sort((a, b) => b.impression_trend! - a.impression_trend!).slice(0, 20),
      declining: declining.sort((a, b) => a.impression_trend! - b.impression_trend!).slice(0, 10),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
