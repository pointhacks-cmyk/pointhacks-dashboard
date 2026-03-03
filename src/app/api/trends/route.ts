import { NextResponse } from 'next/server'

const googleTrends = require('google-trends-api')

const DEFAULT_KEYWORDS = [
  'best credit cards australia',
  'qantas points',
  'frequent flyer credit card',
  'credit card rewards',
  'velocity frequent flyer'
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keywords = searchParams.get('keywords')?.split(',') || DEFAULT_KEYWORDS
  const days = parseInt(searchParams.get('days') || '90')

  try {
    const kws = keywords.slice(0, 5)
    const [interestRes, relatedRes] = await Promise.all([
      googleTrends.interestOverTime({
        keyword: kws,
        startTime: new Date(Date.now() - days * 86400000),
        geo: 'AU',
      }),
      googleTrends.relatedQueries({
        keyword: kws[0],
        geo: 'AU',
      })
    ])

    const interest = JSON.parse(interestRes)
    const related = JSON.parse(relatedRes)

    const timeline = interest.default.timelineData?.map((t: any) => ({
      date: t.formattedTime,
      timestamp: parseInt(t.time) * 1000,
      values: t.value,
    })) || []

    const topRelated = related.default.rankedList?.[0]?.rankedKeyword?.slice(0, 10).map((k: any) => ({
      query: k.query,
      value: k.value,
    })) || []

    const risingRelated = related.default.rankedList?.[1]?.rankedKeyword?.slice(0, 10).map((k: any) => ({
      query: k.query,
      value: k.formattedValue,
    })) || []

    return NextResponse.json({
      keywords: kws,
      timeline,
      averages: interest.default.averages || [],
      topRelated,
      risingRelated,
    })
  } catch (error: any) {
    console.error('Google Trends API error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
