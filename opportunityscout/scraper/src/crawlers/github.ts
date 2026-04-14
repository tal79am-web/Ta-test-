import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string } | null;
  reactions: { total_count: number };
  comments: number;
  created_at: string;
  labels: Array<{ name: string }>;
  repository_url: string;
}

/**
 * GitHub Crawler
 *
 * Fetches:
 * 1. Trending repositories (signals of community momentum)
 * 2. Issues labeled "feature-request", "enhancement", "help wanted" with many reactions
 *    (explicit signals of missing functionality)
 *
 * Requires: GITHUB_TOKEN (read:public_repo scope)
 */
export class GitHubCrawler extends BaseCrawler {
  readonly name = 'github';
  readonly baseUrl = 'https://github.com';

  private readonly apiBase = 'https://api.github.com';
  private readonly featureLabels = [
    'feature-request',
    'feature request',
    'enhancement',
    'wish',
    'proposal',
  ];

  constructor(options: CrawlerOptions = {}) {
    super(options);
  }

  async crawl(): Promise<RawSignal[]> {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      this.logger.warn('GITHUB_TOKEN not set — skipping GitHub crawl');
      return [];
    }

    const signals: RawSignal[] = [];

    const [trendingSignals, issueSignals] = await Promise.all([
      this.crawlTrending(token),
      this.crawlFeatureRequestIssues(token),
    ]);

    signals.push(...trendingSignals, ...issueSignals);
    this.logger.info({ total: signals.length }, 'GitHub crawl complete');
    return signals;
  }

  private async crawlTrending(token: string): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const url = `${this.apiBase}/search/repositories?q=created:>${dateStr}&sort=stars&order=desc&per_page=30`;

    try {
      const response = await this.fetchWithDelay(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        this.logger.warn({ status: response.status }, 'GitHub trending search failed');
        return [];
      }

      const json = (await response.json()) as { items: GitHubRepo[] };

      for (const repo of json.items) {
        const sourceId = `github-repo-${repo.id}`;
        if (await this.isDuplicate(sourceId)) continue;
        if (!repo.description || repo.description.length < 20) continue;

        signals.push({
          sourceId,
          source: 'github',
          url: repo.html_url,
          title: repo.full_name,
          body: this.truncate(repo.description),
          score: repo.stargazers_count,
          commentCount: repo.open_issues_count,
          publishedAt: new Date(),
          crawledAt: new Date(),
          metadata: {
            type: 'trending_repo',
            language: repo.language,
            topics: repo.topics,
            stars: repo.stargazers_count,
          },
        });
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to crawl GitHub trending');
    }

    return signals;
  }

  private async crawlFeatureRequestIssues(token: string): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    for (const label of this.featureLabels) {
      try {
        const url = `${this.apiBase}/search/issues?q=label:"${encodeURIComponent(label)}"+is:open+reactions:>10&sort=reactions&order=desc&per_page=20`;

        const response = await this.fetchWithDelay(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          this.logger.warn({ label, status: response.status }, 'GitHub issue search failed');
          continue;
        }

        const json = (await response.json()) as { items: GitHubIssue[] };

        for (const issue of json.items) {
          const sourceId = `github-issue-${issue.id}`;
          if (await this.isDuplicate(sourceId)) continue;
          if (!issue.body || issue.body.length < 50) continue;

          signals.push({
            sourceId,
            source: 'github',
            url: issue.html_url,
            title: issue.title,
            body: this.truncate(issue.body),
            author: issue.user?.login,
            score: issue.reactions.total_count,
            commentCount: issue.comments,
            publishedAt: new Date(issue.created_at),
            crawledAt: new Date(),
            metadata: {
              type: 'feature_request_issue',
              labels: issue.labels.map((l) => l.name),
              repositoryUrl: issue.repository_url,
            },
          });
        }
      } catch (err) {
        this.logger.error({ label, err }, 'Failed to fetch GitHub issues for label');
      }
    }

    return signals;
  }
}
