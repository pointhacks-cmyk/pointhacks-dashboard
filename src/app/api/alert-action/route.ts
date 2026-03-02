import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { alertId, alertTitle, alertType, query, page, action, position, ctr } = body

    if (!alertId || !action) {
      return NextResponse.json({ error: 'Missing alertId or action' }, { status: 400 })
    }

    // Save action to DB
    const { data: record, error: insertErr } = await supabase
      .from('monitor_actions')
      .insert({
        alert_id: alertId,
        alert_title: alertTitle,
        alert_type: alertType,
        query: query || null,
        page: page || null,
        action,
        status: 'completed',
        result: buildResult(action, alertType, query, page, position, ctr),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      actionId: record.id,
      action,
      result: record.result,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildResult(action: string, alertType: string, query: string | null, page: string | null, position: number | null, ctr: number | null) {
  const pos = position || 0
  const ctrPct = ctr ? (ctr * 100).toFixed(1) : '0'

  switch (action) {
    case 'ignore':
      return {
        status: 'dismissed',
        heading: 'Alert Dismissed',
        message: 'This alert has been dismissed and logged. It will be archived until next data change.',
        icon: 'check',
      }

    case 'fix':
      if (alertType === 'ctr_anomaly') {
        const expected = pos <= 1 ? 28 : pos <= 3 ? 15 : pos <= 5 ? 8 : pos <= 10 ? 3 : 1
        return {
          status: 'fix_ready',
          heading: 'Fix Recommendations',
          tasks: [
            {
              priority: 'high',
              title: 'Review & update title tag',
              detail: `Current CTR is ${ctrPct}% at position ${pos.toFixed(0)} — expected ~${expected}%. The title tag isn't compelling enough to drive clicks. Make it specific, add current year, and front-load the keyword.`,
            },
            {
              priority: 'high',
              title: 'Rewrite meta description',
              detail: `Add a clear value proposition and CTA. Include "${query}" naturally. Keep under 160 characters. Mention unique angles like "expert comparison" or "updated weekly".`,
            },
            {
              priority: 'medium',
              title: 'Check for rich snippet eligibility',
              detail: 'Add structured data (FAQ schema, Review schema) to earn rich snippets which increase CTR by 20-30%.',
            },
            {
              priority: 'low',
              title: 'A/B test with Google Search Console',
              detail: 'Change the title, wait 2-3 weeks, compare CTR. If no improvement, test meta description next.',
            },
          ],
        }
      } else if (alertType === 'position_drop') {
        return {
          status: 'fix_ready',
          heading: 'Fix Recommendations',
          tasks: [
            {
              priority: 'high',
              title: 'Check for content freshness',
              detail: `"${query}" may be losing position due to stale content. Update key stats, dates, card offers, and any outdated information.`,
            },
            {
              priority: 'high',
              title: 'Audit internal linking',
              detail: 'Ensure this page has strong internal links from high-authority pages on the site. Add 3-5 contextual links from related pages.',
            },
            {
              priority: 'medium',
              title: 'Check competitor SERP',
              detail: `Google "${query}" and compare your content vs the top 3 results. Are they longer? More detailed? Better structured? Match or exceed their depth.`,
            },
            {
              priority: 'medium',
              title: 'Review Core Web Vitals',
              detail: 'Run a PageSpeed Insights check on the ranking page. Slow pages lose position over time.',
            },
          ],
        }
      } else if (alertType === 'traffic_drop') {
        return {
          status: 'fix_ready',
          heading: 'Fix Recommendations',
          tasks: [
            {
              priority: 'high',
              title: 'Identify dropped queries',
              detail: `Check Search Console for this URL — which queries lost clicks? Focus on the highest-volume ones first.`,
            },
            {
              priority: 'high',
              title: 'Content refresh',
              detail: `Update the page with current offers, rates, and comparisons. Add a "Last updated: ${new Date().toLocaleDateString('en-AU')}" to signal freshness.`,
            },
            {
              priority: 'medium',
              title: 'Check for cannibalisation',
              detail: 'Verify no other page on the site is competing for the same keywords. Consolidate if needed.',
            },
          ],
        }
      }
      return {
        status: 'fix_ready',
        heading: 'Fix Recommendations',
        tasks: [{
          priority: 'high',
          title: 'Investigate and resolve',
          detail: `Review the affected query "${query || 'unknown'}" in Search Console and identify the root cause.`,
        }],
      }

    case 'analysis':
      return {
        status: 'analysis_complete',
        heading: 'Analysis',
        sections: [
          {
            title: 'Current Performance',
            items: [
              query ? `Query: "${query}"` : null,
              page ? `Page: ${page.replace('https://www.pointhacks.com.au', '')}` : null,
              pos ? `Average position: #${pos.toFixed(1)}` : null,
              ctr ? `Click-through rate: ${ctrPct}%` : null,
              pos <= 3 ? 'Status: Top 3 — focus on defending position' : pos <= 10 ? 'Status: Page 1 — push for top 3' : pos <= 20 ? 'Status: Page 2 — needs significant improvement' : 'Status: Deep pages — consider content overhaul',
            ].filter(Boolean),
          },
          {
            title: 'Recommended Next Steps',
            items: alertType === 'ctr_anomaly' ? [
              'Google the query and screenshot the SERP — how does your listing look vs competitors?',
              'Compare your title tag length, keyword placement, and emotional hooks vs top 3',
              'Check if competitors have rich snippets, ratings, or FAQ schema you\'re missing',
              'Review if the query intent matches your page content (informational vs transactional)',
            ] : alertType === 'position_drop' ? [
              'Check Google Search Console > Performance for this query over 28 days',
              'Look for algorithm update timing — did the drop coincide with a known update?',
              'Compare your content depth and word count vs the pages that overtook you',
              'Check backlink profile — have you lost any key links recently?',
            ] : [
              'Review the page in Search Console for all queries driving traffic',
              'Check for any technical issues (404s, redirects, slow load)',
              'Verify the page is still indexed — run "site:url" in Google',
              'Compare week-over-week data to isolate the exact drop point',
            ],
          },
        ],
      }

    case 'implement':
      if (alertType === 'ctr_anomaly') {
        const keyword = query || 'credit card'
        const keywordTitle = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        return {
          status: 'implementation_ready',
          heading: 'Implementation Plan',
          changes: [
            {
              field: 'Title Tag',
              suggestion: `${keywordTitle}: Compare & Find the Best (2026) | Point Hacks`,
              reasoning: 'Front-loads keyword, includes year for freshness, adds value proposition, stays under 60 chars.',
            },
            {
              field: 'Meta Description',
              suggestion: `Compare the best ${keyword} options in Australia. Expert reviews, real data, and insider tips to maximise your points and rewards. Updated ${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}.`,
              reasoning: 'Includes primary keyword, clear value prop, current date for freshness, actionable language.',
            },
          ],
          steps: [
            'Copy the suggested title and meta description above',
            'Update in your CMS (WordPress SEO plugin / Yoast / custom fields)',
            'Publish the changes',
            'Monitor CTR in Search Console for 2-3 weeks',
            'If CTR improves >20%, apply similar pattern to other low-CTR pages',
          ],
        }
      }
      return {
        status: 'implementation_ready',
        heading: 'Implementation Plan',
        changes: [],
        steps: [
          `Open the affected ${page ? 'page' : 'query'} in your CMS`,
          'Update content with fresh data, stats, and offers',
          'Ensure keyword density is natural and competitive',
          'Add internal links from 3-5 related high-traffic pages',
          'Republish and submit URL to Google Search Console for re-indexing',
          'Set a reminder to check performance in 2 weeks',
        ],
      }

    case 'recommended_fix': {
      // Build a structured recommendation based on alert type
      const summaries: Record<string, { summary: string; rootCause: string; steps: string[]; priority: string; impact: string }> = {
        position_drop: {
          summary: `The query "${query || 'unknown'}" has dropped in position, which directly impacts click volume and traffic from search.`,
          rootCause: 'Likely causes include content staleness, increased competition, algorithm updates, or loss of backlinks. Competitors may have published fresher, more comprehensive content.',
          steps: [
            'Update the page content with current data, offers, and comparisons',
            'Audit and improve internal linking — add 3-5 links from high-authority pages',
            'Google the query and compare your content depth vs top 3 competitors',
            'Check Core Web Vitals via PageSpeed Insights',
            'Submit URL for re-indexing in Search Console',
          ],
          priority: 'high',
          impact: `Recovery could restore ~${Math.round((pos || 5) * 50)} clicks/month`,
        },
        ctr_anomaly: {
          summary: `The query "${query || 'unknown'}" has a CTR of ${ctrPct}% which is significantly below expected for its position. Users are seeing but not clicking.`,
          rootCause: 'The title tag and meta description likely aren\'t compelling enough. May also be missing rich snippets or structured data that competitors have.',
          steps: [
            'Rewrite the title tag — front-load keyword, add current year, include value proposition',
            'Rewrite meta description with clear CTA and unique selling point',
            'Add FAQ schema or Review schema for rich snippet eligibility',
            'Check SERP appearance vs competitors for visual differences',
            'Monitor CTR for 2-3 weeks after changes',
          ],
          priority: 'high',
          impact: 'Improving CTR to expected levels could 2-3x click volume',
        },
        traffic_drop: {
          summary: `Traffic to ${page ? page.replace('https://www.pointhacks.com.au', '') : 'this page'} has dropped significantly week-over-week.`,
          rootCause: 'Could be seasonal, position drops on key queries, content cannibalisation, or technical issues like slow load times or indexing problems.',
          steps: [
            'Check Search Console for which specific queries lost clicks',
            'Verify the page is still indexed (search site:url in Google)',
            'Check for content cannibalisation with similar pages',
            'Refresh content with current offers and add "Last updated" date',
            'Review page speed and mobile experience',
          ],
          priority: 'medium',
          impact: 'Addressing the root cause typically recovers 60-80% of lost traffic',
        },
        disappeared: {
          summary: `The query "${query || 'unknown'}" had clicks last week but zero this week — it may have dropped out of visible rankings.`,
          rootCause: 'The page may have been de-indexed, a redirect may have broken, or a competitor\'s new content displaced your ranking entirely.',
          steps: [
            'Search for the query in Google to check if your page still appears',
            'Check Search Console > Pages for any indexing errors',
            'Verify no accidental noindex tags or broken redirects',
            'If content is thin, consider a major content refresh or merge with stronger page',
          ],
          priority: 'high',
          impact: 'Re-ranking for this query could recover all previously lost traffic',
        },
      }

      const rec = summaries[alertType] || {
        summary: `Alert detected for "${query || page || 'unknown'}". This needs investigation.`,
        rootCause: 'Multiple factors may contribute. Review Search Console data and recent site changes.',
        steps: ['Review the alert details in Search Console', 'Compare current vs historical performance', 'Identify and address the root cause', 'Monitor for improvement'],
        priority: 'medium',
        impact: 'Varies based on root cause',
      }

      return {
        status: 'recommended_fix',
        heading: 'Recommended Fix',
        recommendation: rec,
      }
    }

    default:
      return { status: 'unknown', heading: 'Unknown Action', message: 'Action not recognized.' }
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('monitor_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ actions: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
