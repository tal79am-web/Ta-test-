/**
 * Seed script for OpportunityScout.
 *
 * Initializes:
 * - Default Settings row
 * - Sample Opportunities with scores and signals (for UI development)
 * - A sample DailySummary
 *
 * Run with: npm run db:seed --workspace=db
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  await prisma.settings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      keywords: ['SaaS', 'API', 'developer tools', 'automation', 'no-code'],
      enabledSources: [
        'reddit',
        'hackernews',
        'producthunt',
        'github',
        'stackoverflow',
        'devto',
        'g2reviews',
        'indiehackers',
      ],
      minOpportunityScore: 40,
      scoreWeightVolume: 0.3,
      scoreWeightMarketSize: 0.3,
      scoreWeightSignificance: 0.25,
      scoreWeightUrgency: 0.15,
      emailAlertsEnabled: false,
      alertEmail: '',
      alertThreshold: 75,
      crawlSchedule: '0 5 * * *',
      maxConcurrentCrawlers: 3,
      crawlerDelayMs: 1500,
    },
    update: {},
  });

  console.log('  ✓ Settings initialized');

  // ---------------------------------------------------------------------------
  // Sample Opportunities
  // ---------------------------------------------------------------------------
  const opportunities = [
    {
      id: 'opp_seed_001',
      title: 'Affordable Multi-Environment Secret Management for Small Teams',
      problemStatement:
        'Small developer teams struggle to manage secrets across dev/staging/production environments without expensive enterprise tools like HashiCorp Vault. Existing free tools lack proper access control and audit logging.',
      targetAudience: 'Solo developers and small SaaS teams (2–10 people)',
      category: 'MARKET_GAP',
      scoreComposite: 87.5,
      scoreVolume: 82.0,
      scoreMarketSize: 91.0,
      scoreSignificance: 89.0,
      scoreUrgency: 78.0,
      previousScore: 74.0,
      keywords: ['secrets', 'env vars', 'developer tools', 'security', 'SaaS'],
      sources: ['reddit', 'hackernews', 'stackoverflow'],
      solutionHints: [
        'Simple CLI that syncs .env files across team members with encryption',
        'GitHub-integrated secrets manager with per-branch overrides',
        'Lightweight web UI with role-based access and audit log',
      ],
      competitorContext:
        'HashiCorp Vault is too complex. Doppler and Infisical exist but pricing is a barrier for teams under 5 people.',
      revenueIndicators: [
        'Multiple users mention willingness to pay $5–15/month',
        'Team plan at $20–50/month mentioned as ideal',
        '"Would switch from Doppler if cheaper" in 3 threads',
      ],
    },
    {
      id: 'opp_seed_002',
      title: 'Real-Time Code Review Assistant That Understands Business Context',
      problemStatement:
        'Current AI code review tools flag syntax/style issues but lack understanding of the product domain. Developers want a tool that knows their codebase business rules and flags logic errors that violate them.',
      targetAudience: 'Engineering teams at B2B SaaS companies (10–100 engineers)',
      category: 'PAIN_POINT',
      scoreComposite: 79.2,
      scoreVolume: 75.0,
      scoreMarketSize: 85.0,
      scoreSignificance: 81.0,
      scoreUrgency: 72.0,
      previousScore: 71.0,
      keywords: ['AI', 'code review', 'developer tools', 'LLM', 'productivity'],
      sources: ['reddit', 'hackernews', 'github', 'devto'],
      solutionHints: [
        'VS Code extension that ingests ADRs and domain docs',
        'PR bot that cites specific business rules when flagging issues',
        'Integration with Notion/Confluence to keep context updated',
      ],
      competitorContext:
        'GitHub Copilot and CodeRabbit do generic reviews. None offer domain-context-aware review.',
      revenueIndicators: [
        '$50–100/seat/month cited as reasonable for senior-engineer-equivalent review quality',
        'Multiple CTOs in thread with 200+ upvotes asking for this exact product',
      ],
    },
    {
      id: 'opp_seed_003',
      title: 'Stripe-like Payment SDK for Physical Goods Marketplaces',
      problemStatement:
        'Building a marketplace with physical goods requires handling split payments, seller payouts, refunds, disputes, and shipping cost deductions. Stripe Connect works but requires extensive custom code that every marketplace rebuilds from scratch.',
      targetAudience: 'Marketplace startups and platform builders',
      category: 'FEATURE_REQUEST',
      scoreComposite: 68.4,
      scoreVolume: 60.0,
      scoreMarketSize: 78.0,
      scoreSignificance: 70.0,
      scoreUrgency: 62.0,
      previousScore: 65.0,
      keywords: ['payments', 'marketplace', 'Stripe', 'fintech', 'platform'],
      sources: ['reddit', 'indiehackers', 'stackoverflow'],
      solutionHints: [
        'Pre-built seller onboarding with KYC/KYB flow',
        'Automatic split payments with shipping cost subtraction',
        'Dispute resolution workflow built-in',
      ],
      competitorContext:
        'Stripe Connect, Paystack, and Adyen all require significant custom integration work for marketplace use cases.',
      revenueIndicators: [
        '0.1–0.3% transaction fee model mentioned as viable',
        'Enterprise contracts at $500–2000/month for high-volume sellers',
      ],
    },
  ];

  for (const opp of opportunities) {
    await prisma.opportunity.upsert({
      where: { id: opp.id },
      create: opp,
      update: {
        scoreComposite: opp.scoreComposite,
        previousScore: opp.previousScore,
        updatedAt: new Date(),
      },
    });
  }

  console.log(`  ✓ ${opportunities.length} sample opportunities created`);

  // ---------------------------------------------------------------------------
  // Sample Score History
  // ---------------------------------------------------------------------------
  const today = new Date();
  for (const opp of opportunities) {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().split('T')[0] as string;
      const variance = (Math.random() - 0.5) * 8;

      await prisma.scoreHistory.upsert({
        where: {
          opportunityId_date: {
            opportunityId: opp.id,
            date: dateStr,
          },
        },
        create: {
          opportunityId: opp.id,
          date: dateStr,
          composite: Math.min(100, Math.max(0, opp.scoreComposite + variance)),
          volume: Math.min(100, Math.max(0, opp.scoreVolume + variance)),
          marketSize: Math.min(100, Math.max(0, opp.scoreMarketSize + variance)),
          significance: Math.min(100, Math.max(0, opp.scoreSignificance + variance)),
          urgency: Math.min(100, Math.max(0, opp.scoreUrgency + variance)),
        },
        update: {},
      });
    }
  }

  console.log('  ✓ Score history seeded (7 days per opportunity)');

  // ---------------------------------------------------------------------------
  // Sample Raw Signals
  // ---------------------------------------------------------------------------
  const signals = [
    {
      id: 'sig_seed_001',
      sourceId: 'reddit-r-entrepreneur-abc123',
      source: 'reddit',
      url: 'https://reddit.com/r/entrepreneur/comments/abc123',
      title: 'How do you manage .env secrets across team members?',
      body: 'We have 5 devs and are constantly dealing with "it works on my machine" because of secret mismatches. We tried Doppler but it\'s too expensive for our stage. Anyone found a good free/cheap alternative?',
      author: 'u/startup_dev',
      score: 342,
      commentCount: 87,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      category: 'MARKET_GAP',
      filtered: true,
      noise: false,
      opportunityId: 'opp_seed_001',
      metadata: { subreddit: 'entrepreneur', flair: 'Tools' },
    },
    {
      id: 'sig_seed_002',
      sourceId: 'hn-ask-38291847',
      source: 'hackernews',
      url: 'https://news.ycombinator.com/item?id=38291847',
      title: 'Ask HN: Best practices for secrets management in small teams?',
      body: 'We\'re a 3-person startup. Currently using a shared .env file in a private repo (I know, terrible). What\'s the recommended approach that doesn\'t cost an arm and a leg?',
      author: 'throwaway_founder',
      score: 156,
      commentCount: 43,
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      category: 'MARKET_GAP',
      filtered: true,
      noise: false,
      opportunityId: 'opp_seed_001',
      metadata: { type: 'ask_hn' },
    },
  ];

  for (const signal of signals) {
    await prisma.rawSignal.upsert({
      where: { sourceId: signal.sourceId },
      create: signal,
      update: {},
    });
  }

  console.log(`  ✓ ${signals.length} sample signals created`);

  // ---------------------------------------------------------------------------
  // Sample Daily Summary
  // ---------------------------------------------------------------------------
  const todayStr = today.toISOString().split('T')[0] as string;

  await prisma.dailySummary.upsert({
    where: { date: todayStr },
    create: {
      date: todayStr,
      markdownContent: `# OpportunityScout Daily Summary — ${todayStr}

## Executive Overview

Today's crawl processed **247 signals** from 8 sources and identified **3 actionable opportunities** scoring above the threshold of 40.

---

## Top Opportunities

### 1. Affordable Multi-Environment Secret Management (Score: 87.5)
**Category**: Market Gap | **Sources**: Reddit, HN, Stack Overflow

Small developer teams have no affordable middle ground between insecure shared .env files and expensive enterprise tools. Community engagement is high (500+ upvotes across threads) with explicit willingness-to-pay signals.

**Key insight**: The $5–15/month individual tier is the primary unlocked price point.

---

### 2. Business-Context-Aware Code Review (Score: 79.2)
**Category**: Pain Point | **Sources**: Reddit, HN, GitHub, Dev.to

Existing AI code review tools are domain-agnostic. Engineering teams want tools that understand their specific business rules and can catch logic bugs, not just style issues.

---

### 3. Stripe for Physical Goods Marketplaces (Score: 68.4)
**Category**: Feature Request | **Sources**: Reddit, IndieHackers, Stack Overflow

Every marketplace builder rewrites the same Stripe Connect integration boilerplate. A higher-level SDK with built-in dispute resolution, seller KYC, and shipping cost handling would have strong adoption.

---

## Source Performance

| Source | Signals | Status |
|--------|---------|--------|
| Reddit | 89 | ✅ OK |
| Hacker News | 45 | ✅ OK |
| Product Hunt | 31 | ✅ OK |
| GitHub | 28 | ✅ OK |
| Stack Overflow | 22 | ✅ OK |
| Dev.to | 18 | ✅ OK |
| G2 Reviews | 9 | ✅ OK |
| IndieHackers | 5 | ✅ OK |
`,
      topOpportunityIds: ['opp_seed_001', 'opp_seed_002', 'opp_seed_003'],
      totalSignalsProcessed: 247,
      totalOpportunitiesFound: 3,
      emailSent: false,
    },
    update: {},
  });

  console.log('  ✓ Sample daily summary created');

  // ---------------------------------------------------------------------------
  // Sample Job Run
  // ---------------------------------------------------------------------------
  await prisma.jobRun.create({
    data: {
      jobType: 'crawl',
      status: 'completed',
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
      completedAt: new Date(Date.now() - 27 * 60 * 1000),
      durationMs: 3 * 60 * 1000,
      signalsProcessed: 247,
      opportunitiesCreated: 3,
      triggeredBy: 'scheduler',
      metadata: {
        reddit: 89,
        hackernews: 45,
        producthunt: 31,
        github: 28,
        stackoverflow: 22,
        devto: 18,
        g2reviews: 9,
        indiehackers: 5,
      },
    },
  });

  console.log('  ✓ Sample job run created');

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
