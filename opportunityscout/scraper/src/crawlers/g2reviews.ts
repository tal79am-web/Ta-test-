import * as cheerio from 'cheerio';
import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface G2Review {
  productName: string;
  productUrl: string;
  reviewTitle: string;
  reviewBody: string;
  rating: number;
  reviewerRole: string;
  publishedAt: Date;
  sourceId: string;
}

/**
 * G2 / Capterra Review Crawler
 *
 * Scrapes 1–2 star reviews for popular SaaS tools. These reviews are rich
 * sources of pain points and feature gaps — users explicitly state what
 * is missing or broken.
 *
 * Target products: the top tools in each developer/business category.
 *
 * IMPORTANT: This crawler respects robots.txt and uses polite delays.
 * Only public review pages are scraped (no login required).
 */
export class G2ReviewsCrawler extends BaseCrawler {
  readonly name = 'g2reviews';
  readonly baseUrl = 'https://www.g2.com';

  // Products to monitor — add more slugs here to expand coverage
  private readonly targetProducts = [
    { slug: 'jira', name: 'Jira' },
    { slug: 'slack', name: 'Slack' },
    { slug: 'asana', name: 'Asana' },
    { slug: 'notion', name: 'Notion' },
    { slug: 'figma', name: 'Figma' },
    { slug: 'linear', name: 'Linear' },
    { slug: 'github', name: 'GitHub' },
  ];

  constructor(options: CrawlerOptions = {}) {
    // Use a longer delay for web scraping to be respectful
    super({ ...options, delayMs: options.delayMs ?? 3000 });
  }

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const product of this.targetProducts) {
      const canCrawl = await this.canFetch(`/products/${product.slug}/reviews`);
      if (!canCrawl) {
        this.logger.info({ product: product.slug }, 'robots.txt disallows — skipping');
        continue;
      }

      try {
        const reviews = await this.crawlProductReviews(product);
        const productSignals = reviews.map((r) => this.reviewToSignal(r));
        signals.push(...productSignals);
        this.logger.info(
          { product: product.name, count: productSignals.length },
          'G2 product reviews crawled',
        );
      } catch (err) {
        this.logger.error({ product: product.name, err }, 'Failed to crawl G2 product');
      }
    }

    this.logger.info({ total: signals.length }, 'G2 crawl complete');
    return signals;
  }

  private async crawlProductReviews(
    product: { slug: string; name: string },
  ): Promise<G2Review[]> {
    const reviews: G2Review[] = [];

    // Fetch 1-2 star reviews (most signal-dense)
    for (const starRating of [1, 2]) {
      const url = `${this.baseUrl}/products/${product.slug}/reviews?filters[star_filter][]=${starRating}&sort=newest`;
      const response = await this.fetchWithDelay(url, {
        headers: {
          Accept: 'text/html',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          { product: product.slug, status: response.status },
          'G2 request failed',
        );
        continue;
      }

      const html = await response.text();
      const parsed = this.parseG2ReviewPage(html, product.name, product.slug, starRating);
      reviews.push(...parsed);
    }

    return reviews;
  }

  private parseG2ReviewPage(
    html: string,
    productName: string,
    productSlug: string,
    starRating: number,
  ): G2Review[] {
    const $ = cheerio.load(html);
    const reviews: G2Review[] = [];

    $('[itemprop="review"]').each((_, el) => {
      try {
        const $el = $(el);
        const reviewTitle = $el.find('[itemprop="name"]').text().trim();
        const reviewBody =
          $el.find('[itemprop="reviewBody"]').text().trim() ||
          $el.find('.review-body').text().trim();
        const reviewerRole = $el.find('.reviewer-role, .c-midnight-80').text().trim();

        // Extract a unique ID from the review element
        const reviewId = $el.attr('data-review-id') ?? $el.attr('id') ?? '';

        if (!reviewTitle || !reviewBody || reviewBody.length < 50) return;

        reviews.push({
          productName,
          productUrl: `${this.baseUrl}/products/${productSlug}/reviews`,
          reviewTitle,
          reviewBody: reviewBody.slice(0, 5000),
          rating: starRating,
          reviewerRole,
          publishedAt: new Date(),
          sourceId: `g2-${productSlug}-${reviewId || Buffer.from(reviewTitle).toString('base64').slice(0, 20)}`,
        });
      } catch {
        // Skip malformed review elements
      }
    });

    return reviews;
  }

  private reviewToSignal(review: G2Review): RawSignal {
    return {
      sourceId: review.sourceId,
      source: 'g2reviews',
      url: review.productUrl,
      title: `${review.rating}★ review of ${review.productName}: ${review.reviewTitle}`,
      body: this.truncate(review.reviewBody),
      author: review.reviewerRole || undefined,
      score: 0,
      commentCount: 0,
      publishedAt: review.publishedAt,
      crawledAt: new Date(),
      metadata: {
        productName: review.productName,
        rating: review.rating,
        reviewerRole: review.reviewerRole,
      },
    };
  }
}
