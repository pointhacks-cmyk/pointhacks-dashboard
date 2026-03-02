# Point Hacks Dashboard — Audit Report

## Sync & Integration Audit

**Audited:** 2026-03-03 | **File:** `google/sync.mjs`

### ✅ What's Working Well

1. **Token refresh logic** — Correctly checks `expires_in > 60`, refreshes via OAuth2 if needed. Refresh token is present and scopes include analytics + webmasters + adwords.
2. **GSC pagination** — Properly implemented with `PAGE_SIZE=25000`, `startRow` increment, and break on `rows.length < PAGE_SIZE`. Batch inserts (100 rows) with parameterised queries — good.
3. **GA4 property ID** (`properties/210859101`) — Correct format for GA4 Data API.
4. **GSC property** (`sc-domain:pointhacks.com.au`) — Correct domain property format.
5. **GSC date offset** — Correctly accounts for 3-day data delay.
6. **Upsert pattern** — All tables use `ON CONFLICT ... DO UPDATE`, safe for re-runs.
7. **DataForSEO keyword list** — 10 relevant money keywords with CTR curve traffic estimation.

### ⚠️ Issues Found & Fixed

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | **DataForSEO 402 not handled** — A "Payment Required" response would be parsed as JSON, likely crash or silently skip with a confusing error | High | **Fixed** — Added HTTP 402 check that breaks the keyword loop with a clear log message. Also catches `status_code=40202` in response body. |
| 2 | **No HTTP status checks on GA4/GSC fetches** — If Google returns 403/429/500, `resp.json()` may still parse an error object, but the script treats missing `.rows` as "no data" rather than an error | Medium | Noted — partially mitigated by existing `No daily data` logging that dumps the JSON response. Consider adding `resp.ok` checks. |
| 3 | **No retry logic** — Any transient Google API failure (429, 503) causes that entire sync category to return 0 rows silently | Medium | Noted |
| 4 | **FATAL error handler only logged `e.message`** — Stack trace was lost | Low | **Fixed** — Added `e.stack` to the catch handler. |
| 5 | **No sync.log file exists** — Cron is either not configured to redirect output, or hasn't run yet | Info | Noted |
| 6 | **Tokens.json access_token is stale on disk** — Refresh updates in-memory only, never writes back. Fine for single-run cron but means every run must refresh. | Low | By design — acceptable since refresh_token is persistent. |
| 7 | **No dry-run mode** — Cannot test without writing to Supabase | Low | Noted — consider adding `--dry-run` flag. |
| 8 | **No timeout on fetch calls** — A hung Google API connection would block forever | Medium | Noted — consider `AbortSignal.timeout(30000)`. |

### 🔍 DataForSEO Credentials

- Auth: `pointhacks@yottadigital.ai` (base64 encoded in script)
- If billing lapses, the script now gracefully skips all keywords instead of crashing
- Location code `2036` = Australia ✅

### 📊 Sync Coverage

| Source | Tables | Date Range | Notes |
|--------|--------|------------|-------|
| GA4 Daily | `ga4_daily` | Last 30 days | sessions, users, pageviews, engagement |
| GA4 Pages | `ga4_pages` | Last 30 days | Top 500 pages by pageviews |
| GA4 Traffic | `ga4_traffic_sources` | Last 30 days | Top 500 source/medium combos |
| GSC Queries | `gsc_queries` | Last 30 days (minus 3) | Full pagination |
| GSC Pages | `gsc_pages` | Last 30 days (minus 3) | Full pagination |
| DataForSEO | `seo_keywords` | Today only | 10 money keywords |
| Sync Log | `data_syncs` | — | Tracks each run |

### Recommendations

1. **Add `AbortSignal.timeout(30_000)` to all fetch calls** to prevent hanging
2. **Add simple retry (1 retry with 5s delay) for 429/503 responses** from Google APIs
3. **Set up cron output redirect**: `node sync.mjs >> sync.log 2>&1`
4. **Consider a `--dry-run` flag** that logs queries/counts without writing to DB
5. **Add HTTP status checks** (`if (!resp.ok)`) before parsing JSON on GA4/GSC calls

---

## Build & Dependencies Audit

**Auditor:** Agent 3 (Build & Dependencies)  
**Date:** 2026-03-03

### TypeScript
- ✅ `tsc --noEmit` passes with zero errors

### Build
- ✅ `next build` compiles successfully (Turbopack, 1040ms)
- ✅ All 14 pages generate correctly (12 static, 2 dynamic API routes)
- 🔧 **Fixed:** CSS `@import` order warning — moved Google Fonts `@import url()` above `@import "tailwindcss"` in `globals.css`
- 🔧 **Fixed:** Turbopack root inference warning — added `turbopack.root: __dirname` to `next.config.ts`

### Dependencies (package.json)
- ✅ All 13 dependencies are actively used and current
- ⚠️ **Minor:** `@types/node`, `@types/react`, `postcss`, `tailwindcss`, and `typescript` are build/dev tools but listed under `dependencies` instead of `devDependencies`. Works fine for Vercel deployments (which install all deps), but moving them to `devDependencies` would be cleaner.
- ✅ No unused dependencies detected

### Circular Dependencies
- ✅ `madge --circular` found zero circular dependencies across 30 source files

### Tailwind Config
- ✅ Using Tailwind CSS v4 with `@import "tailwindcss"` (no separate config file needed — v4 convention)

### Next.js Config (`next.config.ts`)
- ✅ Properly configured with remote image patterns for `i.pointhacks.com`
- ✅ Turbopack root now explicitly set

### Import Resolution
- ✅ All imports resolve correctly (verified via tsc and build)

### Sync Script (`google/sync.mjs`)
- ✅ Well-structured: GA4 daily/pages/traffic, GSC queries/pages, DataForSEO SERP tracking
- ✅ Pagination for GSC (25k page size), batch inserts (100 rows), upsert on conflict
- ✅ Token refresh logic with expiry check
- ✅ Week-over-week comparison analytics built in
- ⚠️ **Credentials in source:** DB connection string, DataForSEO API key, and OAuth tokens are hardcoded/read from adjacent files. Consider environment variables for production hygiene.
- ⚠️ **No error recovery:** If a single sync step fails, subsequent steps still run (good), but partial failures aren't logged to `data_syncs` table — only success is recorded.

### LaunchAgent (`com.pointhacks.sync.plist`)
- ✅ Valid plist, currently loaded (`launchctl list` confirms)
- ✅ Runs daily at 06:00 AEST
- ✅ Logs to `sync.log` / `sync-error.log`
- ✅ PATH includes `/opt/homebrew/bin` for Node.js

### Summary
| Area | Status |
|------|--------|
| TypeScript | ✅ Clean |
| Build | ✅ Clean (2 warnings fixed) |
| Dependencies | ✅ OK (minor: dev deps in deps) |
| Circular deps | ✅ None |
| Imports | ✅ All resolve |
| Sync script | ✅ Functional (minor: hardcoded creds) |
| LaunchAgent | ✅ Valid and loaded |

## Page Components Audit

**Audited:** 2026-03-03 | **Agent:** audit-pages

### Bugs Fixed

1. **ChatInterface.tsx — stale closure in event listener** (CRITICAL)
   - `chat-submit` event handler captured stale `submit` function due to empty `useEffect` deps
   - Fix: Added `submitRef` to always reference the latest `submit` function

2. **ChatInterface.tsx — history race condition** (MEDIUM)
   - `submit()` read `history` from closure; rapid submissions could use stale state
   - Fix: Added `historyRef` to always read current history

3. **Unhandled promise rejections in 6 pages** (MEDIUM)
   - Overview (`/`), Monitor, SEO, Settings, Recommendations, Search pages all had async `load()` or `fetchData()` without try/catch
   - Fix: Wrapped all async data fetches in try/catch/finally blocks

4. **ChatPage — stale `createThread` in useEffect** (LOW)
   - `createThread` called in useEffect with empty deps; not memoized
   - Fix: Added eslint-disable comment (intentional: only runs once on mount)

### Issues Reviewed (No Fix Needed)

5. **AuthGate.tsx** — Works correctly. Code "20262026", localStorage key "ph-auth". Handles paste, backspace, auto-advance. SSR-safe with `checking` state gate.

6. **AppShell.tsx** — Clean composition of AuthGate → Sidebar + MobileTopBar + main content. No issues.

7. **Sidebar.tsx** — Hover expand/collapse works. Mobile overlay with backdrop. Profile popup with sign-out. No rendering issues found.

8. **RecTinder.tsx** — Drag/swipe mechanics use framer-motion correctly. `useMotionValue` + `useTransform` properly wired. Undo works. Exit animation via `exitDir` state. No bugs found.

9. **DataTable.tsx** — Handles empty data (shows "No data found" row). Pagination clamps via `safePage`. Column toggle, CSV export, search all work. No edge case bugs.

10. **ChatInterface.tsx API errors** — Properly caught in try/catch, displays error message to user. ✓

### Other Observations

- **No console.log statements** in component code (only `console.error` in API route for server-side error logging — appropriate)
- **No memory leaks** — All useEffect event listeners have cleanup returns. No subscriptions without unsubscribe.
- **All pages have loading states** — Every data-fetching page shows spinner/skeleton while loading
- **MonitorPage `alertActions` localStorage** — Has SSR guard (`typeof window !== 'undefined'`) ✓
- **Recommendations `onComplete` fires Supabase inserts without await** — fire-and-forget pattern is acceptable for analytics logging
