import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface SOQuestion {
  question_id: number;
  title: string;
  body: string;
  link: string;
  owner: { display_name?: string };
  score: number;
  answer_count: number;
  view_count: number;
  creation_date: number;
  tags: string[];
  is_answered: boolean;
  accepted_answer_id?: number;
}

interface SOResponse {
  items: SOQuestion[];
  has_more: boolean;
  quota_remaining: number;
}

/**
 * Stack Overflow Crawler
 *
 * Fetches questions with:
 * - High view counts but NO accepted answer (unanswered pain points)
 * - Tagged with developer-tool-related tags
 * - Recent and highly upvoted
 *
 * Uses the Stack Exchange API v2.3.
 * Optional: STACKOVERFLOW_KEY for higher quota.
 */
export class StackOverflowCrawler extends BaseCrawler {
  readonly name = 'stackoverflow';
  readonly baseUrl = 'https://stackoverflow.com';

  private readonly apiBase = 'https://api.stackexchange.com/2.3';
  private readonly targetTags = [
    'developer-tools',
    'saas',
    'api',
    'automation',
    'workflow',
    'devops',
    'integration',
    'sdk',
    'cli',
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
  }

  async crawl(): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const apiKey = process.env['STACKOVERFLOW_KEY'];

    for (const tag of this.targetTags) {
      try {
        const tagSignals = await this.fetchQuestionsForTag(tag, apiKey);
        signals.push(...tagSignals);
        this.logger.info({ tag, count: tagSignals.length }, 'SO tag crawled');
      } catch (err) {
        this.logger.error({ tag, err }, 'Failed to crawl SO tag');
      }
    }

    this.logger.info({ total: signals.length }, 'Stack Overflow crawl complete');
    return signals;
  }

  private async fetchQuestionsForTag(
    tag: string,
    apiKey: string | undefined,
  ): Promise<RawSignal[]> {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'votes',
      tagged: tag,
      site: 'stackoverflow',
      filter: 'withbody',
      pagesize: '20',
      // No accepted answer = unanswered need
      answers: '0',
    });

    if (apiKey) params.set('key', apiKey);

    const url = `${this.apiBase}/questions?${params.toString()}`;
    const response = await this.fetchWithDelay(url);

    if (!response.ok) {
      throw new Error(`SO API error: ${response.status} for tag ${tag}`);
    }

    const json = (await response.json()) as SOResponse;

    if (json.quota_remaining < 10) {
      this.logger.warn({ quota: json.quota_remaining }, 'SO API quota nearly exhausted');
    }

    const signals: RawSignal[] = [];

    for (const question of json.items) {
      // Only high-view questions signal real demand
      if (question.view_count < 500) continue;

      const sourceId = `so-${question.question_id}`;
      if (await this.isDuplicate(sourceId)) continue;

      const body = question.body
        ? this.truncate(this.stripHtml(question.body))
        : '';

      if (body.length < 50) continue;

      signals.push({
        sourceId,
        source: 'stackoverflow',
        url: question.link,
        title: question.title,
        body,
        author: question.owner.display_name,
        score: question.score,
        commentCount: question.answer_count,
        publishedAt: new Date(question.creation_date * 1000),
        crawledAt: new Date(),
        metadata: {
          viewCount: question.view_count,
          isAnswered: question.is_answered,
          hasAcceptedAnswer: !!question.accepted_answer_id,
          tags: question.tags,
        },
      });
    }

    return signals;
  }
}
