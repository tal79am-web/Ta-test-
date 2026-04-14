import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

/**
 * Twitter/X Crawler
 *
 * Searches Twitter API v2 for pain-point and opportunity signals using
 * a curated set of query operators.
 *
 * Required env vars:
 *   TWITTER_BEARER_TOKEN
 *
 * Optional env vars:
 *   TWITTER_MAX_RESULTS  (default: 100, max: 100 per request)
 *   TWITTER_LOOKBACK_HOURS (default: 24)
 *
 * Falls back to an empty result set (with a warning) if credentials are missing.
 */
export class TwitterCrawler extends BaseCrawler {
  readonly name = 'twitter';
  readonly baseUrl = 'https://api.twitter.com';

  private readonly bearerToken: string | undefined;
  private readonly maxResults: number;
  private readonly lookbackHours: number;

  /** Pain-point oriented search queries sent to Twitter v2 recent-search */
  private static readonly SEARCH_QUERIES: string[] = [
    '"frustrated with" (SaaS OR software OR app OR tool) -is:retweet lang:en',
    '"why does no tool" -is:retweet lang:en',
    '"I\'d pay for" (app OR tool OR software OR AI) -is:retweet lang:en',
    '"there\'s no good solution" -is:retweet lang:en',
    '"wish someone built" -is:retweet lang:en',
    '"why isn\'t there" (app OR tool OR software) -is:retweet lang:en',
    '#buildinpublic (pain OR problem OR gap OR need) -is:retweet lang:en',
    '#indiemaker (need OR problem OR gap OR build) -is:retweet lang:en',
    '"would pay" (automation OR AI OR tool OR app) -is:retweet lang:en',
    '"no good tool" OR "no good app" OR "no tool for" -is:retweet lang:en',
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
    this.bearerToken = process.env['TWITTER_BEARER_TOKEN'];
    this.maxResults = Math.min(
      parseInt(process.env['TWITTER_MAX_RESULTS'] ?? '100', 10),
      100,
    );
    this.lookbackHours = parseInt(process.env['TWITTER_LOOKBACK_HOURS'] ?? '24', 10);
  }

  /**
   * Run the Twitter crawler.
   *
   * Iterates over each search query, fetches recent tweets via the v2 API,
   * deduplicates, and returns normalised RawSignal objects.
   */
  async crawl(): Promise<RawSignal[]> {
    if (!this.bearerToken) {
      this.logger.warn(
        'TWITTER_BEARER_TOKEN not set — skipping Twitter crawler. ' +
          'Set the env var and restart to enable.',
      );
      return [];
    }

    const startTime = new Date(Date.now() - this.lookbackHours * 60 * 60 * 1000).toISOString();
    const allSignals: RawSignal[] = [];
    const seenIds = new Set<string>();

    for (const query of TwitterCrawler.SEARCH_QUERIES) {
      await this.delay();

      try {
        const tweets = await this.searchRecent(query, startTime);
        for (const tweet of tweets) {
          if (seenIds.has(tweet.id)) continue;
          seenIds.add(tweet.id);

          const signal = this.tweetToSignal(tweet);
          const isDuplicate = await this.isDuplicate(signal.sourceId);
          if (!isDuplicate) {
            allSignals.push(signal);
          }
        }
        this.logger.debug({ query, found: tweets.length }, 'Twitter query complete');
      } catch (err) {
        this.logger.error({ err, query }, 'Twitter query failed');
      }
    }

    this.logger.info({ total: allSignals.length }, 'Twitter crawl complete');
    return allSignals;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Calls the Twitter v2 recent-search endpoint.
   */
  private async searchRecent(query: string, startTime: string): Promise<TwitterTweet[]> {
    const params = new URLSearchParams({
      query,
      max_results: String(this.maxResults),
      start_time: startTime,
      'tweet.fields': 'created_at,author_id,public_metrics,entities,lang',
      expansions: 'author_id',
      'user.fields': 'username,name',
    });

    const url = `${this.baseUrl}/2/tweets/search/recent?${params.toString()}`;

    const response = await this.fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (response.status === 429) {
      const resetAt = response.headers.get('x-rate-limit-reset');
      const waitMs = resetAt
        ? (parseInt(resetAt, 10) * 1000 - Date.now()) + 1000
        : 60_000;
      this.logger.warn({ waitMs }, 'Twitter rate limit hit — waiting');
      await this.sleep(Math.min(waitMs, 300_000)); // cap at 5 min
      return [];
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn({ status: response.status, body }, 'Twitter search returned non-200');
      return [];
    }

    const data = (await response.json()) as TwitterSearchResponse;
    const usersMap = new Map<string, { username: string; name: string }>();

    for (const user of data.includes?.users ?? []) {
      usersMap.set(user.id, { username: user.username, name: user.name });
    }

    return (data.data ?? []).map((t) => ({
      ...t,
      authorUsername: usersMap.get(t.author_id)?.username ?? t.author_id,
    }));
  }

  /**
   * Converts a raw Twitter API tweet into an OpportunityScout RawSignal.
   */
  private tweetToSignal(tweet: TwitterTweet): RawSignal {
    const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;

    return {
      sourceId: `twitter-${tweet.id}`,
      source: 'twitter',
      url: tweetUrl,
      title: this.buildTitle(tweet.text),
      body: tweet.text,
      author: tweet.authorUsername ?? tweet.author_id,
      score: tweet.public_metrics?.like_count ?? 0,
      commentCount: tweet.public_metrics?.reply_count ?? 0,
      publishedAt: new Date(tweet.created_at),
      crawledAt: new Date(),
      metadata: {
        retweetCount: tweet.public_metrics?.retweet_count ?? 0,
        quoteCount: tweet.public_metrics?.quote_count ?? 0,
        impressionCount: tweet.public_metrics?.impression_count ?? 0,
        tweetId: tweet.id,
        lang: tweet.lang ?? 'en',
      },
    };
  }

  /**
   * Derives a short title from the tweet body (first ~80 chars, trimmed at a word boundary).
   */
  private buildTitle(text: string): string {
    const clean = text.replace(/https?:\/\/\S+/g, '').trim();
    if (clean.length <= 80) return clean;
    const cut = clean.slice(0, 80).replace(/\s\S*$/, '');
    return `${cut}…`;
  }

}

// ---------------------------------------------------------------------------
// Twitter API Types
// ---------------------------------------------------------------------------

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  authorUsername?: string;
  created_at: string;
  lang?: string;
  public_metrics?: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
    quote_count: number;
    impression_count?: number;
  };
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
  meta?: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}
