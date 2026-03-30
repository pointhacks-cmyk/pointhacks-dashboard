import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const latest = searchParams.get('latest')
  const download = searchParams.get('download')

  try {
    if (download && date) {
      // Return Excel file for download
      const { data, error } = await supabase
        .from('daily_reports')
        .select('excel_base64, report_date')
        .eq('report_date', date)
        .single()
      if (error || !data?.excel_base64) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      const buf = Buffer.from(data.excel_base64, 'base64')
      const filename = `Daily_Report_${data.report_date.replace(/-/g, '_')}.xlsx`
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      })
    }

    if (date) {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date, report_data, created_at, updated_at')
        .eq('report_date', date)
        .single()
      if (error) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    if (latest === 'true') {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date, report_data, created_at, updated_at')
        .order('report_date', { ascending: false })
        .limit(1)
        .single()
      if (error) return NextResponse.json({ error: 'No reports found' }, { status: 404 })
      return NextResponse.json(data)
    }

    // List all available report dates
    const { data, error } = await supabase
      .from('daily_reports')
      .select('report_date, updated_at')
      .order('report_date', { ascending: false })
      .limit(60)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
