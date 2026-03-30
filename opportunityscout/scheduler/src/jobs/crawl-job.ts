import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import { RedditCrawler } from '@opportunityscout/scraper/crawlers/reddit';
import { TwitterCrawler } from '@opportunityscout/scraper/crawlers/twitter';
import { LinkedInCrawler } from '@opportunityscout/scraper/crawlers/linkedin';
import { HackerNewsCrawler } from '@opportunityscout/scraper/crawlers/hackernews';
import { ProductHuntCrawler } from '@opportunityscout/scraper/crawlers/producthunt';
import { GitHubCrawler } from '@opportunityscout/scraper/crawlers/github';
import { StackOverflowCrawler } from '@opportunityscout/scraper/crawlers/stackoverflow';
import { DevToCrawler } from '@opportunityscout/scraper/crawlers/devto';
import { G2ReviewsCrawler } from '@opportunityscout/scraper/crawlers/g2reviews';
import { IndieHackersCrawler } from '@opportunityscout/scraper/crawlers/indiehackers';
import { CrunchbaseCrawler } from '@opportunityscout/scraper/crawlers/crunchbase';
import type { BaseCrawler } from '@opportunityscout/scraper';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { job: 'crawl' } });

interface CrawlJobOptions {
  jobRunId?: string;
}

/**
 * Orchestrates all enabled crawlers.
 *
 * - Reads enabled sources from the Settings table
 * - Runs crawlers concurrently up to MAX_CONCURRENT_CRAWLERS
 * - Saves signals via each crawler's saveSignals method (dedup included)
 * - Updates JobRun record with counts and per-source metadata
 */
export async function runCrawlJob(options: CrawlJobOptions = {}): Promise<{
  totalSignalsProcessed: number;
  bySource: Record<string, number>;
}> {
  const startTime = Date.now();
  logger.info('Starting crawl job');

  // Update job run status
  if (options.jobRunId) {
    await prisma.jobRun.update({
      where: { id: options.jobRunId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  // Get enabled sources from settings
  const settings = await prisma.settings.findFirst();
  const enabledSources = settings?.enabledSources ?? [
    'reddit', 'twitter', 'linkedin', 'hackernews', 'producthunt',
    'github', 'stackoverflow', 'devto', 'g2reviews', 'indiehackers', 'crunchbase',
  ];

  const maxConcurrent = settings?.maxConcurrentCrawlers ?? 3;
  const delayMs = settings?.crawlerDelayMs ?? 1500;

  // Build list of crawlers based on enabled sources + feature flags
  const crawlers: BaseCrawler[] = [];

  const crawlerMap: Record<string, () => BaseCrawler> = {
    reddit: () => new RedditCrawler({ delayMs }),
    hackernews: () => new HackerNewsCrawler({ delayMs }),
    producthunt: () => new ProductHuntCrawler({ delayMs }),
    github: () => new GitHubCrawler({ delayMs }),
    stackoverflow: () => new StackOverflowCrawler({ delayMs }),
    devto: () => new DevToCrawler({ delayMs }),
    g2reviews: () => new G2ReviewsCrawler({ delayMs: Math.max(delayMs, 3000) }),
    indiehackers: () => new IndieHackersCrawler({ delayMs: Math.max(delayMs, 2000) }),
    twitter: () => new TwitterCrawler({ delayMs }),
    linkedin: () => new LinkedInCrawler({ delayMs: Math.max(delayMs, 3000) }),
    crunchbase: () => new CrunchbaseCrawler({ delayMs }),
  };

  for (const source of enabledSources) {
    const envFlag = `ENABLE_${source.toUpperCase()}`;
    const isEnabled = process.env[envFlag] !== 'false';

    if (isEnabled && crawlerMap[source]) {
      crawlers.push(crawlerMap[source]!());
    }
  }

  logger.info({ count: crawlers.length, maxConcurrent }, 'Crawlers ready');

  // Run crawlers with concurrency limit
  const bySource: Record<string, number> = {};
  let totalSignals = 0;

  for (let i = 0; i < crawlers.length; i += maxConcurrent) {
    const batch = crawlers.slice(i, i + maxConcurrent);

    const batchResults = await Promise.allSettled(
      batch.map(async (crawler) => {
        const signals = await crawler.crawl();
        const saved = await (crawler as BaseCrawler & { saveSignals: (s: typeof signals) => Promise<number> })
          ['saveSignals'](signals);
        return { source: crawler.name, count: saved };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        bySource[result.value.source] = result.value.count;
        totalSignals += result.value.count;
        logger.info({ source: result.value.source, count: result.value.count }, 'Crawler finished');
      } else {
        logger.error({ err: result.reason }, 'Crawler failed');
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // Update job run record
  if (options.jobRunId) {
    await prisma.jobRun.update({
      where: { id: options.jobRunId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        signalsProcessed: totalSignals,
        metadata: bySource,
      },
    });
  }

  logger.info({ totalSignalsProcessed: totalSignals, durationMs }, 'Crawl job complete');
  return { totalSignalsProcessed: totalSignals, bySource };
}
