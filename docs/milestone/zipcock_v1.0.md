# ZipCock v1.0 — Implementation Overview

> 네이버 부동산 매물 모니터링 웹앱. 관심 지역 매물 변동을 자동 추적하고 Discord/Telegram 알림 발송.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, RSC) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| ORM | Prisma 7 (client generator) |
| DB | SQLite via `better-sqlite3` + `@prisma/adapter-better-sqlite3` |
| Crawler | Playwright (headless Chromium) — cookie extraction + `fetch` API calls |
| Scheduler | `node-cron` (standalone script) |
| Alerts | Discord Webhook, Telegram Bot API |

---

## Project Structure

```
prisma/
  schema.prisma              # DB schema (4 models)
prisma.config.ts             # Prisma datasource config

src/
├── app/
│   ├── layout.tsx            # Root layout (Geist font, Nav, metadata)
│   ├── globals.css           # Tailwind + CSS vars (design tokens) + fade-in animations
│   ├── page.tsx              # Dashboard (SSR) — stats cards, region sections, new/deactivated listings
│   ├── regions/page.tsx      # Region management (CSR) — cascading si/gun/eup selector, CRUD
│   ├── listings/page.tsx     # Listing browser (CSR) — filters, sort, pagination
│   ├── alerts/page.tsx       # Alert config (CSR) — Discord/Telegram setup, filter builder
│   └── api/
│       ├── regions/
│       │   ├── route.ts      # GET (list active), POST (register with auto-expand)
│       │   ├── [id]/route.ts # DELETE (soft-deactivate)
│       │   └── naver/route.ts# GET proxy — fetchRegions from Naver
│       ├── listings/
│       │   └── route.ts      # GET — paginated, filtered listing query
│       ├── crawl/
│       │   ├── route.ts      # POST — trigger crawl (blocking)
│       │   └── stream/route.ts # GET SSE — trigger crawl with real-time progress
│       └── alerts/
│           ├── route.ts      # GET (list), POST (create)
│           └── [id]/route.ts # PUT (toggle), DELETE
├── components/
│   ├── nav.tsx               # Sticky top nav with 4 links
│   └── crawl-button.tsx      # SSE-connected crawl trigger with progress display
├── crawler/
│   ├── crawl.ts              # Core crawl logic — region -> complexes -> articles -> DB upsert
│   ├── alerts.ts             # Post-crawl alert dispatch (filter matching, batching, rate-limit handling)
│   └── index.ts              # Standalone cron entry point
└── lib/
    ├── prisma.ts             # Singleton PrismaClient (dev hot-reload safe)
    ├── naver-api.ts          # Naver API client — cookie mgmt, fetchRegions, fetchComplexes, fetchArticles
    ├── crawl-events.ts       # EventEmitter singleton for SSE progress streaming
    ├── types.ts              # Shared types & constants (PROPERTY_TYPES, TRADE_TYPES, interfaces)
    └── format.ts             # formatPrice (만원/억), formatDate (relative), formatDirection, cortarTypeLabel
```

---

## DB Schema (prisma/schema.prisma)

4 models, SQLite backend:

### Region
- `id`, `name`, `cortarNo` (unique, Naver region code), `cortarType` (sido/sigungu/dong mapped to si/gun/eup)
- Self-referential hierarchy: `parentId` -> `parent`/`children`
- `isActive` — soft delete flag
- Relations: `listings[]`, `crawlLogs[]`

### Listing
- `id`, `naverArticleId` (unique), `regionId` (FK)
- `propertyType` (A01=아파트, A02=오피스텔, A03=빌라, A04=아파텔)
- `tradeType` (A1=매매, B1=전세, B2=월세, B3=단기)
- `price` (만원), `rentPrice` (월세 시), `area` (m²), `floor`, `buildingName`, `address`, `description`, `naverUrl`
- `firstSeenAt`, `lastSeenAt`, `isActive` — lifecycle tracking
- `createdAt`, `updatedAt`

### AlertConfig
- `id`, `channel` (discord/telegram), `webhookUrl`, `botToken`, `chatId`
- Filter fields: `filterPropertyTypes`, `filterTradeTypes`, `filterMinPrice`, `filterMaxPrice`, `filterRegionIds` (comma-separated JSON strings)
- `isActive`

### CrawlLog
- `id`, `regionId` (FK), `startedAt`, `finishedAt`
- `totalFound`, `newListings`, `updatedListings`
- `status` (running/success/error), `errorMessage`

---

## Core Flows

### 1. Crawl Pipeline (`src/crawler/crawl.ts`)

```
crawlAllActiveRegions()
  → for each active region (cortarType=eup):
      crawlRegion(regionId, cortarNo)
        → fetchComplexesByRegion(eupCode) — paginated, collects all complexes
        → filter complexes with 0 articles (skip)
        → for each complex × tradeType (A1, B1, B2; skip B3):
            → skip if complex has 0 count for this tradeType
            → fetchArticlesByComplex(complexNumber, tradeType)
            → for each article: upsert to Listing (findUnique → update/create)
        → deactivate listings not seen this crawl (lastSeenAt < crawlStartedAt)
        → update CrawlLog
  → if any new listings: sendAlerts()
```

Key optimizations:
- Skips complexes with 0 total articles
- Skips trade type API calls when complex count for that type is 0
- 1.5s delay between API calls (rate limiting)

### 2. Naver API Client (`src/lib/naver-api.ts`)

Uses Playwright to extract session cookies from `fin.land.naver.com`, then makes direct `fetch` calls to internal APIs:

- **Cookie management**: 30min TTL, auto-refresh on 401/non-200, min 60s between refreshes
- **Anti-detection**: Custom User-Agent, `webdriver=false` override, `headless: false`
- **Endpoints used**:
  - Region list: Playwright scraping of SSR HTML (no separate API)
  - Complex list: `GET /front-api/v1/complex/region?eupLegalDivisionNumber=...&size=20&page=...`
  - Article list: `POST /front-api/v1/complex/article/list` (with complexNumber, tradeTypes, etc.)

### 3. SSE Crawl Streaming (`src/app/api/crawl/stream/route.ts`)

- `GET /api/crawl/stream` returns `text/event-stream`
- Single crawl guard (`crawlInProgress` flag, returns 409 if busy)
- Events: `crawl:start`, `crawl:region`, `crawl:complex`, `crawl:region_done`, `crawl:complete`, `crawl:error`
- Client (`crawl-button.tsx`) connects via `EventSource`, displays progress, auto-reloads on complete

### 4. Alert Dispatch (`src/crawler/alerts.ts`)

- Queries new/removed listings from last 10 minutes
- Stale data detection: if last crawl > 3 days ago, limits to 5 alerts each
- Per-config filter matching: property type, trade type, price range, region
- Message batching (Discord 2000 char limit)
- Discord rate-limit retry (429 handling)

### 5. Region Registration (`src/app/api/regions/route.ts` POST)

- Auto-expand: registering a `si` fetches all `gun` children, then all `eup` grandchildren
- Registering a `gun` fetches all `eup` children
- Uses Playwright-based `fetchRegions()` — scrapes links from Naver SSR HTML
- All levels stored in DB with parent-child relationships

---

## Pages

### Dashboard (`/`) — SSR
- 4 stat cards: monitoring regions, total listings, 24h new, 24h deactivated
- Last crawl status bar (time, status, found/new counts)
- Top 5 regions by active listing count, each showing:
  - New listings (24h) with price, type, area, floor
  - Deactivated listings section (red-tinted)
- Manual crawl button with SSE progress

### Region Management (`/regions`) — CSR
- Cascading 3-level dropdown: sido -> sigungu -> dong (fetched from Naver via proxy API)
- Can register at any level (auto-expands to eup children)
- Active regions list with delete (soft-deactivate)

### Listing Browser (`/listings`) — CSR
- Filters: region, property type, trade type
- Sort: newest, price, area
- Paginated (20/page) table with building name, type badges, price, area/floor, date
- External link to Naver listing page

### Alert Settings (`/alerts`) — CSR
- Channel selector: Discord (webhook URL) / Telegram (bot token + chat ID)
- Filter builder: property types, trade types, price range, regions (all optional toggle chips)
- Alert list with activate/deactivate toggle and delete

---

## Design System (`globals.css`)

CSS custom properties mapped to Tailwind via `@theme inline`:
- Colors: `background`, `foreground`, `card`, `border`, `muted`, `primary`/`light`/`dark`, `danger`/`light`, `success`/`light`
- Fonts: Geist Sans + Geist Mono (Google Fonts via next/font)
- Animation: `fade-in` with staggered delay classes (60ms increments)

---

## Entry Points

| Command | What it does |
|---------|-------------|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run crawler` | Standalone cron — runs crawl immediately + schedules every N minutes |
| `npm run crawl:once` | One-shot crawl via CLI |
| Dashboard "수동 크롤링" button | SSE-connected crawl via `/api/crawl/stream` |

---

## Config Files

| File | Purpose |
|------|---------|
| `prisma.config.ts` | Prisma schema/migration/datasource paths |
| `next.config.ts` | Next.js config (currently empty) |
| `postcss.config.mjs` | PostCSS with `@tailwindcss/postcss` |
| `eslint.config.mjs` | ESLint with `eslint-config-next` |
| `.env` / `.env.example` | `DATABASE_URL`, `CRAWL_INTERVAL_MINUTES`, Discord/Telegram credentials |

---

## Known Constraints / Notes

- Playwright runs with `headless: false` — requires display environment (not suitable for headless servers without Xvfb)
- Cookie-based auth to Naver — may break if Naver changes anti-bot measures
- SQLite single-file DB — no concurrent write support beyond what better-sqlite3 provides
- No authentication on the web UI — assumed local/private network deployment
- Alert filter values stored as comma-separated strings (not JSON arrays)
- `crawlInProgress` guard is in-memory — doesn't survive server restart
- Price stored in 만원 units (API returns 원, converted in `fetchArticlesByComplex`)
