import robotsParser from 'robots-parser';
import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import type { CrawlerInterface, CrawlerOptions, RawSignal } from './types.js';

const USER_AGENT = 'OpportunityScout/1.0 (+https://github.com/opportunityscout)';

/**
 * Abstract base class for all OpportunityScout crawlers.
 *
 * Provides:
 * - robots.txt fetching and checking
 * - Configurable delay between requests
 * - Exponential backoff retry logic
 * - URL-based deduplication via the database
 * - Structured logging via pino
 */
export abstract class BaseCrawler implements CrawlerInterface {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  protected readonly logger: pino.Logger;
  protected readonly delayMs: number;
  protected readonly maxRetries: number;
  protected readonly timeoutMs: number;
  protected readonly userAgent: string;

  private robotsTxt: ReturnType<typeof robotsParser> | null = null;
  private robotsTxtFetched = false;

  constructor(options: CrawlerOptions = {}) {
    this.delayMs = options.delayMs ?? parseInt(process.env['CRAWLER_DELAY_MS'] ?? '1500', 10);
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.userAgent = options.userAgent ?? USER_AGENT;

    this.logger = pino({
      level: process.env['LOG_LEVEL'] ?? 'info',
      base: { crawler: this.constructor.name },
    });
  }

  /**
   * Execute the crawl. Implemented by each subclass.
   */
  abstract crawl(): Promise<RawSignal[]>;

  // ---------------------------------------------------------------------------
  // robots.txt
  // ---------------------------------------------------------------------------

  /**
   * Fetches and parses the robots.txt for the crawler's baseUrl.
   * Results are cached for the lifetime of the crawler instance.
   */
  private async fetchRobotsTxt(): Promise<void> {
    if (this.robotsTxtFetched) return;

    const robotsUrl = `${this.baseUrl}/robots.txt`;

    try {
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const text = await response.text();
        this.robotsTxt = robotsParser(robotsUrl, text);
        this.logger.debug({ robotsUrl }, 'robots.txt fetched');
      } else {
        // Non-200 means no restrictions (treat as allow-all)
        this.logger.debug({ robotsUrl, status: response.status }, 'robots.txt not found, allowing all');
      }
    } catch (err) {
      this.logger.warn({ err, robotsUrl }, 'Failed to fetch robots.txt — assuming allow all');
    } finally {
      this.robotsTxtFetched = true;
    }
  }

  /**
   * Returns true if the given path is allowed by robots.txt for this crawler's User-Agent.
   */
  protected async canFetch(path: string): Promise<boolean> {
    await this.fetchRobotsTxt();

    if (!this.robotsTxt) return true; // No robots.txt = allow all

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    return this.robotsTxt.isAllowed(url, this.userAgent) !== false;
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------

  /**
   * Fetches a URL with the configured delay applied before the request.
   */
  protected async fetchWithDelay(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    await this.sleep(this.delayMs);
    return this.fetchWithRetry(url, options);
  }

  /**
   * Fetches a URL with exponential backoff retry on failure.
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    attempt = 1,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json, text/html, */*',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500 && attempt < this.maxRetries) {
        this.logger.warn(
          { url, status: response.status, attempt },
          'Server error, retrying...',
        );
        await this.sleep(this.delayMs * Math.pow(2, attempt));
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      return response;
    } catch (err) {
      if (attempt < this.maxRetries) {
        const backoffMs = this.delayMs * Math.pow(2, attempt);
        this.logger.warn(
          { url, err, attempt, backoffMs },
          'Request failed, retrying with backoff...',
        );
        await this.sleep(backoffMs);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      this.logger.error({ url, err, attempt }, 'Request failed after all retries');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Deduplication
  // ---------------------------------------------------------------------------

  /**
   * Returns true if a signal with the given sourceId already exists in the database.
   */
  protected async isDuplicate(sourceId: string): Promise<boolean> {
    const existing = await prisma.rawSignal.findUnique({
      where: { sourceId },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Saves a signal to the database if it is not a duplicate.
   * Returns true if the signal was saved, false if it was a duplicate.
   */
  protected async saveSignal(signal: RawSignal): Promise<boolean> {
    const duplicate = await this.isDuplicate(signal.sourceId);
    if (duplicate) return false;

    await prisma.rawSignal.create({
      data: {
        sourceId: signal.sourceId,
        source: signal.source,
        url: signal.url,
        title: signal.title,
        body: signal.body.slice(0, 50_000), // Cap body size
        author: signal.author,
        score: signal.score,
        commentCount: signal.commentCount,
        publishedAt: signal.publishedAt,
        crawledAt: signal.crawledAt,
        metadata: signal.metadata as Record<string, never>,
      },
    });

    return true;
  }

  /**
   * Batch-saves signals, skipping duplicates.
   * Returns the count of newly saved signals.
   */
  protected async saveSignals(signals: RawSignal[]): Promise<number> {
    let newCount = 0;

    for (const signal of signals) {
      const saved = await this.saveSignal(signal);
      if (saved) newCount++;
    }

    return newCount;
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convenience wrapper: sleep for the configured inter-request delay.
   * Adds ±20% jitter to avoid thundering-herd patterns.
   */
  protected delay(): Promise<void> {
    const jitter = Math.floor(this.delayMs * 0.2 * (Math.random() - 0.5));
    return this.sleep(Math.max(0, this.delayMs + jitter));
  }

  /** Truncates a string to maxLength characters, appending "..." if truncated */
  protected truncate(text: string, maxLength = 10_000): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /** Strips HTML tags from a string */
  protected stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
