import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BASE = 'https://www.pointhacks.com.au'
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

interface AuditResult {
  page_path: string
  url: string
  has_h1: boolean
  h1_text: string
  has_meta_description: boolean
  meta_description: string
  meta_description_length: number
  internal_link_count: number
  external_link_count: number
  total_images: number
  images_with_alt: number
  alt_text_coverage: number
  lcp_ms: number | null
  fid_ms: number | null
  cls: number | null
  inp_ms: number | null
  performance_score: number | null
  accessibility_score: number | null
  seo_score: number | null
  page_size_kb: number | null
}

async function auditOnPage(url: string): Promise<Partial<AuditResult>> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PointHacks-SEO-Auditor/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  const html = await res.text()

  // H1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''

  // Meta description
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
    || html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i)
  const metaDesc = metaMatch ? metaMatch[1].trim() : ''

  // Links
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi
  let internalLinks = 0, externalLinks = 0
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue
    if (href.startsWith('/') || href.includes('pointhacks.com.au')) {
      internalLinks++
    } else if (href.startsWith('http')) {
      externalLinks++
    }
  }

  // Images
  const imgRegex = /<img\s+[^>]*>/gi
  const altRegex = /\balt=["']([^"']*)["']/i
  let totalImages = 0, imagesWithAlt = 0
  while ((match = imgRegex.exec(html)) !== null) {
    totalImages++
    const altMatch = match[0].match(altRegex)
    if (altMatch && altMatch[1].trim().length > 0) imagesWithAlt++
  }

  return {
    has_h1: h1Text.length > 0,
    h1_text: h1Text.slice(0, 500),
    has_meta_description: metaDesc.length > 0,
    meta_description: metaDesc.slice(0, 500),
    meta_description_length: metaDesc.length,
    internal_link_count: internalLinks,
    external_link_count: externalLinks,
    total_images: totalImages,
    images_with_alt: imagesWithAlt,
    alt_text_coverage: totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 10000) / 100 : 100,
    page_size_kb: Math.round(html.length / 1024),
  }
}

async function auditCWV(url: string): Promise<Partial<AuditResult>> {
  try {
    const psiUrl = `${PSI_API}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=seo`
    const res = await fetch(psiUrl, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) return {}
    const data = await res.json()

    const lh = data.lighthouseResult
    if (!lh) return {}

    const perf = lh.categories?.performance?.score
    const acc = lh.categories?.accessibility?.score
    const seo = lh.categories?.seo?.score
    const audits = lh.audits || {}

    return {
      performance_score: perf != null ? Math.round(perf * 100) : null,
      accessibility_score: acc != null ? Math.round(acc * 100) : null,
      seo_score: seo != null ? Math.round(seo * 100) : null,
      lcp_ms: audits['largest-contentful-paint']?.numericValue ? Math.round(audits['largest-contentful-paint'].numericValue) : null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      inp_ms: audits['interaction-to-next-paint']?.numericValue ? Math.round(audits['interaction-to-next-paint'].numericValue) : null,
    }
  } catch {
    return {}
  }
}

// POST /api/seo-audit { paths: ["/credit-cards/", "/qantas/"] }
// or { path: "/credit-cards/" } for single
export async function POST(req: NextRequest) {
  const body = await req.json()
  const paths: string[] = body.paths || (body.path ? [body.path] : [])
  if (paths.length === 0) return NextResponse.json({ error: 'No paths provided' }, { status: 400 })
  if (paths.length > 20) return NextResponse.json({ error: 'Max 20 pages per request' }, { status: 400 })

  const results: AuditResult[] = []
  for (const path of paths) {
    const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? path : '/' + path}`
    const pagePath = new URL(url).pathname
    try {
      const [onPage, cwv] = await Promise.all([auditOnPage(url), auditCWV(url)])
      const result: AuditResult = {
        page_path: pagePath,
        url,
        has_h1: onPage.has_h1 ?? false,
        h1_text: onPage.h1_text ?? '',
        has_meta_description: onPage.has_meta_description ?? false,
        meta_description: onPage.meta_description ?? '',
        meta_description_length: onPage.meta_description_length ?? 0,
        internal_link_count: onPage.internal_link_count ?? 0,
        external_link_count: onPage.external_link_count ?? 0,
        total_images: onPage.total_images ?? 0,
        images_with_alt: onPage.images_with_alt ?? 0,
        alt_text_coverage: onPage.alt_text_coverage ?? 0,
        lcp_ms: cwv.lcp_ms ?? null,
        fid_ms: cwv.fid_ms ?? null,
        cls: cwv.cls ?? null,
        inp_ms: cwv.inp_ms ?? null,
        performance_score: cwv.performance_score ?? null,
        accessibility_score: cwv.accessibility_score ?? null,
        seo_score: cwv.seo_score ?? null,
        page_size_kb: onPage.page_size_kb ?? null,
      }
      results.push(result)

      // Save to Supabase
      await supabase.from('seo_audits').insert({
        ...result,
      })
    } catch (err: any) {
      results.push({
        page_path: pagePath, url,
        has_h1: false, h1_text: `Error: ${err.message}`,
        has_meta_description: false, meta_description: '', meta_description_length: 0,
        internal_link_count: 0, external_link_count: 0,
        total_images: 0, images_with_alt: 0, alt_text_coverage: 0,
        lcp_ms: null, fid_ms: null, cls: null, inp_ms: null,
        performance_score: null, accessibility_score: null, seo_score: null, page_size_kb: null,
      })
    }
  }

  return NextResponse.json({ results, count: results.length })
}

// GET /api/seo-audit?latest=true — get latest audit per page
// GET /api/seo-audit?page_path=/credit-cards/ — get history for a page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pagePath = searchParams.get('page_path')
  const latest = searchParams.get('latest')

  if (pagePath) {
    const { data, error } = await supabase
      .from('seo_audits')
      .select('*')
      .eq('page_path', pagePath)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  if (latest) {
    // Get latest audit for each page using distinct on
    const { data, error } = await supabase
      .from('seo_audits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Dedupe by page_path (keep latest)
    const seen = new Set<string>()
    const unique = (data || []).filter(r => {
      if (seen.has(r.page_path)) return false
      seen.add(r.page_path)
      return true
    })
    return NextResponse.json(unique)
  }

  return NextResponse.json({ error: 'Provide ?latest=true or ?page_path=' }, { status: 400 })
}
