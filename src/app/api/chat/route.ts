// @ts-nocheck
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const obj = { type: 'object' as const }
const str = { type: 'string' as const }
const num = { type: 'number' as const }

// ─── 75 Tool definitions ────────────────────────────────────────
const tools: any[] = [
  // === ORIGINAL 15 ===
  {
    name: 'query_gsc_keywords',
    description: 'Search GSC keyword data. Returns aggregated queries with clicks, impressions, avg_position, avg_ctr. Filter by min_clicks, min_impressions, position range, or keyword text.',
    input_schema: { ...obj, properties: { search: str, sort_by: { ...str, enum: ['clicks','impressions','avg_position','avg_ctr'] }, sort_order: { ...str, enum: ['asc','desc'] }, min_clicks: num, min_impressions: num, min_position: num, max_position: num, limit: num } },
  },
  {
    name: 'query_gsc_pages',
    description: 'Search GSC page-level data. Returns aggregated pages with clicks, impressions, avg_position, avg_ctr.',
    input_schema: { ...obj, properties: { search: str, sort_by: { ...str, enum: ['clicks','impressions','avg_position','avg_ctr'] }, sort_order: { ...str, enum: ['asc','desc'] }, min_clicks: num, min_impressions: num, min_position: num, max_position: num, limit: num } },
  },
  {
    name: 'get_gsc_kpis',
    description: 'Get overall GSC KPI totals: total_clicks, total_impressions, unique_queries, avg_ctr, avg_position at query and page level.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'get_ctr_by_position',
    description: 'Get CTR breakdown by position bucket (1, 2-3, 4-10, 11-20, 21+).',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'get_ga4_daily',
    description: 'Get GA4 daily metrics: sessions, pageviews, users, bounce_rate, avg_session_duration.',
    input_schema: { ...obj, properties: { days: num } },
  },
  {
    name: 'get_ga4_pages',
    description: 'Get GA4 page analytics: sessions, pageviews, bounce_rate, avg_time_on_page, entrances, exits.',
    input_schema: { ...obj, properties: { search: str, sort_by: { ...str, enum: ['sessions','pageviews','bounce_rate','avg_time_on_page'] }, sort_order: { ...str, enum: ['asc','desc'] }, min_sessions: num, limit: num } },
  },
  {
    name: 'get_ga4_traffic_sources',
    description: 'Get traffic source breakdown: source, medium, sessions, users, bounce_rate, pages_per_session.',
    input_schema: { ...obj, properties: { sort_by: { ...str, enum: ['sessions','users','bounce_rate'] }, limit: num } },
  },
  {
    name: 'get_seo_keywords',
    description: 'Get DataForSEO tracked keywords: keyword, position, search_volume, cpc, competition, url.',
    input_schema: { ...obj, properties: { search: str } },
  },
  {
    name: 'find_ctr_issues',
    description: 'Find queries with below-expected CTR at high positions. Includes estimated lost clicks.',
    input_schema: { ...obj, properties: { max_position: num, min_impressions: num, limit: num } },
  },
  {
    name: 'find_quick_wins',
    description: 'Find keyword opportunities at position 4-15 with high impressions.',
    input_schema: { ...obj, properties: { min_position: num, max_position: num, min_impressions: num, limit: num } },
  },
  {
    name: 'find_declining_content',
    description: 'Find pages with poor visibility or high bounce rates for content audit.',
    input_schema: { ...obj, properties: { min_position: num, min_impressions: num, min_bounce_rate: num, limit: num } },
  },
  {
    name: 'compare_periods',
    description: 'Compare two time periods of GA4 data with percentage changes.',
    input_schema: { ...obj, properties: { days: num } },
  },
  {
    name: 'get_position_distribution',
    description: 'Distribution of keywords across position buckets with click/impression totals.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'search_everything',
    description: 'Full-text search across ALL data sources — GSC queries, pages, GA4, SEO keywords.',
    input_schema: { ...obj, properties: { query: str }, required: ['query'] },
  },
  {
    name: 'get_content_gaps',
    description: 'Wasted impressions + poor-ranking high-volume keywords.',
    input_schema: { ...obj, properties: { min_impressions: num } },
  },
  // === 30 NEW TOOLS ===
  {
    name: 'analyze_page_deep',
    description: 'Deep analysis of a specific page — all GSC queries driving traffic to it, GA4 engagement, position distribution. Use when asked about a specific URL or topic.',
    input_schema: { ...obj, properties: { url_pattern: str }, required: ['url_pattern'] },
  },
  {
    name: 'detect_cannibalization',
    description: 'Find keyword cannibalization — multiple pages ranking for the same query, splitting ranking signals. Returns query with all competing pages.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'brand_vs_nonbrand',
    description: 'Split all keywords into branded (containing "point hack", "pointhack", etc.) vs non-branded. Shows click/impression share for each.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'longtail_analysis',
    description: 'Analyze long-tail (4+ words) vs short-tail (1-3 words) keyword performance. Shows volume, CTR, position averages for each group.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'zero_click_pages',
    description: 'Find pages with impressions but zero or very few clicks. High-priority optimization targets.',
    input_schema: { ...obj, properties: { min_impressions: num, max_clicks: num, limit: num } },
  },
  {
    name: 'top_growing_keywords',
    description: 'Find keywords with high impressions relative to position — indicating growing search interest or improving rankings.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'featured_snippet_opportunities',
    description: 'Find queries at position 1-5 with informational intent (questions, "how to", "what is", "best") — prime featured snippet candidates.',
    input_schema: { ...obj, properties: { max_position: num, min_impressions: num, limit: num } },
  },
  {
    name: 'url_structure_analysis',
    description: 'Analyze site URL structure — group pages by directory (/credit-cards/, /travel/, etc.) with aggregate performance per section.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'keyword_clustering',
    description: 'Cluster related keywords by topic/intent. Groups queries containing common terms and shows aggregate metrics per cluster.',
    input_schema: { ...obj, properties: { min_cluster_size: num, limit: num } },
  },
  {
    name: 'engagement_scoring',
    description: 'Score pages by engagement — combines bounce rate, time on page, and sessions into a composite score. Returns best and worst engaging pages.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'content_roi',
    description: 'Estimate content ROI — clicks per page weighted by position difficulty. Identifies highest and lowest performing content investments.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'question_keywords',
    description: 'Find all question-based keywords (who, what, where, when, why, how, can, does, is, are). Great for FAQ and content planning.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'competitor_keyword_overlap',
    description: 'Find keywords where pointhacks ranks alongside competitor terms (e.g., queries mentioning "finder", "creditcard.com.au", "canstar").',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'seasonal_patterns',
    description: 'Analyze daily traffic patterns — day-of-week averages, weekend vs weekday performance.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'thin_content_detection',
    description: 'Find pages with very low engagement — high bounce, low time on page, low sessions. Candidates for consolidation or removal.',
    input_schema: { ...obj, properties: { max_sessions: num, min_bounce_rate: num, limit: num } },
  },
  {
    name: 'traffic_source_comparison',
    description: 'Compare organic vs direct vs referral vs social traffic with engagement metrics for each channel.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'top_entry_exit_pages',
    description: 'Find top entry pages (where users land) and exit pages (where users leave). Identifies funnel leaks.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'keyword_difficulty_estimate',
    description: 'Estimate keyword difficulty based on current position, impressions, and CTR. Categorizes keywords as easy/medium/hard to rank for.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'page_impressions_no_ranking',
    description: 'Find pages getting impressions but ranking very poorly (position 50+). These have indexed but may need complete rewrites.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'ctr_benchmarking',
    description: 'Compare actual CTR vs industry benchmarks at each position. Identifies over/underperforming positions system-wide.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'keyword_intent_breakdown',
    description: 'Classify all keywords by search intent: navigational, informational, commercial, transactional. Shows volume per intent type.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'page_velocity',
    description: 'Estimate page "velocity" — clicks per impression ratio at each position level. Identifies pages that convert searches to visits most efficiently.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'striking_distance',
    description: 'Find keywords at the bottom of page 1 or top of page 2 (position 8-15) with 1000+ impressions. Highest ROI optimization targets.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'get_executive_summary',
    description: 'Generate a comprehensive executive summary — KPIs, trends, top wins, critical issues, opportunities, all in one call. Use for "give me the big picture" type questions.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'keyword_gap_by_topic',
    description: 'Analyze coverage across key topics (credit cards, frequent flyer, qantas, velocity, travel, points). Shows which topics have strong/weak coverage.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'pages_per_click_efficiency',
    description: 'Rank pages by click efficiency — clicks divided by number of ranking queries. Shows which pages extract the most value from their keyword portfolio.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'impression_share_analysis',
    description: 'Analyze impression distribution — which queries/pages dominate impressions, concentration risk, and long-tail opportunity.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'bounce_rate_outliers',
    description: 'Find pages with abnormally high or low bounce rates compared to site average. Both extremes are interesting — high for fixes, low for replication.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'query_raw_sql',
    description: 'Execute a custom aggregation on GSC query data. Allows flexible filtering and grouping not covered by other tools. Specify filters as key-value conditions.',
    input_schema: { ...obj, properties: { search: str, min_clicks: num, max_clicks: num, min_impressions: num, max_impressions: num, min_position: num, max_position: num, min_ctr: num, max_ctr: num, sort_by: str, sort_order: { ...str, enum: ['asc','desc'] }, limit: num } },
  },
  {
    name: 'site_health_score',
    description: 'Calculate an overall site health score (0-100) based on: position distribution, CTR performance, traffic trends, bounce rates, content gaps. Returns score + breakdown.',
    input_schema: { ...obj, properties: {} },
  },
  // === 30 MORE TOOLS (46-75) ===
  {
    name: 'keyword_velocity_trends',
    description: 'Find keywords gaining or losing momentum by comparing impression growth rate to click growth. High impression growth + low clicks = emerging opportunity.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'content_freshness_audit',
    description: 'Analyze page freshness by examining URL date patterns and performance. Identifies stale content that may need updating.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'internal_linking_opportunities',
    description: 'Find pages that rank for similar keywords but likely do not link to each other. Suggests internal linking pairs for SEO boost.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'ctr_improvement_simulator',
    description: 'Simulate traffic gains from CTR improvements. Shows what happens if you improve CTR by 10%, 25%, or 50% for top queries.',
    input_schema: { ...obj, properties: { position_max: num, min_impressions: num } },
  },
  {
    name: 'position_improvement_simulator',
    description: 'Simulate traffic gains from position improvements. Shows estimated clicks if keywords moved up 1, 3, or 5 positions.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'page_authority_ranking',
    description: 'Rank pages by authority signals — number of ranking keywords, total impressions, average position. More keywords at better positions = higher authority.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'keyword_seasonality_check',
    description: 'Check if top keywords contain seasonal terms (christmas, summer, winter, new year, tax time, eofy, black friday, etc.) and flag seasonal dependency risk.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'orphan_page_detection',
    description: 'Find pages in GSC with impressions but zero or near-zero clicks AND no GA4 sessions — likely orphaned or poorly linked pages.',
    input_schema: { ...obj, properties: { min_impressions: num, limit: num } },
  },
  {
    name: 'query_word_count_analysis',
    description: 'Analyze performance by keyword word count (1-word, 2-word, 3-word, 4+). Shows which keyword lengths perform best for the site.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'top_performing_authors',
    description: 'Analyze which URL patterns/sections perform best — proxy for author/team performance if content is organized by section.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'competitor_serp_landscape',
    description: 'For top keywords, estimate competitive landscape based on position and impression volume. Identifies most vs least competitive niches.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'content_consolidation_candidates',
    description: 'Find groups of pages targeting similar keywords with mediocre performance — candidates for merging into one authoritative page.',
    input_schema: { ...obj, properties: { min_pages: num, limit: num } },
  },
  {
    name: 'revenue_potential_estimate',
    description: 'Estimate revenue potential based on keyword commercial intent, search volume, and current position. Uses CPC data from DataForSEO as value proxy.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'mobile_friendliness_proxy',
    description: 'Estimate mobile friendliness by analyzing bounce rate and time-on-page patterns. High bounce + low time may indicate mobile UX issues.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'local_seo_keywords',
    description: 'Find all keywords with Australian geographic terms (australia, australian, sydney, melbourne, brisbane, etc.). Analyze local SEO performance.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'comparison_keyword_analysis',
    description: 'Find all "vs" and comparison keywords (e.g., "amex vs citi"). These have high commercial intent and are great for comparison content.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'cpc_value_analysis',
    description: 'Analyze keyword value using CPC data from DataForSEO. High CPC = high commercial value. Shows most valuable keywords you rank for.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'page_depth_analysis',
    description: 'Analyze URL depth (number of path segments) vs performance. Shallow URLs often rank better — identifies if deep pages are underperforming.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'keyword_ranking_tiers',
    description: 'Group all keywords into strategic tiers: Defend (top 3), Grow (4-10), Attack (11-20), Research (21+). Shows count and opportunity per tier.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'traffic_concentration_risk',
    description: 'Assess traffic concentration risk — what % of clicks come from top 10/50/100 keywords. High concentration = high risk if rankings drop.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'average_position_by_section',
    description: 'Calculate average ranking position by site section. Shows which content categories rank strongest/weakest.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'high_impression_low_click_queries',
    description: 'Find queries with high impression-to-click ratio (getting seen but not clicked). Prime title/meta optimization targets.',
    input_schema: { ...obj, properties: { min_impressions: num, max_ctr_pct: num, limit: num } },
  },
  {
    name: 'click_through_funnel',
    description: 'Model the search-to-click funnel: impressions → clicks → sessions → engagement. Shows where the biggest drop-offs occur.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'top_queries_per_page',
    description: 'For a specific page, find all queries that drive traffic to it using raw GSC data. Shows the full keyword portfolio for any URL.',
    input_schema: { ...obj, properties: { url_pattern: str, limit: num }, required: ['url_pattern'] },
  },
  {
    name: 'new_keyword_detection',
    description: 'Find keywords with very few clicks but growing impressions — these are newly ranking or emerging keywords worth watching.',
    input_schema: { ...obj, properties: { max_clicks: num, min_impressions: num, limit: num } },
  },
  {
    name: 'page_performance_percentiles',
    description: 'Calculate percentile rankings for pages — identify top 10%, median, and bottom 10% by clicks, impressions, and CTR.',
    input_schema: { ...obj, properties: {} },
  },
  {
    name: 'keyword_modifier_analysis',
    description: 'Analyze keyword modifiers — "best", "top", "review", "how to", "free", etc. Shows which modifiers drive the most traffic.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'seo_priority_matrix',
    description: 'Generate a priority matrix combining impact (impressions) and effort (position distance to top 3). Categorizes actions into Quick Wins, Big Bets, Fill-Ins, and Low Priority.',
    input_schema: { ...obj, properties: { limit: num } },
  },
  {
    name: 'daily_traffic_anomaly_detection',
    description: 'Detect anomalies in daily traffic — days with unusually high or low sessions compared to the rolling average. Flags potential issues or viral content.',
    input_schema: { ...obj, properties: { days: num } },
  },
  {
    name: 'full_site_audit',
    description: 'Comprehensive site audit combining health score, top issues, quick wins, traffic trends, position distribution, CTR benchmarks, and strategic recommendations. Use for "audit my site" or "full analysis" requests.',
    input_schema: { ...obj, properties: {} },
  },
]

// ─── Paginated server-side data fetching ────────────────────────
async function fetchAllServerRows(table: string): Promise<any[]> {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return allData
}

function aggregateServerRows(raw: any[], groupKey: string) {
  const deduped = new Map<string, any>()
  for (const r of raw) {
    const key = `${r[groupKey]}|${r.date}`
    if (!deduped.has(key)) deduped.set(key, r)
  }
  const map = new Map<string, { clicks: number; impressions: number; ctr_sum: number; pos_sum: number; count: number }>()
  for (const r of deduped.values()) {
    const key = r[groupKey]
    const ex = map.get(key)
    if (ex) {
      ex.clicks += r.clicks || 0; ex.impressions += r.impressions || 0
      ex.ctr_sum += r.ctr || 0; ex.pos_sum += r.position || 0; ex.count++
    } else {
      map.set(key, { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr_sum: r.ctr || 0, pos_sum: r.position || 0, count: 1 })
    }
  }
  return Array.from(map.entries()).map(([k, v]) => ({
    [groupKey]: k,
    query: groupKey === 'query' ? k : undefined,
    page: groupKey === 'page' ? k : undefined,
    clicks: v.clicks,
    impressions: v.impressions,
    avg_ctr: v.count > 0 ? v.ctr_sum / v.count : 0,
    avg_position: v.count > 0 ? v.pos_sum / v.count : 0,
  })).sort((a, b) => b.clicks - a.clicks)
}

// ─── Tool execution ─────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  try {
    const fetchQueries = async () => aggregateServerRows(await fetchAllServerRows('gsc_queries'), 'query')
    const fetchPages = async () => aggregateServerRows(await fetchAllServerRows('gsc_pages'), 'page')

    switch (name) {

      case 'query_gsc_keywords': {
        let results = await fetchQueries()
        if (input.search) results = results.filter((q: any) => q.query.toLowerCase().includes(input.search.toLowerCase()))
        if (input.min_clicks) results = results.filter((q: any) => q.clicks >= input.min_clicks)
        if (input.min_impressions) results = results.filter((q: any) => q.impressions >= input.min_impressions)
        if (input.min_position) results = results.filter((q: any) => q.avg_position >= input.min_position)
        if (input.max_position) results = results.filter((q: any) => q.avg_position <= input.max_position)
        const sortBy = input.sort_by || 'clicks', desc = (input.sort_order || 'desc') === 'desc'
        results.sort((a: any, b: any) => desc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy])
        return JSON.stringify({ total: results.length, results: results.slice(0, input.limit || 25).map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, avg_position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr * 100).toFixed(2) })) })
      }

      case 'query_gsc_pages': {
        let results = await fetchPages()
        if (input.search) results = results.filter((p: any) => p.page.toLowerCase().includes(input.search.toLowerCase()))
        if (input.min_clicks) results = results.filter((p: any) => p.clicks >= input.min_clicks)
        if (input.min_impressions) results = results.filter((p: any) => p.impressions >= input.min_impressions)
        if (input.min_position) results = results.filter((p: any) => p.avg_position >= input.min_position)
        if (input.max_position) results = results.filter((p: any) => p.avg_position <= input.max_position)
        const sortBy = input.sort_by || 'clicks', desc = (input.sort_order || 'desc') === 'desc'
        results.sort((a: any, b: any) => desc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy])
        return JSON.stringify({ total: results.length, results: results.slice(0, input.limit || 25).map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au', ''), clicks: p.clicks, impressions: p.impressions, avg_position: +p.avg_position.toFixed(1), ctr_pct: +(p.avg_ctr * 100).toFixed(2) })) })
      }

      case 'get_gsc_kpis': {
        const queries = await fetchQueries()
        const pages = await fetchPages()
        const qKpis = {
          total_clicks: queries.reduce((s: number, q: any) => s + q.clicks, 0),
          total_impressions: queries.reduce((s: number, q: any) => s + q.impressions, 0),
          unique_queries: queries.length,
          avg_ctr: queries.length > 0 ? queries.reduce((s: number, q: any) => s + q.avg_ctr, 0) / queries.length : 0,
          avg_position: queries.length > 0 ? queries.reduce((s: number, q: any) => s + q.avg_position, 0) / queries.length : 0,
          top3_count: queries.filter((q: any) => q.avg_position <= 3).length,
          top10_count: queries.filter((q: any) => q.avg_position <= 10).length,
        }
        const pKpis = {
          total_clicks: pages.reduce((s: number, p: any) => s + p.clicks, 0),
          total_impressions: pages.reduce((s: number, p: any) => s + p.impressions, 0),
          unique_pages: pages.length,
          avg_ctr: pages.length > 0 ? pages.reduce((s: number, p: any) => s + p.avg_ctr, 0) / pages.length : 0,
          avg_position: pages.length > 0 ? pages.reduce((s: number, p: any) => s + p.avg_position, 0) / pages.length : 0,
        }
        return JSON.stringify({ query_level: qKpis, page_level: pKpis })
      }

      case 'get_ctr_by_position': {
        const allQ = await fetchQueries()
        const bucketDefs = [
          { position_bucket: '1', min: 0, max: 1.5 },
          { position_bucket: '2-3', min: 1.5, max: 3.5 },
          { position_bucket: '4-10', min: 3.5, max: 10.5 },
          { position_bucket: '11-20', min: 10.5, max: 20.5 },
          { position_bucket: '21+', min: 20.5, max: 9999 },
        ]
        const buckets = bucketDefs.map(b => {
          const inBucket = allQ.filter((q: any) => q.avg_position >= b.min && q.avg_position < b.max)
          const totalImp = inBucket.reduce((s: number, q: any) => s + q.impressions, 0)
          const totalClk = inBucket.reduce((s: number, q: any) => s + q.clicks, 0)
          return { position_bucket: b.position_bucket, avg_ctr: totalImp > 0 ? totalClk / totalImp : 0, query_count: inBucket.length }
        })
        return JSON.stringify(buckets)
      }

      case 'get_ga4_daily': {
        const { data } = await supabase.from('ga4_daily').select('*').order('date', { ascending: false }).limit(input.days || 14)
        return JSON.stringify(data)
      }

      case 'get_ga4_pages': {
        let q = supabase.from('ga4_pages').select('*')
        if (input.search) q = q.ilike('page_path', `%${input.search}%`)
        if (input.min_sessions) q = q.gte('sessions', input.min_sessions)
        q = q.order(input.sort_by || 'sessions', { ascending: (input.sort_order || 'desc') !== 'desc' }).limit(input.limit || 25)
        return JSON.stringify((await q).data)
      }

      case 'get_ga4_traffic_sources': {
        const { data } = await supabase.from('ga4_traffic_sources').select('*').order(input.sort_by || 'sessions', { ascending: false }).limit(input.limit || 20)
        return JSON.stringify(data)
      }

      case 'get_seo_keywords': {
        let q = supabase.from('seo_keywords').select('*').order('search_volume', { ascending: false })
        if (input.search) q = q.ilike('keyword', `%${input.search}%`)
        return JSON.stringify((await q).data)
      }

      case 'find_ctr_issues': {
        const data = await fetchQueries()
        const maxPos = input.max_position || 5, minImpr = input.min_impressions || 200
        const issues = data.filter((q: any) => {
          if (q.avg_position > maxPos || q.impressions < minImpr) return false
          const exp = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : 0.06
          return q.avg_ctr < exp
        }).sort((a: any, b: any) => b.impressions - a.impressions).slice(0, input.limit || 15)
        return JSON.stringify(issues.map((q: any) => { const exp = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : 0.06; return { query: q.query, clicks: q.clicks, impressions: q.impressions, avg_position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr*100).toFixed(2), expected_ctr_pct: +(exp*100).toFixed(0), lost_clicks: Math.round(q.impressions*(exp-q.avg_ctr)) } }))
      }

      case 'find_quick_wins': {
        const data = await fetchQueries()
        const wins = data.filter((q: any) => q.avg_position >= (input.min_position||4) && q.avg_position <= (input.max_position||15) && q.impressions >= (input.min_impressions||500))
          .sort((a: any, b: any) => b.impressions - a.impressions).slice(0, input.limit || 15)
        return JSON.stringify(wins.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, avg_position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr*100).toFixed(2), potential_top3_clicks: Math.round(q.impressions*0.12) })))
      }

      case 'find_declining_content': {
        const [pages, ga4] = await Promise.all([fetchPages(), supabase.from('ga4_pages').select('*').gte('bounce_rate', input.min_bounce_rate||70).gte('sessions',15).order('bounce_rate',{ascending:false}).limit(10)])
        const lowVis = pages.filter((p: any) => p.avg_position > (input.min_position||20) && p.impressions > (input.min_impressions||500))
          .sort((a: any, b: any) => b.impressions - a.impressions).slice(0, input.limit||10)
        return JSON.stringify({ low_visibility: lowVis.map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(0) })), high_bounce: (ga4.data||[]).map((p: any) => ({ page: p.page_path, sessions: p.sessions, bounce_rate: Math.round(p.bounce_rate), avg_time: Math.round(p.avg_time_on_page||0) })) })
      }

      case 'compare_periods': {
        const days = input.days || 7
        const { data } = await supabase.from('ga4_daily').select('*').order('date', { ascending: false }).limit(days * 2)
        if (!data || data.length < days*2) return 'Not enough data'
        const cur = data.slice(0, days), prev = data.slice(days, days*2)
        const s = (arr: any[], k: string) => arr.reduce((a,d) => a + (d[k]||0), 0)
        const ch = (c: number, p: number) => p > 0 ? +((c-p)/p*100).toFixed(1) : 0
        return JSON.stringify({ period_days: days, current: { start: cur[cur.length-1].date, end: cur[0].date, sessions: s(cur,'sessions'), pageviews: s(cur,'pageviews'), users: s(cur,'users') }, previous: { start: prev[prev.length-1].date, end: prev[0].date, sessions: s(prev,'sessions'), pageviews: s(prev,'pageviews'), users: s(prev,'users') }, changes: { sessions_pct: ch(s(cur,'sessions'), s(prev,'sessions')), pageviews_pct: ch(s(cur,'pageviews'), s(prev,'pageviews')), users_pct: ch(s(cur,'users'), s(prev,'users')) }, daily_sessions: cur.map((d: any) => ({ date: d.date, sessions: d.sessions })) })
      }

      case 'get_position_distribution': {
        const data = await fetchQueries()
        const buckets = [{l:'#1',mn:0,mx:1.5},{l:'#2-3',mn:1.5,mx:3.5},{l:'#4-10',mn:3.5,mx:10.5},{l:'#11-20',mn:10.5,mx:20.5},{l:'#21-50',mn:20.5,mx:50.5},{l:'#51+',mn:50.5,mx:999}]
        return JSON.stringify(buckets.map(b => { const qs = data.filter((q: any) => q.avg_position >= b.mn && q.avg_position < b.mx); return { range: b.l, count: qs.length, clicks: qs.reduce((s: number,q: any) => s+q.clicks,0), impressions: qs.reduce((s: number,q: any) => s+q.impressions,0) } }))
      }

      case 'search_everything': {
        const q = input.query.toLowerCase()
        const [gscQ, gscP, ga4P, seoK] = await Promise.all([fetchQueries(), fetchPages(), supabase.from('ga4_pages').select('*').ilike('page_path',`%${q}%`).limit(10), supabase.from('seo_keywords').select('*').ilike('keyword',`%${q}%`)])
        return JSON.stringify({ gsc_queries: gscQ.filter((r: any) => r.query.toLowerCase().includes(q)).slice(0,15).map((r: any) => ({ query: r.query, clicks: r.clicks, impressions: r.impressions, position: +r.avg_position.toFixed(1) })), gsc_pages: gscP.filter((r: any) => r.page.toLowerCase().includes(q)).slice(0,10).map((r: any) => ({ page: r.page.replace('https://www.pointhacks.com.au',''), clicks: r.clicks, impressions: r.impressions })), ga4_pages: ga4P.data||[], seo_keywords: seoK.data||[] })
      }

      case 'get_content_gaps': {
        const [gscQ, seoK] = await Promise.all([fetchQueries(), supabase.from('seo_keywords').select('*').order('search_volume',{ascending:false})])
        const wasted = gscQ.filter((q: any) => q.impressions >= (input.min_impressions||1000) && q.clicks < 5).sort((a: any,b: any) => b.impressions-a.impressions).slice(0,10)
        const poor = (seoK.data||[]).filter((k: any) => k.position && k.position > 15 && k.search_volume > 500)
        return JSON.stringify({ wasted_impressions: wasted.map((q: any) => ({ query: q.query, impressions: q.impressions, clicks: q.clicks, position: +q.avg_position.toFixed(0) })), poor_ranking_high_volume: poor.map((k: any) => ({ keyword: k.keyword, position: k.position, search_volume: k.search_volume })) })
      }

      case 'analyze_page_deep': {
        const pat = input.url_pattern.toLowerCase()
        const [pages, ga4P] = await Promise.all([fetchPages(), supabase.from('ga4_pages').select('*').ilike('page_path',`%${pat}%`).limit(5)])
        const matched = pages.filter((p: any) => p.page.toLowerCase().includes(pat)).sort((a: any,b: any) => b.clicks-a.clicks)
        if (!matched.length) return JSON.stringify({ error: 'No pages found' })
        const { data: raw } = await supabase.from('gsc_pages').select('page, clicks, impressions, position, ctr').ilike('page',`%${pat}%`).order('clicks',{ascending:false}).limit(50)
        const top = matched[0]
        return JSON.stringify({ page: { url: top.page.replace('https://www.pointhacks.com.au',''), clicks: top.clicks, impressions: top.impressions, position: +top.avg_position.toFixed(1), ctr_pct: +(top.avg_ctr*100).toFixed(2) }, all_matching: matched.slice(0,5).map((p: any) => ({ url: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks })), ga4: (ga4P.data||[]).map((p: any) => ({ page: p.page_path, sessions: p.sessions, bounce: Math.round(p.bounce_rate||0), time: Math.round(p.avg_time_on_page||0) })), raw_data: (raw||[]).slice(0,20) })
      }

      case 'detect_cannibalization': {
        const queries = await fetchQueries()
        const pages = await fetchPages()
        const urlGroups: Record<string, any[]> = {}
        for (const p of pages) {
          const segments = p.page.replace('https://www.pointhacks.com.au','').split('/').filter(Boolean)
          const topic = segments[0] || 'homepage'
          if (!urlGroups[topic]) urlGroups[topic] = []
          urlGroups[topic].push(p)
        }
        const cannibalized = Object.entries(urlGroups).filter(([,ps]) => ps.length > 3).map(([topic, ps]) => ({
          topic, page_count: ps.length,
          pages: ps.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,5).map((p: any) => ({ url: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(1) })),
          total_clicks: ps.reduce((s: number,p: any) => s+p.clicks,0),
          total_impressions: ps.reduce((s: number,p: any) => s+p.impressions,0),
        })).sort((a,b) => b.page_count - a.page_count).slice(0, input.limit||10)
        return JSON.stringify(cannibalized)
      }

      case 'brand_vs_nonbrand': {
        const data = await fetchQueries()
        const brandTerms = ['point hack', 'pointhack', 'point hacks', 'pointhacks']
        const branded = data.filter((q: any) => brandTerms.some(t => q.query.toLowerCase().includes(t)))
        const nonBranded = data.filter((q: any) => !brandTerms.some(t => q.query.toLowerCase().includes(t)))
        const agg = (arr: any[]) => ({ count: arr.length, clicks: arr.reduce((s: number,q: any) => s+q.clicks,0), impressions: arr.reduce((s: number,q: any) => s+q.impressions,0), avg_position: arr.length ? +(arr.reduce((s: number,q: any) => s+q.avg_position,0)/arr.length).toFixed(1) : 0, avg_ctr_pct: arr.length ? +(arr.reduce((s: number,q: any) => s+q.avg_ctr,0)/arr.length*100).toFixed(2) : 0 })
        return JSON.stringify({ branded: { ...agg(branded), top_queries: branded.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,5).map((q: any) => q.query) }, non_branded: { ...agg(nonBranded), top_queries: nonBranded.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,5).map((q: any) => q.query) }, brand_click_share_pct: +((agg(branded).clicks / (agg(branded).clicks+agg(nonBranded).clicks||1))*100).toFixed(1) })
      }

      case 'longtail_analysis': {
        const data = await fetchQueries()
        const short = data.filter((q: any) => q.query.split(' ').length <= 3)
        const long = data.filter((q: any) => q.query.split(' ').length >= 4)
        const agg = (arr: any[]) => ({ count: arr.length, clicks: arr.reduce((s: number,q: any) => s+q.clicks,0), impressions: arr.reduce((s: number,q: any) => s+q.impressions,0), avg_position: arr.length ? +(arr.reduce((s: number,q: any) => s+q.avg_position,0)/arr.length).toFixed(1) : 0, avg_ctr_pct: arr.length ? +(arr.reduce((s: number,q: any) => s+q.avg_ctr,0)/arr.length*100).toFixed(2) : 0 })
        return JSON.stringify({ short_tail_1_3_words: agg(short), long_tail_4plus_words: agg(long), long_tail_share_pct: +((long.length/(data.length||1))*100).toFixed(1) })
      }

      case 'zero_click_pages': {
        const pages = await fetchPages()
        const zero = pages.filter((p: any) => p.impressions >= (input.min_impressions||500) && p.clicks <= (input.max_clicks||2))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||15)
        return JSON.stringify({ count: zero.length, pages: zero.map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(0), ctr_pct: +(p.avg_ctr*100).toFixed(3) })) })
      }

      case 'top_growing_keywords': {
        const data = await fetchQueries()
        const scored = data.filter((q: any) => q.impressions >= 100).map((q: any) => ({ ...q, growth_score: q.impressions / Math.max(1, q.avg_position) }))
          .sort((a: any,b: any) => b.growth_score - a.growth_score).slice(0, input.limit||15)
        return JSON.stringify(scored.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1), growth_score: Math.round(q.growth_score) })))
      }

      case 'featured_snippet_opportunities': {
        const data = await fetchQueries()
        const questionWords = ['how','what','where','when','why','which','who','can','does','is','are','best','top','vs','compare']
        const snippetOpps = data.filter((q: any) => q.avg_position <= (input.max_position||5) && q.impressions >= (input.min_impressions||200) && questionWords.some(w => q.query.toLowerCase().startsWith(w) || q.query.toLowerCase().includes(' '+w+' ')))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||15)
        return JSON.stringify(snippetOpps.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr*100).toFixed(2) })))
      }

      case 'url_structure_analysis': {
        const pages = await fetchPages()
        const sections: Record<string, any[]> = {}
        for (const p of pages) {
          const path = p.page.replace('https://www.pointhacks.com.au','')
          const section = '/' + (path.split('/').filter(Boolean)[0] || 'homepage')
          if (!sections[section]) sections[section] = []
          sections[section].push(p)
        }
        return JSON.stringify(Object.entries(sections).map(([section, ps]) => ({
          section, page_count: ps.length,
          total_clicks: ps.reduce((s: number,p: any) => s+p.clicks,0),
          total_impressions: ps.reduce((s: number,p: any) => s+p.impressions,0),
          avg_position: +(ps.reduce((s: number,p: any) => s+p.avg_position,0)/ps.length).toFixed(1),
          avg_ctr_pct: +(ps.reduce((s: number,p: any) => s+p.avg_ctr,0)/ps.length*100).toFixed(2),
        })).sort((a,b) => b.total_clicks - a.total_clicks))
      }

      case 'keyword_clustering': {
        const data = await fetchQueries()
        const topKws = data.filter((q: any) => q.impressions >= 100)
        const phrases: Record<string, any[]> = {}
        for (const q of topKws) {
          const words = q.query.toLowerCase().split(' ')
          for (let i = 0; i < words.length - 1; i++) {
            const phrase = words[i] + ' ' + words[i+1]
            if (phrase.length < 5) continue
            if (!phrases[phrase]) phrases[phrase] = []
            phrases[phrase].push(q)
          }
        }
        const clusters = Object.entries(phrases)
          .filter(([,qs]) => qs.length >= (input.min_cluster_size||3))
          .map(([phrase, qs]) => ({ phrase, count: qs.length, total_clicks: qs.reduce((s: number,q: any) => s+q.clicks,0), total_impressions: qs.reduce((s: number,q: any) => s+q.impressions,0), top_queries: qs.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,3).map((q: any) => q.query) }))
          .sort((a,b) => b.total_clicks - a.total_clicks).slice(0, input.limit||20)
        return JSON.stringify(clusters)
      }

      case 'engagement_scoring': {
        const { data: ga4 } = await supabase.from('ga4_pages').select('*').gte('sessions',10).order('sessions',{ascending:false}).limit(100)
        if (!ga4) return '[]'
        const avgBounce = ga4.reduce((s,p) => s+(p.bounce_rate||0),0)/ga4.length
        const avgTime = ga4.reduce((s,p) => s+(p.avg_time_on_page||0),0)/ga4.length
        const scored = ga4.map(p => {
          const bounceScore = Math.max(0, 100 - ((p.bounce_rate||0)/avgBounce)*50)
          const timeScore = Math.min(100, ((p.avg_time_on_page||0)/avgTime)*50)
          const sessionScore = Math.min(100, Math.log10(p.sessions||1)*25)
          return { page: p.page_path, sessions: p.sessions, bounce_rate: Math.round(p.bounce_rate||0), avg_time: Math.round(p.avg_time_on_page||0), engagement_score: Math.round((bounceScore+timeScore+sessionScore)/3) }
        }).sort((a,b) => b.engagement_score - a.engagement_score)
        return JSON.stringify({ best: scored.slice(0, input.limit||10), worst: scored.slice(-Math.min(input.limit||10, scored.length)), site_avg: { bounce_rate: Math.round(avgBounce), avg_time: Math.round(avgTime) } })
      }

      case 'content_roi': {
        const pages = await fetchPages()
        const scored = pages.filter((p: any) => p.clicks > 0).map((p: any) => {
          const difficulty = Math.max(1, p.avg_position)
          const roi = (p.clicks / difficulty) * (p.avg_ctr * 100)
          return { page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(1), roi_score: Math.round(roi*10)/10 }
        }).sort((a: any,b: any) => b.roi_score - a.roi_score)
        return JSON.stringify({ highest_roi: scored.slice(0, input.limit||10), lowest_roi: scored.filter((p: any) => p.impressions > 500).slice(-Math.min(input.limit||10, scored.length)) })
      }

      case 'question_keywords': {
        const data = await fetchQueries()
        const qWords = ['who','what','where','when','why','how','can','does','is','are','which','should','will','do']
        const questions = data.filter((q: any) => q.impressions >= (input.min_impressions||50) && qWords.some(w => q.query.toLowerCase().startsWith(w+' ')))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||25)
        return JSON.stringify({ count: questions.length, questions: questions.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1) })) })
      }

      case 'competitor_keyword_overlap': {
        const data = await fetchQueries()
        const competitors = ['finder','canstar','creditcard.com','nerdwallet','credit savvy','compare','mozo','ratecity']
        const overlap = data.filter((q: any) => competitors.some(c => q.query.toLowerCase().includes(c)))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||15)
        const commercial = data.filter((q: any) => ['best','compare','review','vs','top'].some(w => q.query.toLowerCase().includes(w)) && q.impressions >= 200)
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0,15)
        return JSON.stringify({ competitor_mentions: overlap.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1) })), competitive_commercial: commercial.map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1) })) })
      }

      case 'seasonal_patterns': {
        const { data } = await supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(28)
        if (!data) return '[]'
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        const byDay: Record<string, number[]> = {}
        for (const d of data) {
          const dow = days[new Date(d.date).getDay()]
          if (!byDay[dow]) byDay[dow] = []
          byDay[dow].push(d.sessions||0)
        }
        const weekday = data.filter(d => {const dow = new Date(d.date).getDay(); return dow >= 1 && dow <= 5})
        const weekend = data.filter(d => {const dow = new Date(d.date).getDay(); return dow === 0 || dow === 6})
        return JSON.stringify({ day_of_week: Object.entries(byDay).map(([day, sessions]) => ({ day, avg_sessions: Math.round(sessions.reduce((a,b) => a+b,0)/sessions.length), sample_size: sessions.length })), weekday_avg: Math.round(weekday.reduce((s,d) => s+(d.sessions||0),0)/(weekday.length||1)), weekend_avg: Math.round(weekend.reduce((s,d) => s+(d.sessions||0),0)/(weekend.length||1)) })
      }

      case 'thin_content_detection': {
        const { data: ga4 } = await supabase.from('ga4_pages').select('*').lte('sessions', input.max_sessions||10).gte('bounce_rate', input.min_bounce_rate||80).order('bounce_rate',{ascending:false}).limit(input.limit||20)
        const pages = await fetchPages()
        const lowPerf = pages.filter((p: any) => p.clicks <= 2 && p.impressions >= 100).sort((a: any,b: any) => b.impressions-a.impressions).slice(0,15)
        return JSON.stringify({ high_bounce_low_traffic: ga4||[], gsc_low_clicks: lowPerf.map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(0) })) })
      }

      case 'traffic_source_comparison': {
        const { data } = await supabase.from('ga4_traffic_sources').select('*').order('sessions',{ascending:false})
        if (!data) return '[]'
        const channels: Record<string, any> = {}
        for (const s of data) {
          const ch = (s.medium||'direct').toLowerCase()
          if (!channels[ch]) channels[ch] = { sessions: 0, users: 0, bounce_total: 0, count: 0, sources: [] }
          channels[ch].sessions += s.sessions||0; channels[ch].users += s.users||0
          channels[ch].bounce_total += (s.bounce_rate||0)*(s.sessions||0); channels[ch].count++
          if (channels[ch].sources.length < 3) channels[ch].sources.push(s.source)
        }
        return JSON.stringify(Object.entries(channels).map(([medium, d]) => ({ medium, sessions: d.sessions, users: d.users, avg_bounce: Math.round(d.bounce_total/(d.sessions||1)), top_sources: d.sources })).sort((a,b) => b.sessions-a.sessions))
      }

      case 'top_entry_exit_pages': {
        const { data } = await supabase.from('ga4_pages').select('page_path, sessions, entrances, exits, bounce_rate').order('sessions',{ascending:false}).limit(50)
        if (!data) return '[]'
        const byEntrance = [...data].sort((a,b) => (b.entrances||0)-(a.entrances||0)).slice(0, input.limit||10)
        const byExit = [...data].sort((a,b) => (b.exits||0)-(a.exits||0)).slice(0, input.limit||10)
        return JSON.stringify({ top_entry: byEntrance.map(p => ({ page: p.page_path, entrances: p.entrances, sessions: p.sessions, bounce: Math.round(p.bounce_rate||0) })), top_exit: byExit.map(p => ({ page: p.page_path, exits: p.exits, sessions: p.sessions })) })
      }

      case 'keyword_difficulty_estimate': {
        const data = await fetchQueries()
        const scored = data.filter((q: any) => q.impressions >= 100).map((q: any) => {
          let difficulty = 'easy'
          if (q.avg_position > 20 && q.impressions > 5000) difficulty = 'hard'
          else if (q.avg_position > 10) difficulty = 'medium'
          else if (q.avg_position <= 3 && q.impressions > 1000) difficulty = 'easy - maintaining'
          return { query: q.query, position: +q.avg_position.toFixed(1), impressions: q.impressions, clicks: q.clicks, difficulty }
        })
        const easy = scored.filter(s => s.difficulty.startsWith('easy'))
        const medium = scored.filter(s => s.difficulty === 'medium')
        const hard = scored.filter(s => s.difficulty === 'hard')
        return JSON.stringify({ easy: { count: easy.length, top: easy.slice(0, input.limit||5) }, medium: { count: medium.length, top: medium.sort((a,b) => b.impressions-a.impressions).slice(0,input.limit||5) }, hard: { count: hard.length, top: hard.sort((a,b) => b.impressions-a.impressions).slice(0,input.limit||5) } })
      }

      case 'page_impressions_no_ranking': {
        const pages = await fetchPages()
        const buried = pages.filter((p: any) => p.avg_position >= 50 && p.impressions >= (input.min_impressions||200))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||15)
        return JSON.stringify(buried.map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au',''), impressions: p.impressions, clicks: p.clicks, position: +p.avg_position.toFixed(0) })))
      }

      case 'ctr_benchmarking': {
        const data = await fetchQueries()
        const benchmarks = [{range:'#1',min:0,max:1.5,expected:0.28},{range:'#2',min:1.5,max:2.5,expected:0.15},{range:'#3',min:2.5,max:3.5,expected:0.11},{range:'#4-5',min:3.5,max:5.5,expected:0.07},{range:'#6-10',min:5.5,max:10.5,expected:0.04},{range:'#11-20',min:10.5,max:20.5,expected:0.02}]
        return JSON.stringify(benchmarks.map(b => {
          const qs = data.filter((q: any) => q.avg_position >= b.min && q.avg_position < b.max && q.impressions >= 50)
          const actualCtr = qs.length ? qs.reduce((s: number,q: any) => s+q.avg_ctr,0)/qs.length : 0
          return { position_range: b.range, query_count: qs.length, actual_ctr_pct: +(actualCtr*100).toFixed(2), benchmark_ctr_pct: +(b.expected*100).toFixed(0), performance: actualCtr >= b.expected ? 'above_benchmark' : actualCtr >= b.expected*0.7 ? 'slightly_below' : 'significantly_below', total_clicks: qs.reduce((s: number,q: any) => s+q.clicks,0) }
        }))
      }

      case 'keyword_intent_breakdown': {
        const data = await fetchQueries()
        const classify = (q: string) => {
          const l = q.toLowerCase()
          if (['pointhack','point hack','pointhacks.com'].some(t => l.includes(t))) return 'navigational'
          if (['buy','apply','sign up','get','open','activate'].some(t => l.includes(t))) return 'transactional'
          if (['best','top','compare','vs','review','worth','which'].some(t => l.includes(t))) return 'commercial'
          return 'informational'
        }
        const grouped: Record<string, any[]> = { navigational: [], informational: [], commercial: [], transactional: [] }
        for (const q of data) grouped[classify(q.query)].push(q)
        return JSON.stringify(Object.entries(grouped).map(([intent, qs]) => ({ intent, count: qs.length, clicks: qs.reduce((s: number,q: any) => s+q.clicks,0), impressions: qs.reduce((s: number,q: any) => s+q.impressions,0), top_queries: qs.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,5).map((q: any) => ({ query: q.query, clicks: q.clicks })) })))
      }

      case 'page_velocity': {
        const pages = await fetchPages()
        const scored = pages.filter((p: any) => p.impressions >= 100).map((p: any) => ({
          page: p.page.replace('https://www.pointhacks.com.au',''),
          clicks: p.clicks, impressions: p.impressions,
          velocity: +(p.clicks / p.impressions * 1000).toFixed(1),
          position: +p.avg_position.toFixed(1),
        })).sort((a,b) => b.velocity - a.velocity)
        return JSON.stringify({ fastest: scored.slice(0, input.limit||10), slowest: scored.slice(-Math.min(input.limit||10, scored.length)) })
      }

      case 'striking_distance': {
        const data = await fetchQueries()
        const striking = data.filter((q: any) => q.avg_position >= 8 && q.avg_position <= 15 && q.impressions >= (input.min_impressions||1000))
          .sort((a: any,b: any) => b.impressions-a.impressions).slice(0, input.limit||15)
        const totalPotential = striking.reduce((s: number,q: any) => s + Math.round(q.impressions * 0.10), 0)
        return JSON.stringify({ count: striking.length, potential_monthly_clicks: totalPotential, keywords: striking.map((q: any) => ({ query: q.query, position: +q.avg_position.toFixed(1), impressions: q.impressions, clicks: q.clicks, potential_clicks_if_top3: Math.round(q.impressions*0.12) })) })
      }

      case 'get_executive_summary': {
        const [daily, queries, pages] = await Promise.all([
          supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(14),
          fetchQueries(), fetchPages(),
        ])
        const d = daily.data||[]
        const totalQClicks = queries.reduce((s: number, q: any) => s + q.clicks, 0)
        const totalQImpressions = queries.reduce((s: number, q: any) => s + q.impressions, 0)
        const totalPClicks = pages.reduce((s: number, p: any) => s + p.clicks, 0)
        const tw = d.slice(0,7), lw = d.slice(7,14)
        const twS = tw.reduce((s: number,d: any) => s+(d.sessions||0),0), lwS = lw.reduce((s: number,d: any) => s+(d.sessions||0),0)
        const wowPct = lwS > 0 ? +((twS-lwS)/lwS*100).toFixed(1) : 0
        const top3 = queries.filter((q: any) => q.avg_position <= 3).length
        const top10 = queries.filter((q: any) => q.avg_position <= 10).length
        const ctrIssues = queries.filter((q: any) => { if (q.avg_position > 5 || q.impressions < 200) return false; const exp = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : 0.06; return q.avg_ctr < exp }).length
        const quickWins = queries.filter((q: any) => q.avg_position >= 4 && q.avg_position <= 15 && q.impressions >= 500).length
        return JSON.stringify({
          kpis: { query_clicks: totalQClicks, page_clicks: totalPClicks, impressions: totalQImpressions, unique_queries: queries.length, unique_pages: pages.length },
          traffic: { sessions_7d: twS, wow_change_pct: wowPct, daily: tw.map((d: any) => ({ date: d.date, sessions: d.sessions })) },
          seo: { top_3_keywords: top3, top_10_keywords: top10, total_keywords: queries.length, ctr_issues: ctrIssues, quick_wins: quickWins },
          top_keywords: queries.slice(0,5).map((q: any) => ({ query: q.query, clicks: q.clicks, position: +q.avg_position.toFixed(1) })),
          top_pages: pages.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,5).map((p: any) => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks })),
        })
      }

      case 'keyword_gap_by_topic': {
        const data = await fetchQueries()
        const topics: Record<string, string[]> = {
          'credit cards': ['credit card','credit cards','rewards card','balance transfer'],
          'qantas': ['qantas','qff','frequent flyer'],
          'velocity': ['velocity','virgin australia'],
          'krisflyer': ['krisflyer','singapore airlines','kris flyer'],
          'points earning': ['earn points','points earn','points hack','bonus points'],
          'travel': ['travel','lounge','airport','flight','hotel','booking'],
          'amex': ['amex','american express'],
          'business cards': ['business card','business credit','company card'],
          'banking': ['bank','savings','term deposit','high interest'],
        }
        return JSON.stringify(Object.entries(topics).map(([topic, terms]) => {
          const matched = data.filter((q: any) => terms.some(t => q.query.toLowerCase().includes(t)))
          return { topic, keyword_count: matched.length, total_clicks: matched.reduce((s: number,q: any) => s+q.clicks,0), total_impressions: matched.reduce((s: number,q: any) => s+q.impressions,0), avg_position: matched.length ? +(matched.reduce((s: number,q: any) => s+q.avg_position,0)/matched.length).toFixed(1) : null, top_keywords: matched.sort((a: any,b: any) => b.clicks-a.clicks).slice(0,3).map((q: any) => q.query) }
        }).sort((a,b) => b.total_clicks - a.total_clicks))
      }

      case 'pages_per_click_efficiency': {
        const pages = await fetchPages()
        const sections: Record<string, {clicks: number, pages: number, impressions: number}> = {}
        for (const p of pages) {
          const section = '/' + (p.page.replace('https://www.pointhacks.com.au','').split('/').filter(Boolean)[0] || 'homepage')
          if (!sections[section]) sections[section] = {clicks:0, pages:0, impressions:0}
          sections[section].clicks += p.clicks; sections[section].pages++; sections[section].impressions += p.impressions
        }
        const efficiency = Object.entries(sections).map(([section, d]) => ({
          section, pages: d.pages, total_clicks: d.clicks, total_impressions: d.impressions,
          clicks_per_page: Math.round(d.clicks / (d.pages||1)),
        })).sort((a,b) => b.clicks_per_page - a.clicks_per_page).slice(0, input.limit||15)
        return JSON.stringify(efficiency)
      }

      case 'impression_share_analysis': {
        const queries = await fetchQueries()
        const totalImpr = queries.reduce((s: number,q: any) => s+q.impressions,0)
        const top10Impr = queries.sort((a: any,b: any) => b.impressions-a.impressions).slice(0,10)
        const top10Total = top10Impr.reduce((s: number,q: any) => s+q.impressions,0)
        const top50 = queries.slice(0,50)
        const top50Total = top50.reduce((s: number,q: any) => s+q.impressions,0)
        return JSON.stringify({
          total_impressions: totalImpr, total_queries: queries.length,
          concentration: { top_10_queries_pct: +((top10Total/totalImpr)*100).toFixed(1), top_50_queries_pct: +((top50Total/totalImpr)*100).toFixed(1) },
          top_10_by_impressions: top10Impr.map((q: any) => ({ query: q.query, impressions: q.impressions, share_pct: +((q.impressions/totalImpr)*100).toFixed(2) })),
          long_tail_count: queries.filter((q: any) => q.impressions < 100).length,
          long_tail_total_impressions: queries.filter((q: any) => q.impressions < 100).reduce((s: number,q: any) => s+q.impressions,0),
        })
      }

      case 'bounce_rate_outliers': {
        const { data } = await supabase.from('ga4_pages').select('*').gte('sessions',10).order('sessions',{ascending:false}).limit(100)
        if (!data) return '[]'
        const avg = data.reduce((s,p) => s+(p.bounce_rate||0),0)/data.length
        const high = [...data].sort((a,b) => (b.bounce_rate||0)-(a.bounce_rate||0)).slice(0, input.limit||10)
        const low = [...data].sort((a,b) => (a.bounce_rate||0)-(b.bounce_rate||0)).slice(0, input.limit||10)
        return JSON.stringify({ site_avg_bounce: Math.round(avg), high_bounce: high.map(p => ({ page: p.page_path, bounce: Math.round(p.bounce_rate||0), sessions: p.sessions, deviation: Math.round((p.bounce_rate||0)-avg) })), low_bounce: low.map(p => ({ page: p.page_path, bounce: Math.round(p.bounce_rate||0), sessions: p.sessions, deviation: Math.round((p.bounce_rate||0)-avg) })) })
      }

      case 'query_raw_sql': {
        let results = await fetchQueries()
        if (input.search) results = results.filter((q: any) => q.query.toLowerCase().includes(input.search.toLowerCase()))
        if (input.min_clicks) results = results.filter((q: any) => q.clicks >= input.min_clicks)
        if (input.max_clicks) results = results.filter((q: any) => q.clicks <= input.max_clicks)
        if (input.min_impressions) results = results.filter((q: any) => q.impressions >= input.min_impressions)
        if (input.max_impressions) results = results.filter((q: any) => q.impressions <= input.max_impressions)
        if (input.min_position) results = results.filter((q: any) => q.avg_position >= input.min_position)
        if (input.max_position) results = results.filter((q: any) => q.avg_position <= input.max_position)
        if (input.min_ctr) results = results.filter((q: any) => q.avg_ctr >= input.min_ctr)
        if (input.max_ctr) results = results.filter((q: any) => q.avg_ctr <= input.max_ctr)
        const sortBy = input.sort_by || 'clicks', desc = (input.sort_order||'desc') === 'desc'
        results.sort((a: any,b: any) => desc ? b[sortBy]-a[sortBy] : a[sortBy]-b[sortBy])
        return JSON.stringify({ total: results.length, results: results.slice(0, input.limit||25).map((q: any) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr*100).toFixed(2) })) })
      }

      case 'site_health_score': {
        const [queries, pages, dailyRes, ga4Res] = await Promise.all([
          fetchQueries(), fetchPages(),
          supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(14),
          supabase.from('ga4_pages').select('*').gte('sessions',10).order('sessions',{ascending:false}).limit(50),
        ])
        const daily = dailyRes.data||[], ga4 = ga4Res.data||[]
        const top10 = queries.filter((q: any) => q.avg_position <= 10).length
        const posScore = Math.min(25, (top10 / Math.max(1, queries.length)) * 100)
        const ctrIssueCount = queries.filter((q: any) => { if (q.avg_position > 10 || q.impressions < 100) return false; const exp = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : q.avg_position <= 5 ? 0.06 : 0.03; return q.avg_ctr < exp*0.7 }).length
        const ctrScore = Math.max(0, 25 - (ctrIssueCount / Math.max(1, queries.filter((q: any) => q.avg_position <= 10).length)) * 25)
        const tw = daily.slice(0,7).reduce((s: number,d: any) => s+(d.sessions||0),0)
        const lw = daily.slice(7,14).reduce((s: number,d: any) => s+(d.sessions||0),0)
        const wowPct = lw > 0 ? (tw-lw)/lw*100 : 0
        const trafficScore = Math.min(25, Math.max(0, 12.5 + wowPct/4))
        const avgBounce = ga4.length ? ga4.reduce((s,p) => s+(p.bounce_rate||0),0)/ga4.length : 50
        const engScore = Math.max(0, 25 - (avgBounce/100)*25)
        const total = Math.round(posScore + ctrScore + trafficScore + engScore)
        return JSON.stringify({
          overall_score: total,
          grade: total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : total >= 35 ? 'D' : 'F',
          breakdown: {
            position_health: { score: Math.round(posScore), max: 25, detail: `${top10} of ${queries.length} keywords in top 10` },
            ctr_performance: { score: Math.round(ctrScore), max: 25, detail: `${ctrIssueCount} keywords with below-benchmark CTR` },
            traffic_trend: { score: Math.round(trafficScore), max: 25, detail: `${wowPct >= 0 ? '+' : ''}${wowPct.toFixed(1)}% week-over-week` },
            engagement: { score: Math.round(engScore), max: 25, detail: `${Math.round(avgBounce)}% average bounce rate` },
          }
        })
      }

      case 'keyword_velocity_trends': {
        const data = await fetchQueries()
        const scored = data.filter(q => q.impressions >= 200).map(q => {
          const expectedClicks = q.impressions * (q.avg_position <= 3 ? 0.15 : q.avg_position <= 10 ? 0.05 : 0.01)
          const velocity = q.impressions / Math.max(1, q.clicks)
          return { query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1), velocity_score: Math.round(velocity), status: q.clicks > expectedClicks ? 'established' : velocity > 50 ? 'emerging_high' : velocity > 20 ? 'emerging' : 'established' }
        }).filter(q => q.status.startsWith('emerging')).sort((a,b) => b.velocity_score - a.velocity_score)
        return JSON.stringify({ count: scored.length, emerging: scored.slice(0, input.limit||15) })
      }

      case 'content_freshness_audit': {
        const pages = await fetchPages()
        const yearPattern = /20[12]\d/
        const dated = pages.filter(p => yearPattern.test(p.page)).map(p => {
          const match = p.page.match(/(20[12]\d)/)
          return { page: p.page.replace('https://www.pointhacks.com.au',''), year: match?.[1], clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(1) }
        }).sort((a,b) => (a.year||'9999').localeCompare(b.year||'9999'))
        const undated = pages.filter(p => !yearPattern.test(p.page)).sort((a,b) => b.clicks - a.clicks).slice(0,10)
        return JSON.stringify({ dated_pages: dated.slice(0, input.limit||20), oldest_first: dated.slice(0,5), undated_top_pages: undated.map(p => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks })) })
      }

      case 'internal_linking_opportunities': {
        const pages = await fetchPages()
        const topPages = pages.filter(p => p.impressions >= (input.min_impressions||500)).sort((a,b) => b.clicks - a.clicks).slice(0,50)
        const pairs = []
        for (let i = 0; i < topPages.length; i++) {
          for (let j = i+1; j < topPages.length; j++) {
            const a = topPages[i].page.toLowerCase().split('/').filter(Boolean)
            const b = topPages[j].page.toLowerCase().split('/').filter(Boolean)
            const shared = a.filter(w => b.some(bw => bw.includes(w) || w.includes(bw)))
            if (shared.length > 0 && a[0] !== b[0]) {
              pairs.push({ page_a: topPages[i].page.replace('https://www.pointhacks.com.au',''), page_b: topPages[j].page.replace('https://www.pointhacks.com.au',''), shared_terms: shared, combined_clicks: topPages[i].clicks + topPages[j].clicks })
            }
          }
        }
        return JSON.stringify(pairs.sort((a,b) => b.combined_clicks - a.combined_clicks).slice(0, input.limit||15))
      }

      case 'ctr_improvement_simulator': {
        const data = await fetchQueries()
        const eligible = data.filter(q => q.avg_position <= (input.position_max||10) && q.impressions >= (input.min_impressions||200))
        const scenarios = [10, 25, 50].map(pct => {
          const extraClicks = eligible.reduce((s, q) => s + Math.round(q.impressions * q.avg_ctr * (pct/100)), 0)
          return { improvement_pct: pct, extra_clicks: extraClicks, new_total: eligible.reduce((s,q) => s+q.clicks,0) + extraClicks }
        })
        const currentClicks = eligible.reduce((s,q) => s+q.clicks,0)
        return JSON.stringify({ eligible_queries: eligible.length, current_clicks: currentClicks, scenarios, top_impact: eligible.sort((a,b) => b.impressions - a.impressions).slice(0,10).map(q => ({ query: q.query, impressions: q.impressions, current_clicks: q.clicks, ctr_pct: +(q.avg_ctr*100).toFixed(2) })) })
      }

      case 'position_improvement_simulator': {
        const data = await fetchQueries()
        const eligible = data.filter(q => q.avg_position > 3 && q.avg_position <= 20 && q.impressions >= (input.min_impressions||500))
        const ctrByPos = (pos) => pos <= 1 ? 0.28 : pos <= 2 ? 0.15 : pos <= 3 ? 0.11 : pos <= 5 ? 0.07 : pos <= 10 ? 0.04 : 0.02
        const scenarios = [1, 3, 5].map(improvement => {
          const gains = eligible.map(q => {
            const newPos = Math.max(1, q.avg_position - improvement)
            const newCtr = ctrByPos(newPos)
            return { query: q.query, current_pos: +q.avg_position.toFixed(0), new_pos: +newPos.toFixed(0), current_clicks: q.clicks, projected_clicks: Math.round(q.impressions * newCtr), gain: Math.round(q.impressions * newCtr) - q.clicks }
          }).filter(g => g.gain > 0).sort((a,b) => b.gain - a.gain)
          return { positions_up: improvement, total_extra_clicks: gains.reduce((s,g) => s+g.gain, 0), top_5: gains.slice(0,5) }
        })
        return JSON.stringify(scenarios)
      }

      case 'page_authority_ranking': {
        const pages = await fetchPages()
        const scored = pages.map(p => ({
          page: p.page.replace('https://www.pointhacks.com.au',''),
          clicks: p.clicks, impressions: p.impressions, position: +p.avg_position.toFixed(1),
          authority_score: Math.round((p.clicks * 2 + p.impressions * 0.01 + (100 - Math.min(100, p.avg_position)) * 5))
        })).sort((a,b) => b.authority_score - a.authority_score)
        return JSON.stringify({ top: scored.slice(0, input.limit||15), bottom: scored.slice(-10) })
      }

      case 'keyword_seasonality_check': {
        const data = await fetchQueries()
        const seasonal = { christmas: ['christmas','xmas','holiday gift'], summer: ['summer','beach','holiday'], winter: ['winter','ski','snow'], eofy: ['eofy','end of financial','tax time','tax return'], 'black friday': ['black friday','cyber monday','boxing day'], 'new year': ['new year','2024','2025','2026','resolution'] }
        const results = Object.entries(seasonal).map(([season, terms]) => {
          const matched = data.filter(q => terms.some(t => q.query.toLowerCase().includes(t)))
          return { season, keyword_count: matched.length, total_clicks: matched.reduce((s,q) => s+q.clicks,0), total_impressions: matched.reduce((s,q) => s+q.impressions,0), keywords: matched.sort((a,b) => b.clicks-a.clicks).slice(0,3).map(q => q.query) }
        }).filter(r => r.keyword_count > 0)
        const totalClicks = data.reduce((s,q) => s+q.clicks,0)
        const seasonalClicks = results.reduce((s,r) => s+r.total_clicks,0)
        return JSON.stringify({ seasonal_dependency_pct: +((seasonalClicks/totalClicks)*100).toFixed(1), seasons: results })
      }

      case 'orphan_page_detection': {
        const gscPages = await fetchPages()
        const { data: ga4 } = await supabase.from('ga4_pages').select('page_path, sessions').order('sessions',{ascending:true}).limit(200)
        const ga4Paths = new Set((ga4||[]).filter(p => p.sessions > 0).map(p => p.page_path))
        const orphans = gscPages.filter(p => {
          const path = p.page.replace('https://www.pointhacks.com.au','')
          return p.impressions >= (input.min_impressions||200) && p.clicks <= 1 && !ga4Paths.has(path)
        }).sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||15)
        return JSON.stringify({ count: orphans.length, pages: orphans.map(p => ({ page: p.page.replace('https://www.pointhacks.com.au',''), impressions: p.impressions, clicks: p.clicks, position: +p.avg_position.toFixed(0) })) })
      }

      case 'query_word_count_analysis': {
        const data = await fetchQueries()
        const groups = {}
        for (const q of data) {
          const wc = Math.min(6, q.query.split(' ').length)
          const key = wc >= 6 ? '6+' : String(wc)
          if (!groups[key]) groups[key] = { count: 0, clicks: 0, impressions: 0, positions: [] }
          groups[key].count++; groups[key].clicks += q.clicks; groups[key].impressions += q.impressions; groups[key].positions.push(q.avg_position)
        }
        return JSON.stringify(Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([words, d]) => ({ word_count: words, queries: d.count, clicks: d.clicks, impressions: d.impressions, avg_position: +(d.positions.reduce((a,b) => a+b,0)/d.positions.length).toFixed(1), avg_ctr_pct: d.impressions > 0 ? +((d.clicks/d.impressions)*100).toFixed(2) : 0 })))
      }

      case 'top_performing_authors': {
        const pages = await fetchPages()
        const sections = {}
        for (const p of pages) {
          const path = p.page.replace('https://www.pointhacks.com.au','')
          const section = '/' + (path.split('/').filter(Boolean)[0] || 'homepage')
          if (!sections[section]) sections[section] = { pages: 0, clicks: 0, impressions: 0, positions: [] }
          sections[section].pages++; sections[section].clicks += p.clicks; sections[section].impressions += p.impressions; sections[section].positions.push(p.avg_position)
        }
        return JSON.stringify(Object.entries(sections).map(([section, d]) => ({ section, pages: d.pages, clicks: d.clicks, impressions: d.impressions, avg_position: +(d.positions.reduce((a,b) => a+b,0)/d.positions.length).toFixed(1), clicks_per_page: Math.round(d.clicks/(d.pages||1)) })).sort((a,b) => b.clicks - a.clicks))
      }

      case 'competitor_serp_landscape': {
        const data = await fetchQueries()
        const topKws = data.filter(q => q.impressions >= 1000).sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||20)
        return JSON.stringify(topKws.map(q => {
          let competition = 'low'
          if (q.impressions > 50000 && q.avg_position > 5) competition = 'very_high'
          else if (q.impressions > 10000 && q.avg_position > 3) competition = 'high'
          else if (q.impressions > 5000) competition = 'medium'
          return { query: q.query, impressions: q.impressions, position: +q.avg_position.toFixed(1), clicks: q.clicks, competition, opportunity: q.avg_position > 3 && q.avg_position <= 10 ? 'attackable' : q.avg_position <= 3 ? 'defend' : 'long_term' }
        }))
      }

      case 'content_consolidation_candidates': {
        const pages = await fetchPages()
        const sections = {}
        for (const p of pages) {
          const parts = p.page.replace('https://www.pointhacks.com.au','').split('/').filter(Boolean)
          if (parts.length < 2) continue
          const section = parts[0]
          if (!sections[section]) sections[section] = []
          sections[section].push(p)
        }
        const candidates = Object.entries(sections)
          .filter(([,ps]) => ps.length >= (input.min_pages||3))
          .map(([section, ps]) => {
            const underperformers = ps.filter(p => p.clicks < 5 && p.avg_position > 15)
            return { section, total_pages: ps.length, underperforming: underperformers.length, underperforming_pages: underperformers.slice(0,5).map(p => ({ url: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions })), total_section_clicks: ps.reduce((s,p) => s+p.clicks,0) }
          }).filter(c => c.underperforming > 0).sort((a,b) => b.underperforming - a.underperforming).slice(0, input.limit||10)
        return JSON.stringify(candidates)
      }

      case 'revenue_potential_estimate': {
        const { data: seo } = await supabase.from('seo_keywords').select('*').order('search_volume',{ascending:false})
        const queries = await fetchQueries()
        const withValue = (seo||[]).filter(k => k.cpc && k.cpc > 0).map(k => {
          const gscMatch = queries.find(q => q.query.toLowerCase() === k.keyword.toLowerCase())
          return { keyword: k.keyword, position: k.position, search_volume: k.search_volume, cpc: k.cpc, monthly_value: Math.round(k.search_volume * k.cpc * (k.position <= 3 ? 0.15 : k.position <= 10 ? 0.05 : 0.01)), current_clicks: gscMatch?.clicks || 0 }
        }).sort((a,b) => b.monthly_value - a.monthly_value)
        return JSON.stringify({ total_monthly_value: withValue.reduce((s,k) => s+k.monthly_value,0), keywords: withValue })
      }

      case 'mobile_friendliness_proxy': {
        const { data: ga4 } = await supabase.from('ga4_pages').select('*').gte('sessions',15).order('sessions',{ascending:false}).limit(50)
        if (!ga4) return '[]'
        const avgBounce = ga4.reduce((s,p) => s+(p.bounce_rate||0),0)/ga4.length
        const avgTime = ga4.reduce((s,p) => s+(p.avg_time_on_page||0),0)/ga4.length
        const suspect = ga4.filter(p => (p.bounce_rate||0) > avgBounce * 1.3 && (p.avg_time_on_page||0) < avgTime * 0.5)
          .sort((a,b) => (b.sessions||0) - (a.sessions||0)).slice(0, input.limit||10)
        return JSON.stringify({ site_avg: { bounce: Math.round(avgBounce), time: Math.round(avgTime) }, suspect_pages: suspect.map(p => ({ page: p.page_path, bounce: Math.round(p.bounce_rate||0), time: Math.round(p.avg_time_on_page||0), sessions: p.sessions, issue: 'High bounce + low time suggests poor mobile UX' })) })
      }

      case 'local_seo_keywords': {
        const data = await fetchQueries()
        const geoTerms = ['australia','australian','sydney','melbourne','brisbane','perth','adelaide','hobart','canberra','gold coast','nz','new zealand','au']
        const local = data.filter(q => geoTerms.some(t => q.query.toLowerCase().includes(t)))
          .sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||20)
        return JSON.stringify({ count: local.length, total_clicks: local.reduce((s,q) => s+q.clicks,0), keywords: local.map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1) })) })
      }

      case 'comparison_keyword_analysis': {
        const data = await fetchQueries()
        const comparisons = data.filter(q => q.query.toLowerCase().includes(' vs ') || q.query.toLowerCase().includes(' versus ') || q.query.toLowerCase().includes(' compared to ') || q.query.toLowerCase().includes(' or '))
          .sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||20)
        return JSON.stringify({ count: comparisons.length, total_clicks: comparisons.reduce((s,q) => s+q.clicks,0), keywords: comparisons.map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: +q.avg_position.toFixed(1) })) })
      }

      case 'cpc_value_analysis': {
        const { data: seo } = await supabase.from('seo_keywords').select('*').not('cpc','is',null).order('cpc',{ascending:false})
        if (!seo) return '[]'
        const totalValue = seo.reduce((s,k) => s + (k.cpc||0) * (k.search_volume||0) * 0.05, 0)
        return JSON.stringify({ total_estimated_monthly_value: Math.round(totalValue), by_cpc: seo.map(k => ({ keyword: k.keyword, cpc: k.cpc, search_volume: k.search_volume, position: k.position, monthly_click_value: Math.round((k.cpc||0) * (k.search_volume||0) * (k.position <= 3 ? 0.15 : 0.05)) })) })
      }

      case 'page_depth_analysis': {
        const pages = await fetchPages()
        const byDepth = {}
        for (const p of pages) {
          const depth = p.page.replace('https://www.pointhacks.com.au','').split('/').filter(Boolean).length
          const key = depth <= 1 ? '1 (shallow)' : depth === 2 ? '2' : depth === 3 ? '3' : '4+ (deep)'
          if (!byDepth[key]) byDepth[key] = { pages: 0, clicks: 0, impressions: 0, positions: [] }
          byDepth[key].pages++; byDepth[key].clicks += p.clicks; byDepth[key].impressions += p.impressions; byDepth[key].positions.push(p.avg_position)
        }
        return JSON.stringify(Object.entries(byDepth).sort(([a],[b]) => a.localeCompare(b)).map(([depth, d]) => ({ depth, pages: d.pages, clicks: d.clicks, impressions: d.impressions, avg_position: +(d.positions.reduce((a,b) => a+b,0)/d.positions.length).toFixed(1), clicks_per_page: Math.round(d.clicks/(d.pages||1)) })))
      }

      case 'keyword_ranking_tiers': {
        const data = await fetchQueries()
        const tiers = { defend: data.filter(q => q.avg_position <= 3), grow: data.filter(q => q.avg_position > 3 && q.avg_position <= 10), attack: data.filter(q => q.avg_position > 10 && q.avg_position <= 20), research: data.filter(q => q.avg_position > 20) }
        return JSON.stringify(Object.entries(tiers).map(([tier, qs]) => ({ tier, count: qs.length, clicks: qs.reduce((s,q) => s+q.clicks,0), impressions: qs.reduce((s,q) => s+q.impressions,0), top_5: qs.sort((a,b) => b.impressions-a.impressions).slice(0,5).map(q => ({ query: q.query, position: +q.avg_position.toFixed(1), impressions: q.impressions })) })))
      }

      case 'traffic_concentration_risk': {
        const data = await fetchQueries()
        const sorted = [...data].sort((a,b) => b.clicks - a.clicks)
        const totalClicks = sorted.reduce((s,q) => s+q.clicks,0)
        const top10Clicks = sorted.slice(0,10).reduce((s,q) => s+q.clicks,0)
        const top50Clicks = sorted.slice(0,50).reduce((s,q) => s+q.clicks,0)
        const top100Clicks = sorted.slice(0,100).reduce((s,q) => s+q.clicks,0)
        const risk = top10Clicks/totalClicks > 0.5 ? 'HIGH' : top10Clicks/totalClicks > 0.3 ? 'MEDIUM' : 'LOW'
        return JSON.stringify({ total_queries: sorted.length, total_clicks: totalClicks, concentration: { top_10: { clicks: top10Clicks, pct: +((top10Clicks/totalClicks)*100).toFixed(1) }, top_50: { clicks: top50Clicks, pct: +((top50Clicks/totalClicks)*100).toFixed(1) }, top_100: { clicks: top100Clicks, pct: +((top100Clicks/totalClicks)*100).toFixed(1) } }, risk_level: risk, top_10_keywords: sorted.slice(0,10).map(q => ({ query: q.query, clicks: q.clicks, share_pct: +((q.clicks/totalClicks)*100).toFixed(2) })) })
      }

      case 'average_position_by_section': {
        const pages = await fetchPages()
        const sections = {}
        for (const p of pages) {
          const section = '/' + (p.page.replace('https://www.pointhacks.com.au','').split('/').filter(Boolean)[0] || 'homepage')
          if (!sections[section]) sections[section] = { positions: [], clicks: 0, pages: 0 }
          sections[section].positions.push(p.avg_position); sections[section].clicks += p.clicks; sections[section].pages++
        }
        return JSON.stringify(Object.entries(sections).map(([section, d]) => ({ section, pages: d.pages, avg_position: +(d.positions.reduce((a,b) => a+b,0)/d.positions.length).toFixed(1), total_clicks: d.clicks })).sort((a,b) => a.avg_position - b.avg_position))
      }

      case 'high_impression_low_click_queries': {
        const data = await fetchQueries()
        const results = data.filter(q => q.impressions >= (input.min_impressions||1000) && (q.avg_ctr*100) <= (input.max_ctr_pct||1))
          .sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||15)
        return JSON.stringify(results.map(q => ({ query: q.query, impressions: q.impressions, clicks: q.clicks, position: +q.avg_position.toFixed(1), ctr_pct: +(q.avg_ctr*100).toFixed(3), wasted_opportunity: Math.round(q.impressions * 0.03) })))
      }

      case 'click_through_funnel': {
        const [queries, pages, daily, ga4Pages] = await Promise.all([
          fetchQueries(), fetchPages(),
          supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(7),
          supabase.from('ga4_pages').select('*').order('sessions',{ascending:false}).limit(50)
        ])
        const totalImpressions = queries.reduce((s: number, q: any) => s + q.impressions, 0)
        const totalClicks = pages.reduce((s: number, p: any) => s + p.clicks, 0)
        const d = daily.data||[], ga = ga4Pages.data||[]
        const sessions = d.reduce((s: number,r: any) => s+(r.sessions||0),0)
        const avgBounce = ga.length ? ga.reduce((s: number,p: any) => s+(p.bounce_rate||0),0)/ga.length : 0
        const engaged = Math.round(sessions * (1 - avgBounce/100))
        return JSON.stringify({ funnel: [ { stage: 'Impressions', value: totalImpressions }, { stage: 'Clicks (GSC)', value: totalClicks }, { stage: 'Sessions (GA4 7d)', value: sessions }, { stage: 'Engaged sessions', value: engaged } ], drop_offs: { impressions_to_clicks_pct: totalImpressions > 0 ? +((totalClicks/totalImpressions)*100).toFixed(2) : 0, clicks_to_sessions_pct: sessions > 0 ? +((sessions/(totalClicks||1))*100).toFixed(1) : 0, session_to_engaged_pct: sessions > 0 ? +((engaged/sessions)*100).toFixed(1) : 0 } })
      }

      case 'top_queries_per_page': {
        const pat = input.url_pattern.toLowerCase()
        const pages = await fetchPages()
        const matched = pages.filter(p => p.page.toLowerCase().includes(pat))
        const { data: pageRaw } = await supabase.from('gsc_pages').select('*').ilike('page',`%${pat}%`).order('clicks',{ascending:false}).limit(input.limit||30)
        return JSON.stringify({ matching_pages: matched.slice(0,3).map(p => ({ url: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks, impressions: p.impressions })), page_data: (pageRaw||[]).map(r => ({ page: r.page?.replace('https://www.pointhacks.com.au',''), clicks: r.clicks, impressions: r.impressions, position: r.position ? +r.position.toFixed(1) : null })) })
      }

      case 'new_keyword_detection': {
        const data = await fetchQueries()
        const newKws = data.filter(q => q.clicks <= (input.max_clicks||3) && q.impressions >= (input.min_impressions||200))
          .sort((a,b) => b.impressions - a.impressions).slice(0, input.limit||15)
        return JSON.stringify({ count: newKws.length, keywords: newKws.map(q => ({ query: q.query, impressions: q.impressions, clicks: q.clicks, position: +q.avg_position.toFixed(1), potential: q.avg_position <= 10 ? 'high' : q.avg_position <= 20 ? 'medium' : 'low' })) })
      }

      case 'page_performance_percentiles': {
        const pages = await fetchPages()
        const sorted = {
          by_clicks: [...pages].sort((a,b) => b.clicks - a.clicks),
          by_impressions: [...pages].sort((a,b) => b.impressions - a.impressions),
        }
        const pct = (arr, p) => arr[Math.floor(arr.length * p / 100)]
        return JSON.stringify({
          total_pages: pages.length,
          clicks: { p10: pct(sorted.by_clicks, 10)?.clicks, median: pct(sorted.by_clicks, 50)?.clicks, p90: pct(sorted.by_clicks, 90)?.clicks, top_10_pct: sorted.by_clicks.slice(0,Math.ceil(pages.length*0.1)).map(p => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks })) },
          impressions: { p10: pct(sorted.by_impressions, 10)?.impressions, median: pct(sorted.by_impressions, 50)?.impressions, p90: pct(sorted.by_impressions, 90)?.impressions },
        })
      }

      case 'keyword_modifier_analysis': {
        const data = await fetchQueries()
        const modifiers = ['best','top','how to','what is','review','free','cheap','compare','vs','new','2024','2025','2026','australia','credit card','rewards','points','qantas','velocity']
        return JSON.stringify(modifiers.map(mod => {
          const matched = data.filter(q => q.query.toLowerCase().includes(mod))
          return { modifier: mod, count: matched.length, clicks: matched.reduce((s,q) => s+q.clicks,0), impressions: matched.reduce((s,q) => s+q.impressions,0), avg_position: matched.length ? +(matched.reduce((s,q) => s+q.avg_position,0)/matched.length).toFixed(1) : null }
        }).filter(m => m.count > 0).sort((a,b) => b.clicks - a.clicks).slice(0, input.limit||20))
      }

      case 'seo_priority_matrix': {
        const data = await fetchQueries()
        const eligible = data.filter(q => q.impressions >= 200)
        const matrix = eligible.map(q => {
          const impact = q.impressions > 5000 ? 'high' : q.impressions > 1000 ? 'medium' : 'low'
          const effort = q.avg_position <= 5 ? 'low' : q.avg_position <= 15 ? 'medium' : 'high'
          let quadrant = 'low_priority'
          if (impact === 'high' && effort === 'low') quadrant = 'quick_win'
          else if (impact === 'high' && effort !== 'low') quadrant = 'big_bet'
          else if (impact !== 'high' && effort === 'low') quadrant = 'fill_in'
          return { query: q.query, impressions: q.impressions, position: +q.avg_position.toFixed(1), clicks: q.clicks, impact, effort, quadrant }
        })
        const groups = { quick_win: matrix.filter(m => m.quadrant === 'quick_win'), big_bet: matrix.filter(m => m.quadrant === 'big_bet'), fill_in: matrix.filter(m => m.quadrant === 'fill_in'), low_priority: matrix.filter(m => m.quadrant === 'low_priority') }
        return JSON.stringify(Object.entries(groups).map(([q, items]) => ({ quadrant: q, count: items.length, total_impressions: items.reduce((s,i) => s+i.impressions,0), top_5: items.sort((a,b) => b.impressions-a.impressions).slice(0,5) })))
      }

      case 'daily_traffic_anomaly_detection': {
        const { data } = await supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(input.days||28)
        if (!data || data.length < 7) return 'Not enough data'
        const sessions = data.map(d => d.sessions||0)
        const avg = sessions.reduce((a,b) => a+b,0)/sessions.length
        const stdDev = Math.sqrt(sessions.reduce((s,v) => s + Math.pow(v-avg,2), 0)/sessions.length)
        const anomalies = data.filter(d => Math.abs((d.sessions||0) - avg) > stdDev * 1.5).map(d => ({ date: d.date, sessions: d.sessions, deviation: +((((d.sessions||0) - avg) / avg) * 100).toFixed(1), type: (d.sessions||0) > avg ? 'spike' : 'dip' }))
        return JSON.stringify({ avg_sessions: Math.round(avg), std_dev: Math.round(stdDev), anomalies, all_daily: data.map(d => ({ date: d.date, sessions: d.sessions })) })
      }

      case 'full_site_audit': {
        const [queries, pages, dailyRes, ga4Res, seoRes] = await Promise.all([
          fetchQueries(), fetchPages(),
          supabase.from('ga4_daily').select('*').order('date',{ascending:false}).limit(14),
          supabase.from('ga4_pages').select('*').gte('sessions',10).order('sessions',{ascending:false}).limit(50),
          supabase.from('seo_keywords').select('*').order('search_volume',{ascending:false}),
        ])
        const daily = dailyRes.data||[], ga4 = ga4Res.data||[], seo = seoRes.data||[]
        const tw = daily.slice(0,7), lw = daily.slice(7,14)
        const twS = tw.reduce((s,d) => s+(d.sessions||0),0), lwS = lw.reduce((s,d) => s+(d.sessions||0),0)
        const wowPct = lwS > 0 ? +((twS-lwS)/lwS*100).toFixed(1) : 0
        const top3 = queries.filter(q => q.avg_position <= 3).length
        const top10 = queries.filter(q => q.avg_position <= 10).length
        const ctrIssues = queries.filter(q => { if (q.avg_position > 5 || q.impressions < 200) return false; const exp = q.avg_position <= 1.5 ? 0.28 : q.avg_position <= 3.5 ? 0.12 : 0.06; return q.avg_ctr < exp }).length
        const quickWins = queries.filter(q => q.avg_position >= 4 && q.avg_position <= 15 && q.impressions >= 500).length
        const zeroClick = pages.filter(p => p.impressions >= 500 && p.clicks <= 2).length
        const avgBounce = ga4.length ? Math.round(ga4.reduce((s,p) => s+(p.bounce_rate||0),0)/ga4.length) : 0
        const totalClicks = queries.reduce((s,q) => s+q.clicks,0)
        const top10Clicks = queries.sort((a,b) => b.clicks-a.clicks).slice(0,10).reduce((s,q) => s+q.clicks,0)
        const concentrationPct = +((top10Clicks/totalClicks)*100).toFixed(1)
        const posScore = Math.min(25, (top10/Math.max(1,queries.length))*100)
        const ctrScore = Math.max(0, 25 - (ctrIssues/Math.max(1,top10))*25)
        const trafficScore = Math.min(25, Math.max(0, 12.5 + wowPct/4))
        const engScore = Math.max(0, 25 - (avgBounce/100)*25)
        const healthScore = Math.round(posScore+ctrScore+trafficScore+engScore)
        return JSON.stringify({
          health_score: healthScore,
          grade: healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : 'D',
          traffic: { sessions_7d: twS, wow_pct: wowPct, avg_bounce: avgBounce },
          seo_overview: { total_queries: queries.length, top_3: top3, top_10: top10, total_pages: pages.length },
          issues: { ctr_issues: ctrIssues, zero_click_pages: zeroClick, concentration_risk_pct: concentrationPct },
          opportunities: { quick_wins: quickWins, striking_distance: queries.filter(q => q.avg_position >= 8 && q.avg_position <= 15 && q.impressions >= 1000).length },
          top_5_keywords: queries.sort((a,b) => b.clicks-a.clicks).slice(0,5).map(q => ({ query: q.query, clicks: q.clicks, position: +q.avg_position.toFixed(1) })),
          top_5_pages: pages.sort((a,b) => b.clicks-a.clicks).slice(0,5).map(p => ({ page: p.page.replace('https://www.pointhacks.com.au',''), clicks: p.clicks })),
          tracked_keywords: seo.length,
        })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: `Tool error: ${err instanceof Error ? err.message : 'Unknown'}` })
  }
}

// ─── System prompt ──────────────────────────────────────────────
const systemPrompt = `You are an SEO analyst embedded in the Point Hacks monitoring platform.

Point Hacks is an Australian credit card affiliate website. Their revenue comes from users clicking out from credit card review/comparison pages to bank application pages.

North star metric: click-outs to bank application pages.
Primary revenue folder: /credit-cards/
Secondary: /qantas/, /velocity/, /amex/
Key competitors: Canstar, Finder, The Champagne Mile

You have full access to Google Search Console and GA4 data for pointhacks.com.au via the connected tool calls. Query real data to answer questions — do not guess or use generic information.

When analysing issues, always tie recommendations back to the impact on click-outs (revenue). A ranking drop on a credit card page is far more important than a ranking drop on a guide page.

Be specific and actionable. Don't give generic SEO advice. Reference actual data, actual URLs, actual numbers.

You have 75 powerful tools. USE THEM for every question. Call multiple tools to give comprehensive answers.

Key rules:
- CTR stored as decimal (0.05 = 5%). Tools return ctr_pct already multiplied.
- Lower position = better (#1 is best)
- Use **bold** for metrics/headings, format numbers with commas
- Be direct, specific, and actionable — this is a team dashboard
- When analyzing a topic, use 2-3 tools together for a complete picture
- Always calculate derived metrics (traffic potential, lost clicks, ROI) when useful
- For vague questions, start with get_executive_summary or site_health_score
- For specific keywords/pages, use search_everything first then drill down`

// ─── Streaming API Route ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages: userMessages } = await req.json()
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    let messages = userMessages.map((m: any) => ({ role: m.role, content: m.content }))

    // Tool-use loop: run non-streaming until we get the final text response
    let iterations = 0
    while (iterations < 8) {
      iterations++
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-20250514', max_tokens: 4096, system: systemPrompt, tools, messages }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('Anthropic error:', err)
        return new Response(JSON.stringify({ error: `API error: ${response.status}` }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }

      const data = await response.json()

      if (data.stop_reason === 'tool_use') {
        // Process tool calls
        messages.push({ role: 'assistant', content: data.content })
        const toolResults = []
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            const result = await executeTool(block.name, block.input)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }
        }
        messages.push({ role: 'user', content: toolResults })
        continue
      }

      // Final response — stream it
      // Re-request with streaming enabled for the final call
      const streamResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-20250514', max_tokens: 4096, system: systemPrompt, tools, messages, stream: true }),
      })

      if (!streamResponse.ok || !streamResponse.body) {
        // Fallback: return the non-streamed response
        const text = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || 'No response.'
        return new Response(JSON.stringify({ content: text }), { headers: { 'Content-Type': 'application/json' } })
      }

      // Transform Anthropic SSE stream into a simple text stream
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const readable = new ReadableStream({
        async start(controller) {
          const reader = streamResponse.body!.getReader()
          let buffer = ''
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const jsonStr = line.slice(6).trim()
                if (jsonStr === '[DONE]') continue
                try {
                  const event = JSON.parse(jsonStr)
                  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    controller.enqueue(encoder.encode(event.delta.text))
                  }
                } catch {}
              }
            }
          } catch (err) {
            console.error('Stream error:', err)
          } finally {
            controller.close()
          }
        }
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
        },
      })
    }

    return new Response(JSON.stringify({ content: 'Hit the tool call limit. Try a more specific question.' }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
