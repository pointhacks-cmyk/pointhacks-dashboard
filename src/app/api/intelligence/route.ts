import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function fetchAllRows(table: string, filters: { col: string; op: string; val: string }[] = [], select = '*') {
  const rows: any[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1)
    for (const f of filters) q = (q as any)[f.op](f.col, f.val)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

function toNum(v: any): number { return Number(v) || 0 }

export async function GET(req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const thisMonthStart = today.slice(0, 8) + '01'
    const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
    const dayOfMonth = Number(today.slice(8, 10))

    // Fetch last 14 months of data for seasonality + anomalies
    const fourteenMonthsAgo = new Date()
    fourteenMonthsAgo.setMonth(fourteenMonthsAgo.getMonth() - 14)
    const startDate = fourteenMonthsAgo.toISOString().slice(0, 10)

    const allRows = await fetchAllRows('partner_performance', [
      { col: 'date', op: 'gte', val: startDate },
      { col: 'date', op: 'lte', val: today },
    ])

    const rows = allRows.filter((r: any) => r.partner !== 'Total')

    // Get financial target
    const { data: targets } = await supabase.from('financial_targets').select('*').limit(1)
    const monthlyGPTarget = toNum(targets?.[0]?.monthly_gp_target) || 550000

    // ========== PROJECTIONS ==========
    // Group by partner + month
    const partnerMonthly: Record<string, Record<string, { rev: number; gp: number; apps: number; clicks: number; days: number; revPerApp: number }>> = {}
    const partnerDaily: Record<string, { date: string; rev: number; gp: number; apps: number; clicks: number; revPerApp: number }[]> = {}

    for (const r of rows) {
      const partner = r.partner
      const month = r.date.slice(0, 7)
      const rev = toNum(r.revenue) + toNum(r.sponsorship_revenue)
      const gp = toNum(r.gross_profit)
      const apps = toNum(r.credit_card_applications)
      const clicks = toNum(r.bank_clicks)

      if (!partnerMonthly[partner]) partnerMonthly[partner] = {}
      if (!partnerMonthly[partner][month]) partnerMonthly[partner][month] = { rev: 0, gp: 0, apps: 0, clicks: 0, days: 0, revPerApp: 0 }
      const pm = partnerMonthly[partner][month]
      pm.rev += rev; pm.gp += gp; pm.apps += apps; pm.clicks += clicks; pm.days++

      if (!partnerDaily[partner]) partnerDaily[partner] = []
      partnerDaily[partner].push({ date: r.date.slice(0, 10), rev, gp, apps, clicks, revPerApp: apps > 0 ? rev / apps : 0 })
    }

    // Calculate rev/app for each month
    for (const p of Object.keys(partnerMonthly)) {
      for (const m of Object.keys(partnerMonthly[p])) {
        const pm = partnerMonthly[p][m]
        pm.revPerApp = pm.apps > 0 ? pm.rev / pm.apps : 0
      }
    }

    // MTD projections per partner
    const thisMonth = today.slice(0, 7)
    const lastYearMonth = `${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}`
    const projections: any[] = []
    let totalMTDRev = 0, totalMTDGP = 0, totalProjectedRev = 0, totalProjectedGP = 0

    for (const [partner, months] of Object.entries(partnerMonthly)) {
      const mtd = months[thisMonth]
      const lastYear = months[lastYearMonth]
      if (!mtd) continue

      const dailyRate = mtd.rev / mtd.days
      const dailyGPRate = mtd.gp / mtd.days
      const projectedRev = dailyRate * daysInMonth
      const projectedGP = dailyGPRate * daysInMonth
      const yoyChange = lastYear ? ((projectedRev - lastYear.rev) / lastYear.rev) * 100 : null

      // Rev/app trend (last 3 months)
      const recentMonths = Object.keys(months).sort().slice(-4, -1) // exclude current partial month
      const revPerAppTrend = recentMonths.map(m => ({ month: m, revPerApp: months[m].revPerApp }))

      totalMTDRev += mtd.rev
      totalMTDGP += mtd.gp
      totalProjectedRev += projectedRev
      totalProjectedGP += projectedGP

      projections.push({
        partner,
        mtdRev: mtd.rev,
        mtdGP: mtd.gp,
        mtdApps: mtd.apps,
        mtdClicks: mtd.clicks,
        mtdDays: mtd.days,
        dailyRevRate: dailyRate,
        dailyGPRate,
        projectedRev,
        projectedGP,
        projectedApps: (mtd.apps / mtd.days) * daysInMonth,
        lastYearRev: lastYear?.rev || null,
        lastYearGP: lastYear?.gp || null,
        yoyChange,
        revPerApp: mtd.apps > 0 ? mtd.rev / mtd.apps : 0,
        revPerAppTrend,
      })
    }

    const gpPace = totalProjectedGP
    const gpTarget = monthlyGPTarget
    const gpOnTrack = gpPace >= gpTarget * 0.95

    // ========== ANOMALY DETECTION ==========
    const anomalies: any[] = []

    for (const [partner, daily] of Object.entries(partnerDaily)) {
      const sorted = daily.sort((a, b) => a.date.localeCompare(b.date))

      // Rolling 14-day average (excluding last 2 days to avoid partial data)
      const recent = sorted.slice(-16, -2)
      const last2 = sorted.slice(-2)
      if (recent.length < 7) continue

      const avgRev = recent.reduce((s, d) => s + d.rev, 0) / recent.length
      const avgApps = recent.reduce((s, d) => s + d.apps, 0) / recent.length
      const avgClicks = recent.reduce((s, d) => s + d.clicks, 0) / recent.length
      const avgRevPerApp = recent.filter(d => d.apps > 0).reduce((s, d) => s + d.revPerApp, 0) / (recent.filter(d => d.apps > 0).length || 1)

      for (const day of last2) {
        // Revenue drop >50%
        if (avgRev > 100 && day.rev < avgRev * 0.5) {
          anomalies.push({
            partner, date: day.date, type: 'revenue_drop',
            severity: day.rev === 0 ? 'critical' : 'warning',
            message: `Revenue dropped to $${day.rev.toFixed(0)} (avg: $${avgRev.toFixed(0)})`,
            actual: day.rev, expected: avgRev,
          })
        }
        // Apps drop >50%
        if (avgApps > 2 && day.apps < avgApps * 0.5) {
          anomalies.push({
            partner, date: day.date, type: 'application_drop',
            severity: day.apps === 0 ? 'critical' : 'warning',
            message: `Applications dropped to ${day.apps.toFixed(0)} (avg: ${avgApps.toFixed(0)})`,
            actual: day.apps, expected: avgApps,
          })
        }
        // Clicks drop >50%
        if (avgClicks > 10 && day.clicks < avgClicks * 0.5) {
          anomalies.push({
            partner, date: day.date, type: 'click_drop',
            severity: day.clicks === 0 ? 'critical' : 'warning',
            message: `Clicks dropped to ${day.clicks} (avg: ${avgClicks.toFixed(0)})`,
            actual: day.clicks, expected: avgClicks,
          })
        }
      }

      // Rev/app trending down (7-day declining trend)
      const last14WithApps = sorted.filter(d => d.apps > 0).slice(-14)
      if (last14WithApps.length >= 10) {
        const first7 = last14WithApps.slice(0, 7)
        const last7 = last14WithApps.slice(-7)
        const firstAvg = first7.reduce((s, d) => s + d.revPerApp, 0) / 7
        const lastAvg = last7.reduce((s, d) => s + d.revPerApp, 0) / 7
        if (firstAvg > 50 && lastAvg < firstAvg * 0.85) {
          anomalies.push({
            partner, date: last7[last7.length - 1].date, type: 'revperapp_decline',
            severity: 'warning',
            message: `Rev/app declining: $${lastAvg.toFixed(0)} vs $${firstAvg.toFixed(0)} (prior 7d)`,
            actual: lastAvg, expected: firstAvg,
          })
        }
      }

      // Consecutive zero days
      const lastDays = sorted.slice(-5)
      const consecutiveZeroApps = lastDays.filter(d => d.apps === 0).length
      if (consecutiveZeroApps >= 2 && avgApps > 1) {
        anomalies.push({
          partner, date: lastDays[lastDays.length - 1].date, type: 'data_gap',
          severity: 'critical',
          message: `${consecutiveZeroApps} days with 0 applications (possible reporting issue)`,
          actual: 0, expected: avgApps,
        })
      }
    }

    // ========== PARTNER TRENDS ==========
    // Last 6 months trend per partner
    const partners = Object.keys(partnerMonthly)
    const allMonths = [...new Set(Object.values(partnerMonthly).flatMap(m => Object.keys(m)))].sort().slice(-7)
    const trends = partners.map(partner => ({
      partner,
      months: allMonths.map(m => ({
        month: m,
        rev: partnerMonthly[partner]?.[m]?.rev || 0,
        gp: partnerMonthly[partner]?.[m]?.gp || 0,
        apps: partnerMonthly[partner]?.[m]?.apps || 0,
        revPerApp: partnerMonthly[partner]?.[m]?.revPerApp || 0,
      })),
    }))

    return NextResponse.json({
      asOf: today,
      daysInMonth,
      dayOfMonth,
      monthlyGPTarget: gpTarget,
      totalMTD: { rev: totalMTDRev, gp: totalMTDGP },
      totalProjected: { rev: totalProjectedRev, gp: totalProjectedGP },
      gpOnTrack,
      projections: projections.sort((a, b) => b.projectedRev - a.projectedRev),
      anomalies: anomalies.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1)),
      trends,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
