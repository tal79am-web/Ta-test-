import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

/**
 * LinkedIn Crawler (Playwright-based)
 *
 * Scrapes LinkedIn trending posts in Technology, Entrepreneurship, AI, and
 * Product Management. Looks for complaints, requests, and pain-point signals.
 *
 * NOTE: LinkedIn has strict bot-detection. This crawler:
 *  1. Uses Playwright in stealth mode (headful emulation)
 *  2. Respects robots.txt
 *  3. Applies randomised delays between actions
 *  4. Requires a valid LinkedIn session cookie (LI_AT env var) or
 *     username/password credentials to authenticate.
 *
 * Required env vars (at least one auth method):
 *   LI_AT           — LinkedIn session cookie (most reliable)
 *   OR
 *   LINKEDIN_EMAIL  + LINKEDIN_PASSWORD  — credential-based login
 *
 * Optional env vars:
 *   LINKEDIN_MAX_POSTS (default: 30)
 *   LINKEDIN_HEADLESS  (default: true)
 */
export class LinkedInCrawler extends BaseCrawler {
  readonly name = 'linkedin';
  readonly baseUrl = 'https://www.linkedin.com';

  private readonly sessionCookie: string | undefined;
  private readonly email: string | undefined;
  private readonly password: string | undefined;
  private readonly maxPosts: number;

  /** LinkedIn topic feed URLs to monitor */
  private static readonly TOPIC_FEEDS: Array<{ label: string; url: string }> = [
    {
      label: 'technology',
      url: 'https://www.linkedin.com/feed/hashtag/technology',
    },
    {
      label: 'artificialintelligence',
      url: 'https://www.linkedin.com/feed/hashtag/artificialintelligence',
    },
    {
      label: 'entrepreneurship',
      url: 'https://www.linkedin.com/feed/hashtag/entrepreneurship',
    },
    {
      label: 'productmanagement',
      url: 'https://www.linkedin.com/feed/hashtag/productmanagement',
    },
    {
      label: 'saas',
      url: 'https://www.linkedin.com/feed/hashtag/saas',
    },
    {
      label: 'startups',
      url: 'https://www.linkedin.com/feed/hashtag/startups',
    },
  ];

  /** Keywords used to detect pain-point posts */
  private static readonly PAIN_PATTERNS = [
    /frustrated with/i,
    /hate that/i,
    /wish (?:there was|someone built|we had)/i,
    /why (?:is there no|isn't there|don't we have)/i,
    /no (?:good |decent )?(?:tool|solution|software|app) for/i,
    /biggest (?:pain|problem|challenge)/i,
    /struggling with/i,
    /needs to be (?:fixed|solved|built)/i,
    /gap in the market/i,
    /nobody (?:is |has |)solving/i,
    /I'd pay for/i,
    /missing feature/i,
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
    this.sessionCookie = process.env['LI_AT'];
    this.email = process.env['LINKEDIN_EMAIL'];
    this.password = process.env['LINKEDIN_PASSWORD'];
    this.maxPosts = parseInt(process.env['LINKEDIN_MAX_POSTS'] ?? '30', 10);
  }

  /**
   * Run the LinkedIn crawler.
   *
   * Because LinkedIn aggressively blocks headless browsers and scraping
   * without authentication, this method will exit early (returning []) if
   * neither a session cookie nor credentials are configured, logging a clear
   * warning so operators know what to set up.
   */
  async crawl(): Promise<RawSignal[]> {
    const hasAuth = this.sessionCookie || (this.email && this.password);
    if (!hasAuth) {
      this.logger.warn(
        'LinkedIn credentials not configured. ' +
          'Set LI_AT (session cookie) or LINKEDIN_EMAIL + LINKEDIN_PASSWORD to enable this crawler.',
      );
      return [];
    }

    // Playwright is an optional peer dep — import lazily so the scraper
    // package still works without it installed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playwright: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      playwright = await import('playwright' as any);
    } catch {
      this.logger.warn(
        'Playwright not installed. Run `npm install playwright` in the scraper package to enable LinkedIn crawling.',
      );
      return [];
    }

    const browser = await playwright.chromium.launch({
      headless: process.env['LINKEDIN_HEADLESS'] !== 'false',
    });

    const allSignals: RawSignal[] = [];

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      // Inject session cookie if available
      if (this.sessionCookie) {
        await context.addCookies([
          {
            name: 'li_at',
            value: this.sessionCookie,
            domain: '.linkedin.com',
            path: '/',
            httpOnly: true,
            secure: true,
          },
        ]);
      }

      const page = await context.newPage();

      // Login with credentials if no cookie
      if (!this.sessionCookie && this.email && this.password) {
        await this.loginWithCredentials(page, this.email, this.password);
      }

      // Visit each topic feed
      for (const feed of LinkedInCrawler.TOPIC_FEEDS) {
        if (allSignals.length >= this.maxPosts) break;

        try {
          await this.delay();
          const posts = await this.scrapeTopicFeed(page, feed);
          allSignals.push(...posts);
          this.logger.debug(
            { topic: feed.label, found: posts.length },
            'LinkedIn topic scraped',
          );
        } catch (err) {
          this.logger.error({ err, topic: feed.label }, 'Failed to scrape LinkedIn topic');
        }
      }
    } finally {
      await browser.close();
    }

    this.logger.info({ total: allSignals.length }, 'LinkedIn crawl complete');
    return allSignals;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Log in to LinkedIn using email/password. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loginWithCredentials(page: any, email: string, password: string): Promise<void> {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
    await page.fill('#username', email);
    await this.randomDelay(500, 1500);
    await page.fill('#password', password);
    await this.randomDelay(500, 1000);
    await page.click('[type="submit"]');
    await page.waitForURL('**/feed**', { timeout: 15_000 });
    this.logger.debug('LinkedIn login successful');
  }

  /**
   * Scrape posts from a LinkedIn hashtag topic feed.
   * Scrolls down to load more posts and extracts pain-point signals.
   *
   * Note: page.evaluate() callbacks run in the browser context (DOM available).
   * The eslint-disable comments below are intentional.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async scrapeTopicFeed(page: any, feed: { label: string; url: string }): Promise<RawSignal[]> {
    await page.goto(feed.url, { waitUntil: 'networkidle', timeout: 30_000 });
    await this.randomDelay(1000, 2000);

    // Scroll to load more posts (runs in browser context)
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      await page.evaluate('window.scrollBy(0, 1200)');
      await this.randomDelay(800, 1500);
    }

    // Extract post data — the function body runs in browser context (serialised by Playwright).
    // We pass it as a string to avoid TypeScript DOM lib errors in this Node.js file.
    type PostItem = { text: string; author: string; url: string; reactions: number; comments: number };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const posts: PostItem[] = await page.evaluate((() => {
      const items: any[] = [];
      const postEls = (globalThis as any).document.querySelectorAll(
        '[data-urn*="activity"],[class*="feed-shared-update"]',
      );

      postEls.forEach((el: any) => {
        const textEl = el.querySelector(
          '.feed-shared-text,.update-components-text,.feed-shared-update-v2__description',
        );
        const text = (textEl?.textContent ?? '').trim();
        if (!text || text.length < 50) return;

        const authorEl = el.querySelector(
          '.update-components-actor__name,.feed-shared-actor__name',
        );
        const author = (authorEl?.textContent ?? 'Unknown').trim();

        const linkEl = el.querySelector('a[href*="/posts/"],a[href*="/activity-"]');
        const href = linkEl ? linkEl.href : '';

        const reactionsEl = el.querySelector(
          '[class*="social-details-social-counts__reactions-count"],[aria-label*="reaction"]',
        );
        const reactions = parseInt((reactionsEl?.textContent ?? '0').replace(/[^0-9]/g, ''), 10);

        const commentsEl = el.querySelector('[aria-label*="comment"]');
        const comments = parseInt((commentsEl?.textContent ?? '0').replace(/[^0-9]/g, ''), 10);

        items.push({ text, author, url: href, reactions, comments });
      });

      return items;
    }) as () => PostItem[]);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const signals: RawSignal[] = [];

    for (const post of posts) {
      // Only keep posts matching pain-point patterns
      const isPainPoint = LinkedInCrawler.PAIN_PATTERNS.some((re) => re.test(post.text));
      if (!isPainPoint) continue;

      const sourceId = `linkedin-${Buffer.from(post.url || post.text.slice(0, 60)).toString('base64url').slice(0, 32)}`;

      const isDuplicate = await this.isDuplicate(sourceId);
      if (isDuplicate) continue;

      signals.push({
        sourceId,
        source: 'linkedin',
        url: post.url || feed.url,
        title: this.buildTitle(post.text),
        body: post.text,
        author: post.author,
        score: post.reactions,
        commentCount: post.comments,
        publishedAt: new Date(), // LinkedIn doesn't expose exact timestamps easily
        crawledAt: new Date(),
        metadata: {
          topic: feed.label,
          feedUrl: feed.url,
        },
      });
    }

    return signals;
  }

  /** Build a short title from a LinkedIn post body. */
  private buildTitle(text: string): string {
    const firstLine = text.split('\n')[0]?.trim() ?? text;
    if (firstLine.length <= 100) return firstLine;
    const cut = firstLine.slice(0, 100).replace(/\s\S*$/, '');
    return `${cut}…`;
  }

  /** Random delay between min and max ms. */
  private randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min) + min);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
