import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BRAVE_API_KEY = process.env.BRAVE_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Fetch page content as text (strip HTML to key content)
async function fetchPageContent(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PointHacksBot/1.0)' },
      signal: AbortSignal.timeout(10000) 
    })
    if (!resp.ok) return `[Failed to fetch: ${resp.status}]`
    const html = await resp.text()
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)
    const metaDesc = metaMatch ? metaMatch[1].trim() : ''
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''
    const h2s = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    const wordCount = text.split(/\s+/).length
    
    return JSON.stringify({
      title,
      metaDescription: metaDesc,
      h1,
      h2s: h2s.slice(0, 20),
      wordCount,
      contentPreview: text.slice(0, 3000),
    })
  } catch (e: any) {
    return `[Error fetching page: ${e.message}]`
  }
}

async function braveSearch(query: string, count: number = 10): Promise<any[]> {
  if (!BRAVE_API_KEY) return []
  try {
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      country: 'AU',
      search_lang: 'en',
      result_filter: 'web',
    })
    const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'X-Subscription-Token': BRAVE_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.web?.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      domain: new URL(r.url).hostname,
    }))
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    const pagePath = url.replace('https://www.pointhacks.com.au', '').replace('https://pointhacks.com.au', '')
    const fullUrl = url.startsWith('http') ? url : `https://www.pointhacks.com.au${url}`

    const now = new Date()
    const end = now.toISOString().slice(0, 10)
    const start = new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10)
    
    const { data: pageData } = await supabase.rpc('gsc_pages_agg', {
      start_date: start, end_date: end, search_text: pagePath, sort_col: 'clicks', sort_dir: 'desc', lim: 1
    })
    
    const pathWords = pagePath.replace(/[/-]/g, ' ').trim().split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3)
    const searchTerms = pathWords.join(' ')
    
    const { data: relatedQueries } = await supabase.rpc('gsc_queries_agg', {
      start_date: start, end_date: end, search_text: searchTerms || null, sort_col: 'clicks', sort_dir: 'desc', lim: 20
    })

    const { data: ga4Data } = await supabase.from('ga4_pages')
      .select('*')
      .ilike('page_path', `%${pagePath}%`)
      .gte('date', start)
      .order('date', { ascending: false })
      .limit(30)

    const ourContent = await fetchPageContent(fullUrl)

    const topQueries = (relatedQueries || []).slice(0, 5).map((q: any) => q.query)
    const competitorResults: any[] = []
    const seenDomains = new Set(['pointhacks.com.au', 'www.pointhacks.com.au'])
    
    for (const query of topQueries.slice(0, 3)) {
      const results = await braveSearch(query + ' australia', 10)
      for (const r of results) {
        if (seenDomains.has(r.domain)) continue
        seenDomains.add(r.domain)
        competitorResults.push({ ...r, matchedQuery: query })
        if (competitorResults.length >= 8) break
      }
      if (competitorResults.length >= 8) break
    }

    if (competitorResults.length < 5 && searchTerms) {
      const directResults = await braveSearch(searchTerms + ' australia', 10)
      for (const r of directResults) {
        if (seenDomains.has(r.domain)) continue
        seenDomains.add(r.domain)
        competitorResults.push({ ...r, matchedQuery: searchTerms })
        if (competitorResults.length >= 8) break
      }
    }

    const topCompetitors = competitorResults.slice(0, 3)
    const competitorContents = await Promise.all(
      topCompetitors.map(async (comp) => ({
        ...comp,
        content: await fetchPageContent(comp.url),
      }))
    )

    const pageMetrics = pageData?.[0] || {}
    const ga4Summary = {
      totalSessions: (ga4Data || []).reduce((s: number, r: any) => s + (r.sessions || 0), 0),
      totalPageViews: (ga4Data || []).reduce((s: number, r: any) => s + (r.page_views || 0), 0),
      avgBounceRate: ga4Data?.length ? ((ga4Data.reduce((s: number, r: any) => s + (r.bounce_rate || 0), 0)) / ga4Data.length).toFixed(1) : 'N/A',
      totalClickOuts: (ga4Data || []).reduce((s: number, r: any) => s + (r.affiliate_clicks || 0), 0),
    }

    const prompt = `You are an SEO analyst for Point Hacks (pointhacks.com.au), Australia's leading credit card affiliate site. Revenue = users clicking out to bank application pages.

I need a competitive analysis comparing our page against competitor pages ranking for the same keywords.

## OUR PAGE
URL: ${fullUrl}
GSC Metrics (last 28 days): ${JSON.stringify(pageMetrics)}
GA4 Metrics: ${JSON.stringify(ga4Summary)}
Top Ranking Queries: ${JSON.stringify(topQueries)}
Page Content: ${ourContent}

## COMPETITOR PAGES
${competitorContents.map((c, i) => `### Competitor ${i + 1}: ${c.domain}
URL: ${c.url}
Matched Query: ${c.matchedQuery}
SERP Description: ${c.description}
Page Content: ${c.content}
`).join('\n')}

## ALL SEARCH RESULTS FOR OUR QUERIES
${JSON.stringify(competitorResults.map(r => ({ domain: r.domain, title: r.title, query: r.matchedQuery })))}

## ANALYSIS REQUIRED

Provide a JSON response with this exact structure:
{
  "pageOverview": {
    "title": "extracted page title",
    "topic": "what this page is about in 1 sentence",
    "wordCount": number,
    "contentType": "review|comparison|guide|landing|other"
  },
  "competitors": [
    {
      "domain": "competitor.com",
      "url": "full url",
      "title": "their page title",
      "threatLevel": "high|medium|low",
      "whyTheyRank": "1 sentence on why they rank well"
    }
  ],
  "swot": {
    "strengths": ["things our page does well vs competitors - be specific, cite content/features"],
    "weaknesses": ["things competitors do better - be specific about what content/features they have that we don't"],
    "opportunities": ["specific content additions or improvements that would help us outrank competitors"],
    "threats": ["competitive threats and risks to our ranking"]
  },
  "contentGaps": [
    {
      "gap": "specific content or feature competitors have that we're missing",
      "competitor": "which competitor has this",
      "priority": "high|medium|low",
      "effort": "easy|medium|hard"
    }
  ],
  "actionItems": [
    {
      "action": "specific action to take - be very specific, not generic",
      "priority": "high|medium|low",
      "estimatedImpact": "what improvement to expect",
      "effort": "easy|medium|hard"
    }
  ],
  "titleMetaSuggestions": {
    "currentTitle": "current title tag",
    "suggestedTitle": "improved title tag for better CTR",
    "currentMeta": "current meta description", 
    "suggestedMeta": "improved meta description for better CTR"
  }
}

Be SPECIFIC. Don't give generic SEO advice. Reference actual content differences you can see between the pages. Every recommendation should be something the content team can action immediately.`

    let analysis = null
    if (ANTHROPIC_API_KEY) {
      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (aiResp.ok) {
        const aiData = await aiResp.json()
        const text = aiData.content?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try { analysis = JSON.parse(jsonMatch[0]) } catch { analysis = { raw: text } }
        } else {
          analysis = { raw: text }
        }
      }
    }

    return NextResponse.json({
      url: fullUrl,
      pagePath,
      gscMetrics: pageMetrics,
      ga4Metrics: ga4Summary,
      topQueries: topQueries,
      allQueries: relatedQueries,
      competitors: competitorResults,
      analysis,
      fetchedAt: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('Page inspect error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
