# Scibers Analytics Platform — Strategic Plan v1.0

## The Business Reality

Scibers (Point Hacks) makes money one way: **credit card affiliate commissions**. Every visitor that clicks through to a partner and gets approved = $50-200 commission. The vast majority of that traffic comes from **organic search**.

This means:
- A position drop on "best credit cards australia" from #1 to #3 = **~60% traffic loss** on that page = potentially **$10K+/month revenue impact**
- A CTR drop from title tag degradation = silent revenue bleed
- A competitor publishing a better comparison page = existential threat to a revenue page
- Google algorithm volatility = direct P&L impact

**The dashboard must be a business protection tool, not a vanity metrics display.**

---

## What Gets Cut (No More Dummy Data)

Everything currently showing mock/fake data gets replaced with either:
- **Real data** from connected sources
- **"Connect Source" placeholder** with setup instructions

Pages to gut:
- `/revenue` — All mock. Replace with "Connect Affiliate Network" setup flow (or build from GA4 events if they track outbound clicks)
- `/audience` — Device/geo/browser data exists in GA4. Pull real data or show connect prompt.
- `/content` — Editorial pipeline is mock. Replace with real page freshness analysis from GSC/GA4.
- `/technical` — Core Web Vitals mock. Can pull from CrUX API or PageSpeed Insights API.
- `/backlinks` — Mock. DataForSEO backlinks API needs separate subscription activation.
- `/ads` — Mock campaigns. Show "Connect Google Ads" / "Connect Meta Ads" setup.

---

## Phase 1: The Monitoring Engine (Week 1)

### 1.1 Organic Health Monitor — `/monitor`
The single most important page. Real-time(ish) protection for the business.

**Data sources:** GSC (daily sync), DataForSEO (SERP tracking)

**Alerts & Signals:**
| Signal | Detection | Severity |
|--------|-----------|----------|
| Position drop >3 for money keyword | Compare today vs 7-day avg position from GSC | 🔴 Critical |
| Clicks drop >20% WoW for any page | GSC weekly comparison | 🟡 Warning |
| CTR drop but position stable | CTR below expected for position bucket | 🟡 Warning (title/meta issue) |
| Impressions spike without click increase | CTR degradation signal | 🟡 Warning |
| New competitor entering top 5 | DataForSEO SERP tracking | 🔴 Critical |
| Page disappeared from top 20 | GSC position data | 🔴 Critical |

**Money Keywords to Track (auto-prioritized by revenue impact):**
- best credit cards australia
- qantas frequent flyer credit card
- best rewards credit card
- amex platinum review
- velocity credit card
- credit card comparison australia
- balance transfer credit cards
- (any query with >1000 impressions/month tied to /credit-card/ URLs)

**UI Design:**
- Top: Health score (green/amber/red) based on active alerts
- Alert feed: chronological, filterable by severity
- Position tracker: sparkline showing 30-day position trend for each money keyword
- Revenue impact estimate: "This drop could affect ~$X/month based on historical CTR→conversion rates"

### 1.2 Content Freshness & Optimization — Enhanced `/pages`
Not an editorial calendar. A "which pages need attention RIGHT NOW" tool.

**Data sources:** GSC (CTR, position), GA4 (sessions, bounce rate), sitemap/crawl data (last modified dates)

**Signals:**
| Signal | What it means | Action |
|--------|--------------|--------|
| High traffic page, CTR below average for its position | Title tag or meta description isn't compelling | Rewrite title/meta |
| Page losing sessions WoW consistently (3+ weeks) | Content may be stale or competitor overtook | Refresh content |
| Page with high bounce + low time on page | Content doesn't match search intent | Rewrite or restructure |
| Page not updated in 6+ months with >500 sessions/month | Stale content risk — Google may deprioritize | Schedule refresh |
| Page ranking #4-10 with high impressions | Almost there — small improvements could push to top 3 | Priority optimization target |

**UI Design:**
- Priority queue: pages sorted by "urgency × revenue impact"
- Each page shows: current position, CTR vs expected, last updated, sessions trend, recommended action
- One-click export: "Pages needing attention this week" → CSV/email

### 1.3 Competitor Intelligence — Enhanced `/seo`
Already have DataForSEO connected. Make it actually useful.

**What to track:**
- For each money keyword: our position vs top 3 competitors
- Alert when competitor overtakes us on any money keyword  
- Content gap: keywords where finder.com.au, canstar.com.au rank in top 10 but we don't
- Competitor new pages: detect when competitors publish new content targeting our keywords

**UI:**
- Head-to-head comparison table (already built, but needs automated daily tracking)
- Gap analysis: "Canstar ranks #3 for 'low fee credit cards' (8,100 searches/mo) — you don't rank at all"
- Opportunity score: search volume × (1 - difficulty) × relevance

---

## Phase 2: Channel Growth & Forecasting (Week 2-3)

### 2.1 Channel Growth Dashboard — Enhanced `/audience`
Real GA4 data, focused on channel trends over time.

**Key questions to answer:**
- Is organic growing or shrinking? By how much?
- Is the YouTube/Instagram push actually driving traffic?
- Which referral sources are growing fastest?
- What's the traffic mix trend? (more social = less search dependency = good)

**Data:** GA4 traffic sources synced daily

**UI:**
- Channel trend lines: 30/60/90 day view per channel
- Growth rate comparison: "Organic +3.2%/mo, Social +18.4%/mo, Referral +12%/mo"
- YouTube/Instagram specific section (if those referrers exist in data)
- Revenue attribution by channel (once affiliate tracking connected)

### 2.2 Revenue Forecasting — `/revenue`
Only with real data. Options:

**Option A: GA4 Event Tracking (recommended)**
If Scibers tracks outbound affiliate clicks as GA4 events, we can:
- Count clicks to each partner per page
- Estimate revenue using known commission rates
- Track revenue trend over time
- Forecast: "If organic traffic continues at -3%/month, revenue will drop by $X in 3 months"

**Option B: Direct Affiliate Network Integration**
Connect to affiliate network APIs (Commission Factory, Impact, etc.) for actual revenue data.

**Option C: Manual Upload**
Monthly revenue CSV upload, we correlate with traffic data.

→ **Need to ask: How does Scibers track affiliate clicks? GA4 events? UTMs? Network dashboard?**

### 2.3 Smart Recommendations — Enhanced `/recommendations`
No more seed data. Every recommendation generated from real signals:

- "Position drop detected: 'best credit cards' dropped from #1 to #3 yesterday. Estimated revenue impact: -$4,200/month. Action: Check for SERP feature changes or competitor content updates."
- "CTR opportunity: '/amex-platinum-review' has 12,400 impressions but only 2.1% CTR (expected 5%+ at position #2). Action: Test new title tag."
- "Content refresh needed: '/compare-frequent-flyer-credit-cards' last updated 8 months ago, losing 4% traffic/week for 6 weeks. Action: Update comparison data and republish."
- "Competitor alert: finder.com.au now ranks #2 for 'rewards credit card' — was #7 last week. They published a new comparison page."

---

## Phase 3: Advanced (Week 4+)

### 3.1 SERP Feature Monitoring
- Track featured snippets, PAA boxes, AI overviews for money keywords
- Alert when we lose a featured snippet
- Alert when AI overview appears (potential traffic reduction)

### 3.2 Backlink Monitoring
- Requires DataForSEO backlinks subscription activation
- Track new/lost links
- Competitor backlink acquisition alerts

### 3.3 YouTube Analytics Integration
- Connect YouTube Data API
- Video performance → website traffic correlation
- Which videos drive the most affiliate clicks

---

## Data Architecture

### What we have connected:
| Source | Status | Sync Frequency | Tables |
|--------|--------|---------------|--------|
| GA4 | ✅ Connected | Daily (manual) | `ga4_daily`, `ga4_pages`, `ga4_traffic_sources` |
| GSC | ✅ Connected | Daily (manual) | `gsc_queries`, `gsc_pages` |
| DataForSEO | ✅ Connected | On-demand | `seo_keywords`, `seo_content_gaps` |

### What we need:
| Source | Priority | Effort | Needed for |
|--------|----------|--------|-----------|
| Automated daily sync (GA4+GSC) | 🔴 Critical | Low — cron job | Everything |
| DataForSEO daily SERP tracking | 🔴 Critical | Medium | Monitor page |
| GA4 outbound click events | 🟡 High | Depends on current setup | Revenue tracking |
| DataForSEO backlinks | 🟡 High | Activate subscription | Backlink monitor |
| YouTube Data API | 🟢 Medium | Medium | Channel growth |
| CrUX/PageSpeed API | 🟢 Medium | Low | Technical health |
| Affiliate network API | 🟢 Medium | Varies | Revenue tracking |

### Sync Schedule:
```
Daily 6am AEST:
  1. GA4 → Supabase (sessions, pages, traffic sources — last 7 days)
  2. GSC → Supabase (queries, pages — last 7 days)  
  3. DataForSEO → Supabase (SERP positions for money keywords)
  4. Generate alerts from new data
  5. Generate recommendations from signals
```

---

## Immediate Next Steps

1. **Approve this plan** — confirm priorities, adjust scope
2. **Set up automated daily sync** — GA4 + GSC cron job (biggest unlock)
3. **Define money keywords** — which keywords directly drive credit card revenue?
4. **Build Organic Health Monitor** — the #1 priority page
5. **Remove all mock data** — replace with real data or "Connect Source" prompts
6. **Ask about affiliate tracking** — how do they currently track outbound clicks + revenue?

---

## Questions for Keith

1. How does Scibers currently track affiliate clicks? (GA4 events? UTM parameters? Affiliate network dashboard?)
2. Which affiliate networks are you on? (Commission Factory, Impact, direct partnerships?)
3. What are the top 20 money keywords you'd want monitored daily?
4. Do you have YouTube Analytics access? Instagram Insights API access?
5. Is there a CMS API to get "last updated" dates for articles?
6. What's the budget for DataForSEO? (Backlinks API is a separate subscription)
7. Should alerts go to Telegram/Slack/email?
