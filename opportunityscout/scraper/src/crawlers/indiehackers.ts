import * as cheerio from 'cheerio';
import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

/**
 * IndieHackers Crawler
 *
 * Targets two high-signal post types:
 * 1. "Looking for co-founder" posts — reveal what founders are building (validates demand)
 * 2. Revenue milestone posts — validate that adjacent markets have paying customers
 * 3. "I'm looking for X" and "How do you solve Y" posts — direct pain points
 *
 * Uses HTML scraping of IndieHackers public pages.
 */
export class IndieHackersCrawler extends BaseCrawler {
  readonly name = 'indiehackers';
  readonly baseUrl = 'https://www.indiehackers.com';

  constructor(options: CrawlerOptions = {}) {
    super({ ...options, delayMs: options.delayMs ?? 2000 });
  }

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    const canCrawl = await this.canFetch('/');
    if (!canCrawl) {
      this.logger.warn('robots.txt disallows IH crawling');
      return [];
    }

    // Target different community sections
    const sections = [
      { path: '/posts/top', label: 'top posts' },
      { path: '/posts?filter=new', label: 'new posts' },
    ];

    for (const section of sections) {
      try {
        const sectionSignals = await this.crawlSection(section.path);
        signals.push(...sectionSignals);
        this.logger.info(
          { section: section.label, count: sectionSignals.length },
          'IH section crawled',
        );
      } catch (err) {
        this.logger.error({ section: section.label, err }, 'Failed to crawl IH section');
      }
    }

    this.logger.info({ total: signals.length }, 'IndieHackers crawl complete');
    return signals;
  }

  private async crawlSection(path: string): Promise<RawSignal[]> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchWithDelay(url, {
      headers: { Accept: 'text/html' },
    });

    if (!response.ok) {
      throw new Error(`IH request failed: ${response.status} for ${path}`);
    }

    const html = await response.text();
    return this.parsePostListPage(html);
  }

  private parsePostListPage(html: string): RawSignal[] {
    const $ = cheerio.load(html);
    const signals: RawSignal[] = [];

    // IndieHackers post items (selector may need updating if site changes)
    const postSelectors = [
      '.post-summary',
      '[class*="post-preview"]',
      '[data-testid="post-item"]',
      'article',
    ];

    let posts = $();
    for (const selector of postSelectors) {
      posts = $(selector);
      if (posts.length > 0) break;
    }

    posts.each((_, el) => {
      try {
        const $post = $(el);
        const titleEl = $post.find('h2, h3, [class*="title"]').first();
        const title = titleEl.text().trim();
        if (!title || title.length < 10) return;

        // Only capture signal-rich post types
        if (!this.isPainPointPost(title)) return;

        const linkEl = $post.find('a[href*="/posts/"]').first();
        const href = linkEl.attr('href') ?? '';
        if (!href) return;

        const postUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const postId = href.split('/posts/')[1]?.split('/')[0] ?? '';
        if (!postId) return;

        const sourceId = `ih-${postId}`;

        const body = $post.find('[class*="preview"], [class*="excerpt"], p').first().text().trim();
        const author = $post.find('[class*="author"], [class*="username"]').first().text().trim();
        const scoreText = $post.find('[class*="vote"], [class*="like"]').first().text().trim();
        const score = parseInt(scoreText.replace(/\D/g, ''), 10) || 0;
        const commentText = $post.find('[class*="comment"]').first().text().trim();
        const comments = parseInt(commentText.replace(/\D/g, ''), 10) || 0;

        signals.push({
          sourceId,
          source: 'indiehackers',
          url: postUrl,
          title,
          body: body ? this.truncate(body) : title,
          author: author || undefined,
          score,
          commentCount: comments,
          publishedAt: new Date(),
          crawledAt: new Date(),
          metadata: {
            type: this.classifyPost(title),
          },
        });
      } catch {
        // Skip malformed posts
      }
    });

    return signals;
  }

  private isPainPointPost(title: string): boolean {
    const lower = title.toLowerCase();
    const patterns = [
      'looking for co-founder',
      'looking for cofound',
      'need a co-founder',
      'how do you',
      'how to deal',
      'struggling with',
      'problem with',
      "can't find",
      'wish there was',
      'anyone else',
      'what do you use for',
      'recommendation for',
      'alternatives to',
      'hit $',
      'reached $',
      'first $',
      'mrr',
      'monthly revenue',
      'pain point',
      'i built',
      'launched',
    ];

    return patterns.some((p) => lower.includes(p));
  }

  private classifyPost(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('co-founder') || lower.includes('cofound')) return 'cofounder_search';
    if (lower.includes('mrr') || lower.includes('revenue') || lower.includes('$')) return 'revenue_milestone';
    if (lower.includes('how') || lower.includes('what do you')) return 'question';
    if (lower.includes('launched') || lower.includes('i built')) return 'launch';
    return 'discussion';
  }
}
