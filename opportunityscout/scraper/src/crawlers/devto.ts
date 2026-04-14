import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  body_markdown?: string;
  url: string;
  canonical_url: string;
  user: { username: string; name: string };
  positive_reactions_count: number;
  comments_count: number;
  published_at: string;
  tag_list: string[];
  reading_time_minutes: number;
}

/**
 * Dev.to Crawler
 *
 * Fetches high-engagement articles that describe developer pain points.
 *
 * Target categories:
 * - "I built X because Y didn't exist" (market gap signals)
 * - "Why I switched from X to Y" (pain points with X)
 * - "The problem with X" (identified pain points)
 * - Tutorial articles on workarounds (implies missing native functionality)
 *
 * Uses the public Dev.to API — no authentication required.
 */
export class DevToCrawler extends BaseCrawler {
  readonly name = 'devto';
  readonly baseUrl = 'https://dev.to';

  private readonly targetTags = [
    'devtools',
    'saas',
    'startup',
    'productivity',
    'automation',
    'tooling',
    'dx',
    'buildinpublic',
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
  }

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const tag of this.targetTags) {
      try {
        const tagSignals = await this.fetchArticlesForTag(tag);
        signals.push(...tagSignals);
        this.logger.info({ tag, count: tagSignals.length }, 'Dev.to tag crawled');
      } catch (err) {
        this.logger.error({ tag, err }, 'Failed to crawl Dev.to tag');
      }
    }

    this.logger.info({ total: signals.length }, 'Dev.to crawl complete');
    return signals;
  }

  private async fetchArticlesForTag(tag: string): Promise<RawSignal[]> {
    const url = `https://dev.to/api/articles?tag=${tag}&per_page=30&top=7`;

    const response = await this.fetchWithDelay(url, {
      headers: {
        Accept: 'application/vnd.forem.api-v1+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dev.to API error: ${response.status} for tag ${tag}`);
    }

    const articles = (await response.json()) as DevToArticle[];
    const signals: RawSignal[] = [];

    for (const article of articles) {
      // Filter for high-engagement articles
      if (article.positive_reactions_count < 20) continue;

      // Filter for pain-point / market-gap signals in title
      if (!this.isPainPointArticle(article.title)) continue;

      const sourceId = `devto-${article.id}`;
      if (await this.isDuplicate(sourceId)) continue;

      const body = article.description || '';
      if (body.length < 30) continue;

      signals.push({
        sourceId,
        source: 'devto',
        url: article.canonical_url || article.url,
        title: article.title,
        body: this.truncate(body),
        author: article.user.username,
        score: article.positive_reactions_count,
        commentCount: article.comments_count,
        publishedAt: new Date(article.published_at),
        crawledAt: new Date(),
        metadata: {
          tags: article.tag_list,
          readingTimeMinutes: article.reading_time_minutes,
        },
      });
    }

    return signals;
  }

  /**
   * Heuristically identifies articles that are likely to contain
   * pain points or market gap signals based on their title patterns.
   */
  private isPainPointArticle(title: string): boolean {
    const lower = title.toLowerCase();
    const patterns = [
      'i built',
      'i created',
      'why i switched',
      'the problem with',
      'why x doesn',
      "doesn't work",
      'pain point',
      'frustrated',
      'annoyed',
      'wish there was',
      'missing feature',
      'alternative to',
      'replacing',
      'instead of',
      'why we moved',
      'why we left',
      'open source alternative',
      'i was tired',
      'sick of',
    ];

    return patterns.some((p) => lower.includes(p));
  }
}
