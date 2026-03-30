import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface HNItem {
  id: number;
  type: 'story' | 'ask' | 'show' | 'job' | 'comment';
  title?: string;
  text?: string;
  by?: string;
  score?: number;
  descendants?: number;
  url?: string;
  time: number;
  kids?: number[];
}

/**
 * Hacker News Crawler
 *
 * Fetches:
 * 1. Ask HN posts (best source of pain points and market gaps)
 * 2. Show HN posts (product launches signal competition / validation)
 * 3. Top stories with high scores
 *
 * Uses the official HN Firebase API — no authentication required.
 */
export class HackerNewsCrawler extends BaseCrawler {
  readonly name = 'hackernews';
  readonly baseUrl = 'https://hacker-news.firebaseio.com';

  private readonly maxStoriesPerFeed = 100;

  constructor(options: CrawlerOptions = {}) {
    super({ ...options, delayMs: options.delayMs ?? 500 });
  }

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Crawl Ask HN, Show HN, and front page in parallel
    const [askIds, showIds, topIds] = await Promise.all([
      this.fetchIds('https://hacker-news.firebaseio.com/v0/askstories.json'),
      this.fetchIds('https://hacker-news.firebaseio.com/v0/showstories.json'),
      this.fetchIds('https://hacker-news.firebaseio.com/v0/topstories.json'),
    ]);

    const allIds = [
      ...askIds.slice(0, 50),
      ...showIds.slice(0, 30),
      ...topIds.slice(0, 20),
    ];

    // Remove duplicates
    const uniqueIds = [...new Set(allIds)];

    this.logger.info({ count: uniqueIds.length }, 'Fetching HN items');

    for (const id of uniqueIds) {
      try {
        const signal = await this.fetchItem(id);
        if (signal) signals.push(signal);
      } catch (err) {
        this.logger.warn({ id, err }, 'Failed to fetch HN item');
      }
    }

    this.logger.info({ total: signals.length }, 'HN crawl complete');
    return signals;
  }

  private async fetchIds(url: string): Promise<number[]> {
    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      this.logger.warn({ url, status: response.status }, 'Failed to fetch HN feed');
      return [];
    }
    const ids = (await response.json()) as number[];
    return ids.slice(0, this.maxStoriesPerFeed);
  }

  private async fetchItem(id: number): Promise<RawSignal | null> {
    const sourceId = `hn-${id}`;

    if (await this.isDuplicate(sourceId)) return null;

    const url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
    const response = await this.fetchWithDelay(url);

    if (!response.ok) return null;

    const item = (await response.json()) as HNItem | null;

    if (!item || !item.title) return null;
    if (item.type === 'job') return null; // Skip job listings

    // Filter for items with enough engagement
    const score = item.score ?? 0;
    const comments = item.descendants ?? 0;

    if (score < 10 && comments < 5) return null;

    const body = item.text ? this.truncate(this.stripHtml(item.text)) : '';

    // For Ask HN and Show HN, skip if no body
    const isAsk = item.title.startsWith('Ask HN:');
    const isShow = item.title.startsWith('Show HN:');
    if ((isAsk || isShow) && body.length < 30) return null;

    return {
      sourceId,
      source: 'hackernews',
      url: item.url ?? `https://news.ycombinator.com/item?id=${id}`,
      title: item.title,
      body,
      author: item.by,
      score,
      commentCount: comments,
      publishedAt: new Date(item.time * 1000),
      crawledAt: new Date(),
      metadata: {
        type: isAsk ? 'ask_hn' : isShow ? 'show_hn' : 'story',
        hn_url: `https://news.ycombinator.com/item?id=${id}`,
        kid_count: item.kids?.length ?? 0,
      },
    };
  }
}
