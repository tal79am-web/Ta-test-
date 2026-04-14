import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

/**
 * Crunchbase / TechCrunch RSS Crawler
 *
 * Monitors funding-round announcements and tech-news RSS feeds to surface:
 *  - Validated demand signals (funded companies = real problems people pay to solve)
 *  - Competitor gaps (what funded companies' rivals are NOT doing)
 *  - Emerging categories getting capital
 *
 * Data sources (all public RSS/Atom feeds — no auth required):
 *  - TechCrunch RSS (general + category feeds)
 *  - VentureBeat RSS
 *  - SiliconANGLE RSS
 *  - The Information (headlines only)
 *  - Mattermark / Crunchbase Daily newsletter RSS
 *
 * Optional env vars:
 *   CRUNCHBASE_MAX_ITEMS   (default: 50 per feed)
 *   CRUNCHBASE_LOOKBACK_HOURS (default: 48)
 */
export class CrunchbaseCrawler extends BaseCrawler {
  readonly name = 'crunchbase';
  readonly baseUrl = 'https://techcrunch.com';

  private readonly maxItems: number;
  private readonly lookbackHours: number;

  /** Public RSS feeds to monitor for funding and market signals */
  private static readonly RSS_FEEDS: Array<{ label: string; url: string; category: string }> = [
    {
      label: 'TechCrunch Main',
      url: 'https://techcrunch.com/feed/',
      category: 'news',
    },
    {
      label: 'TechCrunch Startups',
      url: 'https://techcrunch.com/category/startups/feed/',
      category: 'startups',
    },
    {
      label: 'TechCrunch AI',
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
      category: 'ai',
    },
    {
      label: 'TechCrunch Venture',
      url: 'https://techcrunch.com/category/venture/feed/',
      category: 'funding',
    },
    {
      label: 'VentureBeat',
      url: 'https://venturebeat.com/feed/',
      category: 'news',
    },
    {
      label: 'VentureBeat AI',
      url: 'https://venturebeat.com/category/ai/feed/',
      category: 'ai',
    },
    {
      label: 'SiliconANGLE',
      url: 'https://siliconangle.com/feed/',
      category: 'news',
    },
    {
      label: 'Product Hunt Blog',
      url: 'https://blog.producthunt.com/feed',
      category: 'products',
    },
    {
      label: 'Hacker News - Funding',
      url: 'https://hnrss.org/newest?q=funding+raised+seed+series&points=50',
      category: 'funding',
    },
    {
      label: 'Hacker News - Launch',
      url: 'https://hnrss.org/newest?q=launch+YC+startup&points=100',
      category: 'startups',
    },
  ];

  /** Patterns that indicate a funding-round or market-gap article */
  private static readonly SIGNAL_PATTERNS = [
    /raises?|raised|funding|seed|series [a-z]/i,
    /\$\d+(?:\.\d+)?\s*(?:million|billion|M|B)/i,
    /backed by|led by|invested in/i,
    /gap in the market|unmet need|underserved/i,
    /no (?:good |existing )?(?:tool|solution|software)/i,
    /problem with|pain point|challenge for/i,
    /disrupts?|replaces?|alternative to/i,
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
    this.maxItems = parseInt(process.env['CRUNCHBASE_MAX_ITEMS'] ?? '50', 10);
    this.lookbackHours = parseInt(process.env['CRUNCHBASE_LOOKBACK_HOURS'] ?? '48', 10);
  }

  /**
   * Crawl all configured RSS feeds and return opportunity signals.
   */
  async crawl(): Promise<RawSignal[]> {
    const cutoff = new Date(Date.now() - this.lookbackHours * 60 * 60 * 1000);
    const allSignals: RawSignal[] = [];

    for (const feed of CrunchbaseCrawler.RSS_FEEDS) {
      await this.delay();
      try {
        const items = await this.fetchRssFeed(feed.url);
        const filtered = items
          .filter((item) => {
            if (!item.pubDate) return true;
            return new Date(item.pubDate) >= cutoff;
          })
          .slice(0, this.maxItems);

        for (const item of filtered) {
          const sourceId = `crunchbase-${this.hashString(item.link ?? item.title)}`;
          const isDuplicate = await this.isDuplicate(sourceId);
          if (isDuplicate) continue;

          // Only keep items that match signal patterns (unless it's a direct funding feed)
          const fullText = `${item.title} ${item.description ?? ''}`;
          const isRelevant =
            feed.category === 'funding' ||
            CrunchbaseCrawler.SIGNAL_PATTERNS.some((re) => re.test(fullText));

          if (!isRelevant) continue;

          allSignals.push({
            sourceId,
            source: 'crunchbase',
            url: item.link ?? feed.url,
            title: item.title,
            body: item.description ? this.stripHtml(item.description) : item.title,
            author: item.author ?? feed.label,
            score: 0,
            commentCount: 0,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            crawledAt: new Date(),
            metadata: {
              feedLabel: feed.label,
              feedCategory: feed.category,
              feedUrl: feed.url,
            },
          });
        }

        this.logger.debug(
          { feed: feed.label, found: filtered.length },
          'RSS feed processed',
        );
      } catch (err) {
        this.logger.error({ err, feed: feed.label }, 'Failed to fetch RSS feed');
      }
    }

    this.logger.info({ total: allSignals.length }, 'Crunchbase/TechCrunch crawl complete');
    return allSignals;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch and parse an RSS/Atom feed using the built-in DOMParser (Node 22+)
   * or a lightweight regex fallback.
   */
  private async fetchRssFeed(url: string): Promise<RssItem[]> {
    const response = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      this.logger.warn({ url, status: response.status }, 'RSS feed returned non-200');
      return [];
    }

    const xml = await response.text();
    return this.parseRssXml(xml);
  }

  /**
   * Minimal RSS/Atom XML parser using regex.
   * Handles both <item> (RSS) and <entry> (Atom) elements.
   */
  private parseRssXml(xml: string): RssItem[] {
    const items: RssItem[] = [];

    // Support both RSS <item> and Atom <entry>
    const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1] ?? '';

      const title = this.extractXmlTag(block, 'title');
      const link =
        this.extractXmlTag(block, 'link') ??
        this.extractAttrFromTag(block, 'link', 'href');
      const description =
        this.extractXmlTag(block, 'description') ??
        this.extractXmlTag(block, 'summary') ??
        this.extractXmlTag(block, 'content:encoded');
      const pubDate =
        this.extractXmlTag(block, 'pubDate') ??
        this.extractXmlTag(block, 'published') ??
        this.extractXmlTag(block, 'updated');
      const author =
        this.extractXmlTag(block, 'author') ??
        this.extractXmlTag(block, 'dc:creator');

      if (!title) continue;

      items.push({ title, link, description, pubDate, author });
    }

    return items;
  }

  /** Extract the text content of the first matching XML tag. */
  private extractXmlTag(xml: string, tag: string): string | undefined {
    const pattern = new RegExp(
      `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
      'i',
    );
    const m = pattern.exec(xml);
    return m?.[1]?.trim() || undefined;
  }

  /** Extract an attribute value from a self-closing tag like <link href="..."/>. */
  private extractAttrFromTag(xml: string, tag: string, attr: string): string | undefined {
    const pattern = new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`, 'i');
    const m = pattern.exec(xml);
    return m?.[1] || undefined;
  }

  /** Simple non-crypto hash for deduplication IDs. */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

interface RssItem {
  title: string;
  link: string | undefined;
  description: string | undefined;
  pubDate: string | undefined;
  author: string | undefined;
}
