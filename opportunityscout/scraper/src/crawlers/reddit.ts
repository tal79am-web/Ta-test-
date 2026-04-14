import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface RedditToken {
  access_token: string;
  expires_at: number;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  link_flair_text: string | null;
  subreddit: string;
}

/**
 * Reddit Crawler
 *
 * Crawls configurable subreddits for posts that signal market gaps, pain points,
 * and feature requests. Uses the official Reddit OAuth API.
 *
 * Required env vars:
 *   REDDIT_CLIENT_ID
 *   REDDIT_CLIENT_SECRET
 *   REDDIT_USER_AGENT
 *
 * Optional env vars:
 *   REDDIT_SUBREDDITS (comma-separated, default: entrepreneur,startups,SaaS,...)
 *   REDDIT_MAX_POSTS  (default: 100)
 */
export class RedditCrawler extends BaseCrawler {
  readonly name = 'reddit';
  readonly baseUrl = 'https://www.reddit.com';

  private token: RedditToken | null = null;

  private readonly subreddits: string[];
  private readonly maxPosts: number;

  constructor(options: CrawlerOptions = {}) {
    super(options);

    this.subreddits = (
      process.env['REDDIT_SUBREDDITS'] ??
      'entrepreneur,startups,SaaS,smallbusiness,marketing,webdev,programming,indiehackers'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.maxPosts = parseInt(process.env['REDDIT_MAX_POSTS'] ?? '100', 10);
  }

  async crawl(): Promise<RawSignal[]> {
    const clientId = process.env['REDDIT_CLIENT_ID'];
    const clientSecret = process.env['REDDIT_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      this.logger.warn('REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not set — skipping Reddit crawl');
      return [];
    }

    await this.authenticate(clientId, clientSecret);

    const signals: RawSignal[] = [];

    for (const subreddit of this.subreddits) {
      try {
        this.logger.info({ subreddit }, 'Crawling subreddit');
        const subredditSignals = await this.crawlSubreddit(subreddit);
        signals.push(...subredditSignals);
        this.logger.info({ subreddit, count: subredditSignals.length }, 'Subreddit crawled');
      } catch (err) {
        this.logger.error({ subreddit, err }, 'Failed to crawl subreddit');
      }
    }

    this.logger.info({ total: signals.length }, 'Reddit crawl complete');
    return signals;
  }

  private async authenticate(clientId: string, clientSecret: string): Promise<void> {
    // Return cached token if still valid (with 60s buffer)
    if (this.token && this.token.expires_at > Date.now() + 60_000) {
      return;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const userAgent = process.env['REDDIT_USER_AGENT'] ?? 'OpportunityScout/1.0';

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Reddit authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.token = {
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    this.logger.debug('Reddit OAuth token obtained');
  }

  private async crawlSubreddit(subreddit: string): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    let after: string | null = null;
    let fetched = 0;

    while (fetched < this.maxPosts) {
      const limit = Math.min(100, this.maxPosts - fetched);
      const url = new URL(`https://oauth.reddit.com/r/${subreddit}/hot.json`);
      url.searchParams.set('limit', String(limit));
      if (after) url.searchParams.set('after', after);

      const response = await this.fetchWithDelay(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.token?.access_token}`,
          'User-Agent': process.env['REDDIT_USER_AGENT'] ?? 'OpportunityScout/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          this.logger.warn({ subreddit }, 'Rate limited by Reddit, backing off');
          await this.sleep(60_000);
          continue;
        }
        throw new Error(`Reddit API error: ${response.status} for r/${subreddit}`);
      }

      const json = (await response.json()) as {
        data: {
          children: Array<{ data: RedditPost }>;
          after: string | null;
        };
      };

      const posts = json.data.children.map((c) => c.data);

      for (const post of posts) {
        // Skip posts with no self-text (link posts without discussion)
        if (!post.selftext || post.selftext.trim().length < 50) continue;
        // Skip deleted/removed posts
        if (post.selftext === '[deleted]' || post.selftext === '[removed]') continue;

        const sourceId = `reddit-${post.id}`;

        // Dedup check
        if (await this.isDuplicate(sourceId)) continue;

        signals.push({
          sourceId,
          source: 'reddit',
          url: `https://www.reddit.com${post.permalink}`,
          title: post.title,
          body: this.truncate(post.selftext),
          author: post.author,
          score: post.score,
          commentCount: post.num_comments,
          publishedAt: new Date(post.created_utc * 1000),
          crawledAt: new Date(),
          metadata: {
            subreddit: post.subreddit,
            flair: post.link_flair_text,
          },
        });

        fetched++;
      }

      after = json.data.after;
      if (!after || posts.length === 0) break;
    }

    return signals;
  }
}
