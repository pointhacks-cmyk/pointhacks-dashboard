import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// --- In-memory cache ---
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 min

// --- Types ---
interface RawStory {
  title: string
  url: string
  source: string
  publishedAt: string
  snippet: string
}

interface ScoredStory extends RawStory {
  id: string
  timeAgo: string
  score: number
  category: string
  why: string
  priority: 'high' | 'medium' | 'low'
}

// --- Helpers ---
function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function hashId(title: string): string {
  return crypto.createHash('md5').update(title).digest('hex').slice(0, 12)
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '')
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\w\s]/g, '').trim()
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(normalizeTitle(a).split(/\s+/))
  const wb = new Set(normalizeTitle(b).split(/\s+/))
  let overlap = 0
  for (const w of wa) if (wb.has(w)) overlap++
  return overlap / Math.max(wa.size, wb.size)
}

// --- RSS Fetcher ---
async function fetchRSS(url: string, sourceName: string): Promise<RawStory[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PointHacks-NewsScanner/1.0' }, signal: AbortSignal.timeout(10000) })
    const xml = await res.text()
    const stories: RawStory[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1]
      const title = decodeHtml((/<title>([\s\S]*?)<\/title>/.exec(item))?.[1] || '')
      const link = (/<link>([\s\S]*?)<\/link>/.exec(item))?.[1]?.trim() || ''
      const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item))?.[1]?.trim() || ''
      const sourceTag = (/<source[^>]*>([\s\S]*?)<\/source>/.exec(item))?.[1]?.trim()
      const desc = decodeHtml((/<description>([\s\S]*?)<\/description>/.exec(item))?.[1] || '')
      if (!title) continue
      stories.push({
        title: title.trim(),
        url: link,
        source: sourceTag ? decodeHtml(sourceTag) : sourceName,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        snippet: desc.slice(0, 200),
      })
    }
    return stories
  } catch {
    return []
  }
}

// --- Reddit Fetcher ---
async function fetchReddit(url: string): Promise<RawStory[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PointHacks-NewsScanner/1.0' }, signal: AbortSignal.timeout(10000) })
    const json = await res.json()
    const children = json?.data?.children || []
    return children.map((c: any) => ({
      title: c.data.title,
      url: c.data.url?.startsWith('http') ? c.data.url : `https://www.reddit.com${c.data.permalink}`,
      source: `Reddit r/${c.data.subreddit}`,
      publishedAt: new Date(c.data.created_utc * 1000).toISOString(),
      snippet: (c.data.selftext || '').slice(0, 200),
    }))
  } catch {
    return []
  }
}

// --- Dedup ---
function dedup(stories: RawStory[]): RawStory[] {
  const result: RawStory[] = []
  for (const s of stories) {
    const isDup = result.some(r => wordOverlap(r.title, s.title) > 0.8)
    if (!isDup) result.push(s)
  }
  return result
}

// --- AI Scoring ---
async function scoreStories(stories: RawStory[]): Promise<{ score: number; category: string; why: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return stories.map(() => ({ score: 0, category: 'Other', why: 'No API key — scoring skipped' }))

  const results = new Array(stories.length).fill({ score: 0, category: 'Other', why: '' })
  const batchSize = 15

  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize)
    const storiesList = batch.map((s, idx) => `${idx}. [${s.source}] ${s.title}\n   ${s.snippet}`).join('\n')
    const prompt = `You are a news editor for Point Hacks (pointhacks.com.au), Australia's leading credit card points and frequent flyer website.

Score each story from 1-10 on how relevant and valuable it would be for Point Hacks to cover. Consider:
- Direct relevance to credit cards, points, frequent flyer programs, travel rewards
- Breaking news vs old/recycled content
- Traffic potential (would people search for this?)
- Unique angle Point Hacks could offer

Also assign a category: "Credit Cards", "Airlines", "Loyalty Programs", "Travel Deals", "Competitor", "Industry", or "Other"

And write a 1-sentence "why cover" summary explaining why Point Hacks should or shouldn't cover this.

Return ONLY a JSON array: [{"index": 0, "score": 8, "category": "Credit Cards", "why": "..."}]

Stories:
${storiesList}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data?.content?.[0]?.text || ''
      const jsonMatch = /\[[\s\S]*\]/.exec(text)
      if (jsonMatch) {
        const scored: { index: number; score: number; category: string; why: string }[] = JSON.parse(jsonMatch[0])
        for (const s of scored) {
          if (s.index >= 0 && s.index < batch.length) {
            results[i + s.index] = { score: s.score, category: s.category, why: s.why }
          }
        }
      }
    } catch {
      // Continue with unscored
    }
  }
  return results
}

// --- Main handler ---
export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get('refresh') === '1'

  if (!refresh && cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Google News queries
  const googleQueries = [
    'best credit cards australia',
    'qantas frequent flyer news',
    'velocity frequent flyer news',
    'airline news australia',
    'travel rewards australia',
    'credit card rewards points australia',
    'airport lounge australia',
  ]
  const googleUrls = googleQueries.map(q =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`
  )

  // Fetch all in parallel
  const allPromises = [
    ...googleUrls.map(u => fetchRSS(u, 'Google News')),
    fetchRSS('https://www.executivetraveller.com/rss', 'Executive Traveller'),
    fetchRSS('https://feeds.feedburner.com/AustralianBusinessTraveller', 'Australian Business Traveller'),
    fetchReddit('https://www.reddit.com/r/qantas/new.json?limit=15'),
    fetchReddit('https://www.reddit.com/r/AusFinance/search.json?q=credit+card+OR+points+OR+frequent+flyer&sort=new&limit=15&restrict_sr=1'),
  ]

  const results = await Promise.all(allPromises)
  const sourceCount = results.filter(r => r.length > 0).length
  const allStories = results.flat()

  // Sort by date first (earliest first for dedup to keep earliest)
  allStories.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
  const unique = dedup(allStories)

  // Score with AI
  const scores = await scoreStories(unique)

  // Build final list
  const stories: ScoredStory[] = unique.map((s, i) => ({
    ...s,
    id: hashId(s.title),
    timeAgo: timeAgo(s.publishedAt),
    score: scores[i].score,
    category: scores[i].category,
    why: scores[i].why,
    priority: scores[i].score >= 8 ? 'high' : scores[i].score >= 5 ? 'medium' : 'low',
  }))

  // Sort: score desc, then date desc
  stories.sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  const response = {
    stories,
    fetchedAt: new Date().toISOString(),
    sourceCount,
    scoredCount: stories.length,
  }

  cache = { data: response, ts: Date.now() }
  return NextResponse.json(response)
}
