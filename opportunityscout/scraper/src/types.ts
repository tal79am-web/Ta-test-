// =============================================================================
// Scraper Types
// =============================================================================

/**
 * A single raw signal fetched from a source.
 * Stored as-is in the RawSignal table before AI processing.
 */
export interface RawSignal {
  /** Globally unique identifier combining source name and source-specific ID */
  sourceId: string;

  /** Source name matching SignalSource union type */
  source: string;

  /** Full URL of the content */
  url: string;

  /** Title of the post, issue, review, or article */
  title: string;

  /** Full body text (may be truncated for very long content) */
  body: string;

  /** Author username or display name */
  author?: string | undefined;

  /** Engagement score from the source (upvotes, stars, reactions, etc.) */
  score: number;

  /** Number of comments or replies */
  commentCount: number;

  /** When the content was originally published */
  publishedAt: Date;

  /** When this signal was fetched */
  crawledAt: Date;

  /** Additional source-specific metadata (tags, subreddit, labels, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * Interface that every crawler must implement.
 */
export interface CrawlerInterface {
  /** Human-readable name matching the source field in RawSignal */
  readonly name: string;

  /** Base URL of the site being crawled */
  readonly baseUrl: string;

  /**
   * Execute the crawl and return an array of raw signals.
   * The crawler is responsible for:
   * - Respecting robots.txt
   * - Adding delays between requests
   * - Deduplicating against the database
   */
  crawl(): Promise<RawSignal[]>;
}

/**
 * Options passed to the BaseCrawler constructor.
 */
export interface CrawlerOptions {
  /** Delay in milliseconds between HTTP requests. Default: from CRAWLER_DELAY_MS env var */
  delayMs?: number;

  /** Maximum number of retries on network error. Default: 3 */
  maxRetries?: number;

  /** Request timeout in milliseconds. Default: 30000 */
  timeoutMs?: number;

  /** Custom User-Agent string */
  userAgent?: string;
}

/**
 * Result of a crawl run including signals fetched and deduplication stats.
 */
export interface CrawlResult {
  source: string;
  signalsFetched: number;
  signalsNew: number;
  signalsDuplicate: number;
  errors: string[];
  durationMs: number;
}
