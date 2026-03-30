import { BaseCrawler } from '../base-crawler.js';
import type { RawSignal, CrawlerOptions } from '../types.js';

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  topics: Array<{ name: string }>;
  reviewsCount: number;
  reviewsRating: number;
}

interface PHComment {
  id: string;
  body: string;
  votesCount: number;
  createdAt: string;
  user: { name: string };
}

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/**
 * Product Hunt Crawler
 *
 * Fetches:
 * - Daily top launches (to track what's being validated)
 * - Top comments on those launches (pain points, feature requests, comparisons)
 *
 * Uses the Product Hunt GraphQL API v2.
 * Requires: PRODUCTHUNT_TOKEN
 */
export class ProductHuntCrawler extends BaseCrawler {
  readonly name = 'producthunt';
  readonly baseUrl = 'https://www.producthunt.com';

  private readonly apiUrl = 'https://api.producthunt.com/v2/api/graphql';

  constructor(options: CrawlerOptions = {}) {
    super(options);
  }

  async crawl(): Promise<RawSignal[]> {
    const token = process.env['PRODUCTHUNT_TOKEN'];
    if (!token) {
      this.logger.warn('PRODUCTHUNT_TOKEN not set — skipping Product Hunt crawl');
      return [];
    }

    const signals: RawSignal[] = [];

    // Fetch posts from the last 3 days
    for (let daysAgo = 0; daysAgo < 3; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0] as string;

      try {
        const posts = await this.fetchPostsForDate(dateStr, token);
        this.logger.info({ date: dateStr, count: posts.length }, 'Fetched PH posts');

        for (const post of posts) {
          const postSignal = this.postToSignal(post);
          if (postSignal) signals.push(postSignal);

          // Also fetch top comments for each post
          const comments = await this.fetchTopComments(post.id, token);
          for (const comment of comments) {
            const commentSignal = this.commentToSignal(comment, post);
            if (commentSignal) signals.push(commentSignal);
          }
        }
      } catch (err) {
        this.logger.error({ date: dateStr, err }, 'Failed to fetch PH posts');
      }
    }

    this.logger.info({ total: signals.length }, 'Product Hunt crawl complete');
    return signals;
  }

  private async fetchPostsForDate(date: string, token: string): Promise<PHPost[]> {
    const query = `
      query PostsForDate($date: DateTime!) {
        posts(postedAfter: $date, order: VOTES, first: 30) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              commentsCount
              createdAt
              reviewsCount
              reviewsRating
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.fetchWithDelay(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { date: `${date}T00:00:00Z` },
      }),
    });

    if (!response.ok) {
      throw new Error(`PH API error: ${response.status}`);
    }

    const json = (await response.json()) as GraphQLResponse<{
      posts: { edges: Array<{ node: PHPost & { topics: { edges: Array<{ node: { name: string } }> } } }> };
    }>;

    if (json.errors?.length) {
      throw new Error(`PH GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`);
    }

    return json.data.posts.edges.map((e) => ({
      ...e.node,
      topics: e.node.topics.edges.map((t) => ({ name: t.node.name })),
    }));
  }

  private async fetchTopComments(postId: string, token: string): Promise<PHComment[]> {
    const query = `
      query TopComments($postId: ID!) {
        post(id: $postId) {
          comments(order: VOTES, first: 10) {
            edges {
              node {
                id
                body
                votesCount
                createdAt
                user {
                  name
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.fetchWithDelay(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { postId } }),
      });

      if (!response.ok) return [];

      const json = (await response.json()) as GraphQLResponse<{
        post: { comments: { edges: Array<{ node: PHComment }> } } | null;
      }>;

      return json.data.post?.comments.edges.map((e) => e.node) ?? [];
    } catch {
      return [];
    }
  }

  private postToSignal(post: PHPost): RawSignal | null {
    const sourceId = `ph-post-${post.id}`;
    const body = [post.description, post.tagline].filter(Boolean).join('\n\n');

    if (body.length < 30) return null;

    return {
      sourceId,
      source: 'producthunt',
      url: post.url,
      title: post.name,
      body: this.truncate(body),
      score: post.votesCount,
      commentCount: post.commentsCount,
      publishedAt: new Date(post.createdAt),
      crawledAt: new Date(),
      metadata: {
        type: 'launch',
        topics: post.topics.map((t) => t.name),
        reviewsCount: post.reviewsCount,
        reviewsRating: post.reviewsRating,
      },
    };
  }

  private commentToSignal(comment: PHComment, post: PHPost): RawSignal | null {
    if (!comment.body || comment.body.length < 50) return null;
    if (comment.votesCount < 2) return null;

    const sourceId = `ph-comment-${comment.id}`;

    return {
      sourceId,
      source: 'producthunt',
      url: post.url,
      title: `Comment on: ${post.name}`,
      body: this.truncate(comment.body),
      author: comment.user.name,
      score: comment.votesCount,
      commentCount: 0,
      publishedAt: new Date(comment.createdAt),
      crawledAt: new Date(),
      metadata: {
        type: 'comment',
        postId: post.id,
        postName: post.name,
      },
    };
  }
}
