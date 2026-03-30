# OpportunityScout

An AI-powered market opportunity discovery platform that continuously crawls developer communities, forums, and review sites to surface unmet needs, pain points, and feature gaps — ranked by commercial viability.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Monorepo Structure](#monorepo-structure)
4. [How Scoring Works](#how-scoring-works)
5. [How to Add a New Crawler](#how-to-add-a-new-crawler)
6. [API Reference](#api-reference)
7. [Configuration Reference](#configuration-reference)
8. [Development Guide](#development-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpportunityScout                        │
│                                                                 │
│  ┌──────────┐   ┌─────────────────────────────────────────┐    │
│  │Scheduler │──▶│  BullMQ Queue (Redis)                   │    │
│  │(cron     │   │  ┌─────────┐ ┌──────────┐ ┌─────────┐  │    │
│  │05:00 UTC)│   │  │crawl-job│ │analyze-  │ │summary- │  │    │
│  └──────────┘   │  │         │ │job       │ │job      │  │    │
│                 │  └────┬────┘ └────┬─────┘ └────┬────┘  │    │
│                 └───────┼───────────┼─────────────┼───────┘    │
│                         │           │             │             │
│  ┌──────────────────────▼───┐       │             │             │
│  │  Scraper Package         │       │             │             │
│  │  ┌──────┐ ┌──────┐       │       │             │             │
│  │  │Reddit│ │HN    │ ...8  │       │             │             │
│  │  │Crawlr│ │Crawlr│ crawls│       │             │             │
│  │  └──────┘ └──────┘       │       │             │             │
│  │  BaseCrawler (robots.txt,│       │             │             │
│  │  dedup, delays)          │       │             │             │
│  └──────────────────────────┘       │             │             │
│           │ RawSignals               │             │             │
│           ▼                          ▼             ▼             │
│  ┌──────────────────┐   ┌───────────────────────────────────┐  │
│  │  PostgreSQL 15   │   │  AI Package (Anthropic Claude)    │  │
│  │  ┌────────────┐  │   │  Step 1: Filter (MARKET_GAP etc.) │  │
│  │  │RawSignal   │  │◀──│  Step 2: Extract structured data  │  │
│  │  │Opportunity │  │──▶│  Step 3: Cluster + deduplicate    │  │
│  │  │DailySummary│  │◀──│  Step 4: Score + rank             │  │
│  │  │JobRun      │  │   └───────────────────────────────────┘  │
│  │  │Settings    │  │                    │                      │
│  │  └────────────┘  │                    ▼                      │
│  └──────────────────┘       ┌────────────────────┐             │
│           │                  │  Summary Generator  │             │
│           ▼                  │  (Daily email via   │             │
│  ┌──────────────────┐        │   Resend)           │             │
│  │  Backend API     │        └────────────────────┘             │
│  │  (Express + TS)  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Next.js 14 App  │                                           │
│  │  Dashboard       │                                           │
│  │  Opportunities   │                                           │
│  │  Trends          │                                           │
│  │  Sources         │                                           │
│  │  Settings        │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Scheduler** triggers at 05:00 UTC via cron
2. **Crawl Job** fans out to all enabled crawlers in parallel (capped by `MAX_CONCURRENT_CRAWLERS`)
3. Each **Crawler** fetches raw content, respects robots.txt, deduplicates via URL hash, stores `RawSignal` rows
4. **Analyze Job** runs the 4-step AI pipeline on new signals:
   - **Filter**: Classifies each signal as `MARKET_GAP | PAIN_POINT | FEATURE_REQUEST | NOISE`
   - **Extract**: Pulls structured opportunity data (title, problem, audience, keywords)
   - **Cluster**: Groups semantically similar signals, merges duplicates
   - **Score**: Computes a composite 0–100 score using weighted dimensions
5. **Summary Job** generates a Markdown executive summary, stores it as `DailySummary`, sends email
6. **Backend API** serves data to the **Frontend**

---

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker + Docker Compose
- An Anthropic API key

### Setup

```bash
# 1. Clone and install
git clone <repo-url> opportunityscout
cd opportunityscout
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY and API_KEY

# 3. Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# 4. Run database migrations and seed
npm run db:migrate
npm run db:seed

# 5. Start development servers
npm run dev
```

The frontend will be at http://localhost:3000 and the backend API at http://localhost:3001.

### Running a Manual Crawl

```bash
curl -X POST http://localhost:3001/api/jobs/run-now \
  -H "X-API-Key: your-api-key-from-env" \
  -H "Content-Type: application/json" \
  -d '{"job": "crawl"}'
```

---

## Monorepo Structure

```
opportunityscout/
├── package.json          # Root workspace config
├── tsconfig.base.json    # Shared TypeScript settings
├── docker-compose.yml    # Infrastructure services
├── .env.example          # All documented environment variables
│
├── backend/              # Express REST API
├── frontend/             # Next.js 14 App Router UI
├── scraper/              # Web crawlers
├── ai/                   # Anthropic AI pipeline
├── scheduler/            # Cron jobs + BullMQ
├── db/                   # Prisma schema + client
└── tests/                # Integration + unit tests
```

Each workspace is an independent npm package that can be built and tested standalone. They share the `db` package for database access.

---

## How Scoring Works

Each opportunity receives a **composite score from 0–100** based on four weighted dimensions:

| Dimension | Default Weight | Description |
|-----------|---------------|-------------|
| **Volume** | 30% | Community engagement: upvotes, comments, views, shares across source signals |
| **Market Size** | 30% | Indicators of commercial value: pricing mentions, enterprise context, TAM signals |
| **Significance** | 25% | Strategic/technical importance: novelty, cross-domain applicability, urgency language |
| **Urgency** | 15% | Timing signals: "just launched", "looking for", "switching from", recency of signals |

### Score Formula

```
compositeScore = (
  volumeScore    * SCORE_WEIGHT_VOLUME    +
  marketScore    * SCORE_WEIGHT_MARKET_SIZE +
  significScore  * SCORE_WEIGHT_SIGNIFICANCE +
  urgencyScore   * SCORE_WEIGHT_URGENCY
) * 100
```

Each dimension score (0.0–1.0) is computed by the AI in `ai/src/pipeline/step4-score.ts` based on structured evidence extracted in Step 2.

### Adjusting Weights

Edit the `SCORE_WEIGHT_*` variables in your `.env` file. The weights are read at runtime, so no rebuild is needed. Ensure they sum to 1.0.

```env
SCORE_WEIGHT_VOLUME=0.25
SCORE_WEIGHT_MARKET_SIZE=0.35
SCORE_WEIGHT_SIGNIFICANCE=0.25
SCORE_WEIGHT_URGENCY=0.15
```

### Score Thresholds

- **< 40**: Filtered out (configurable via `MIN_OPPORTUNITY_SCORE`)
- **40–59**: Low priority, stored but not featured
- **60–74**: Medium priority, shown in table view
- **75–89**: High priority, featured on dashboard
- **90–100**: Top opportunities, trigger email alerts

---

## How to Add a New Crawler

### Step 1: Create the crawler file

```typescript
// scraper/src/crawlers/mysite.ts
import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal } from '../types.js';

export class MySiteCrawler extends BaseCrawler {
  readonly name = 'mysite';
  readonly baseUrl = 'https://mysite.com';

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Respect robots.txt (handled by BaseCrawler.canFetch)
    if (!await this.canFetch('/api/posts')) {
      this.logger.warn('robots.txt disallows crawling');
      return signals;
    }

    const response = await this.fetchWithDelay('https://mysite.com/api/posts');
    const data = await response.json();

    for (const post of data.posts) {
      // Check deduplication (BaseCrawler handles URL-based dedup)
      const signal: RawSignal = {
        sourceId: `mysite-${post.id}`,
        source: 'mysite',
        url: `https://mysite.com/posts/${post.id}`,
        title: post.title,
        body: post.content,
        author: post.author,
        score: post.votes,
        commentCount: post.comments,
        publishedAt: new Date(post.created_at),
        metadata: { tags: post.tags },
        crawledAt: new Date(),
      };

      signals.push(signal);
    }

    return signals;
  }
}
```

### Step 2: Register the crawler

```typescript
// scheduler/src/jobs/crawl-job.ts
import { MySiteCrawler } from 'scraper/src/crawlers/mysite.js';

// Add to the crawlers array:
const crawlers = [
  // ... existing crawlers
  new MySiteCrawler(),
];
```

### Step 3: Add feature flag

```env
# .env
ENABLE_MYSITE=true
```

```typescript
// crawl-job.ts — wrap instantiation with the flag:
if (process.env.ENABLE_MYSITE === 'true') {
  crawlers.push(new MySiteCrawler());
}
```

### Step 4: Add to Settings schema (optional)

If users should be able to toggle the crawler from the UI, add an entry to `db/prisma/schema.prisma` Settings or the default settings seed in `db/src/migrations/seed.ts`.

### BaseCrawler Capabilities

| Feature | Method | Description |
|---------|--------|-------------|
| robots.txt | `canFetch(path)` | Checks if path is allowed before fetching |
| Rate limiting | `fetchWithDelay(url)` | Adds `CRAWLER_DELAY_MS` between requests |
| Deduplication | `isDuplicate(sourceId)` | Checks DB for existing signal by sourceId |
| Retry | `fetchWithRetry(url, n)` | Retries up to n times with exponential backoff |
| User-Agent | Auto | Sets `OpportunityScout/1.0` on all requests |

---

## API Reference

All endpoints are prefixed with `/api`.

### Opportunities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/opportunities` | List all opportunities (paginated, sortable, filterable) |
| GET | `/api/opportunities/:id` | Get a single opportunity with all source signals |

Query params for list: `page`, `limit`, `sortBy`, `order`, `minScore`, `category`, `source`, `dateFrom`, `dateTo`

### Summaries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/summaries` | List daily summaries (newest first) |
| GET | `/api/summaries/:date` | Get summary for a specific date (YYYY-MM-DD) |

### Sources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sources` | Health status of all crawlers with last run stats |

### Jobs (API key protected)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/run-now` | Trigger a job immediately |

Body: `{ "job": "crawl" | "analyze" | "summary" | "all" }`

Header: `X-API-Key: <your-api-key>`

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get current settings |
| POST | `/api/settings` | Update settings |

---

## Configuration Reference

See `.env.example` for the full list of environment variables with descriptions.

Key configuration areas:

- **Scoring weights**: `SCORE_WEIGHT_*` — must sum to 1.0
- **Crawler toggles**: `ENABLE_*` — enable/disable individual crawlers
- **Scheduler**: `CRAWL_SCHEDULE` — standard cron expression
- **AI model**: `ANTHROPIC_MODEL` — do not change unless testing
- **Thresholds**: `MIN_OPPORTUNITY_SCORE` — minimum score to store

---

## Development Guide

### Running Tests

```bash
# All tests
npm run test

# Specific package
npm run test --workspace=tests

# Watch mode
cd tests && npx vitest --watch
```

### Database Operations

```bash
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:migrate    # Run pending migrations
npm run db:seed       # Seed initial data
npm run db:studio     # Open Prisma Studio UI
```

### Adding a New API Route

1. Create `backend/src/routes/myroute.ts`
2. Export a `Router` instance
3. Import and mount in `backend/src/index.ts`

### Updating the AI Pipeline

The pipeline is modular. Each step in `ai/src/pipeline/` receives the output of the previous step. To modify scoring logic, edit `step4-score.ts` and the corresponding prompt in `ai/src/prompts/`.

### Logging

Uses `pino` structured logging throughout. In development, set `LOG_PRETTY=true` for human-readable output.
