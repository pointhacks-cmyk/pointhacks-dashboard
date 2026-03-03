import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/page-inspect/history?page_path=/credit-cards/  → list of past inspections
// GET /api/page-inspect/history?id=123                     → single full inspection
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const pagePath = searchParams.get('page_path')

  if (id) {
    const { data, error } = await supabase
      .from('page_inspections')
      .select('*')
      .eq('id', Number(id))
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  // List inspections — optionally filtered by page_path
  let query = supabase
    .from('page_inspections')
    .select('id, page_path, url, created_at, gsc_metrics')
    .order('created_at', { ascending: false })
    .limit(50)

  if (pagePath) {
    query = query.eq('page_path', pagePath)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
