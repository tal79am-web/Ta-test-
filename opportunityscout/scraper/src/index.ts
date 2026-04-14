/**
 * @opportunityscout/scraper
 *
 * Entry point — exports all crawlers and shared types.
 * Each crawler implements the CrawlerInterface and can be run independently
 * or orchestrated by the scheduler's crawl-job.
 */

export { BaseCrawler } from './base-crawler.js';
export type { RawSignal, CrawlerInterface, CrawlerOptions } from './types.js';

// Social platforms
export { RedditCrawler } from './crawlers/reddit.js';
export { TwitterCrawler } from './crawlers/twitter.js';
export { LinkedInCrawler } from './crawlers/linkedin.js';

// Tech & developer sources
export { HackerNewsCrawler } from './crawlers/hackernews.js';
export { ProductHuntCrawler } from './crawlers/producthunt.js';
export { GitHubCrawler } from './crawlers/github.js';
export { StackOverflowCrawler } from './crawlers/stackoverflow.js';
export { DevToCrawler } from './crawlers/devto.js';

// Business & market intelligence
export { G2ReviewsCrawler } from './crawlers/g2reviews.js';
export { IndieHackersCrawler } from './crawlers/indiehackers.js';
export { CrunchbaseCrawler } from './crawlers/crunchbase.js';

import { RedditCrawler } from './crawlers/reddit.js';
import { TwitterCrawler } from './crawlers/twitter.js';
import { LinkedInCrawler } from './crawlers/linkedin.js';
import { HackerNewsCrawler } from './crawlers/hackernews.js';
import { ProductHuntCrawler } from './crawlers/producthunt.js';
import { GitHubCrawler } from './crawlers/github.js';
import { StackOverflowCrawler } from './crawlers/stackoverflow.js';
import { DevToCrawler } from './crawlers/devto.js';
import { G2ReviewsCrawler } from './crawlers/g2reviews.js';
import { IndieHackersCrawler } from './crawlers/indiehackers.js';
import { CrunchbaseCrawler } from './crawlers/crunchbase.js';
import type { CrawlerInterface, CrawlerOptions } from './types.js';

/**
 * Returns an array of all registered crawler instances.
 * Used by the crawl-job to run all crawlers in sequence.
 *
 * Crawlers that require missing credentials will self-skip and return [].
 *
 * @param options - Optional crawler configuration (delay, retries, etc.)
 */
export function createAllCrawlers(options: CrawlerOptions = {}): CrawlerInterface[] {
  return [
    new RedditCrawler(options),
    new TwitterCrawler(options),
    new LinkedInCrawler(options),
    new HackerNewsCrawler(options),
    new ProductHuntCrawler(options),
    new GitHubCrawler(options),
    new StackOverflowCrawler(options),
    new DevToCrawler(options),
    new G2ReviewsCrawler(options),
    new IndieHackersCrawler(options),
    new CrunchbaseCrawler(options),
  ];
}
