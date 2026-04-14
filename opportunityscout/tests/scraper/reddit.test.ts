import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedditCrawler } from '../../scraper/src/crawlers/reddit.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@opportunityscout/db', () => ({
  prisma: {
    rawSignal: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}));

const MOCK_TOKEN_RESPONSE = {
  access_token: 'mock-reddit-token',
  expires_in: 3600,
};

const MOCK_POSTS = [
  {
    id: 'abc123',
    title: 'How do small teams manage .env secrets without expensive tools?',
    selftext:
      'We are a 4-person team and tired of sharing secrets over Slack. Doppler is too expensive at our stage. Any recommendations for something simple and affordable?',
    author: 'startup_dev_test',
    score: 342,
    num_comments: 87,
    url: 'https://www.reddit.com/r/entrepreneur/comments/abc123/how_do_small_teams_manage/',
    permalink: '/r/entrepreneur/comments/abc123/how_do_small_teams_manage/',
    created_utc: Math.floor(Date.now() / 1000) - 86400,
    link_flair_text: 'Tools',
    subreddit: 'entrepreneur',
  },
  {
    id: 'def456',
    title: 'Just a link post',
    selftext: '', // No self-text — should be skipped
    author: 'link_poster',
    score: 100,
    num_comments: 20,
    url: 'https://example.com',
    permalink: '/r/entrepreneur/comments/def456/',
    created_utc: Math.floor(Date.now() / 1000) - 3600,
    link_flair_text: null,
    subreddit: 'entrepreneur',
  },
  {
    id: 'ghi789',
    title: 'I switched from Jira to Linear and never looked back',
    selftext: '[deleted]',
    author: 'deleted_user',
    score: 50,
    num_comments: 10,
    url: 'https://www.reddit.com/r/entrepreneur/comments/ghi789/',
    permalink: '/r/entrepreneur/comments/ghi789/',
    created_utc: Math.floor(Date.now() / 1000) - 7200,
    link_flair_text: null,
    subreddit: 'entrepreneur',
  },
];

const MOCK_REDDIT_LISTING = {
  data: {
    children: MOCK_POSTS.map((post) => ({ data: post })),
    after: null,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedditCrawler', () => {
  let crawler: RedditCrawler;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Set required env vars
    process.env['REDDIT_CLIENT_ID'] = 'test-client-id';
    process.env['REDDIT_CLIENT_SECRET'] = 'test-client-secret';
    process.env['REDDIT_SUBREDDITS'] = 'entrepreneur';
    process.env['REDDIT_MAX_POSTS'] = '10';

    crawler = new RedditCrawler();

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();

      // OAuth token endpoint
      if (urlStr.includes('api/v1/access_token')) {
        return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE));
      }

      // Subreddit listing
      if (urlStr.includes('oauth.reddit.com/r/')) {
        return new Response(JSON.stringify(MOCK_REDDIT_LISTING));
      }

      // robots.txt
      if (urlStr.includes('robots.txt')) {
        return new Response('User-agent: *\nAllow: /');
      }

      return new Response('{}', { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['REDDIT_CLIENT_ID'];
    delete process.env['REDDIT_CLIENT_SECRET'];
  });

  it('should return an array', async () => {
    const signals = await crawler.crawl();
    expect(Array.isArray(signals)).toBe(true);
  });

  it('should skip posts with no self-text', async () => {
    const signals = await crawler.crawl();
    const emptyBody = signals.filter((s) => !s.body || s.body.trim().length < 50);
    expect(emptyBody).toHaveLength(0);
  });

  it('should skip deleted posts', async () => {
    const signals = await crawler.crawl();
    const deleted = signals.filter((s) => s.body === '[deleted]' || s.body === '[removed]');
    expect(deleted).toHaveLength(0);
  });

  it('should set source field to reddit', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.source).toBe('reddit');
    }
  });

  it('should generate sourceId in format reddit-{id}', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.sourceId).toMatch(/^reddit-[a-z0-9]+$/);
    }
  });

  it('should include subreddit in metadata', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect((signal.metadata as Record<string, unknown>)['subreddit']).toBeTruthy();
    }
  });

  it('should skip crawl if credentials are not set', async () => {
    delete process.env['REDDIT_CLIENT_ID'];
    const signals = await crawler.crawl();
    expect(signals).toHaveLength(0);
  });

  it('should parse publishedAt as a Date', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.publishedAt).toBeInstanceOf(Date);
      expect(isNaN(signal.publishedAt.getTime())).toBe(false);
    }
  });

  it('should set crawledAt to approximately now', async () => {
    const before = Date.now();
    const signals = await crawler.crawl();
    const after = Date.now();

    for (const signal of signals) {
      expect(signal.crawledAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(signal.crawledAt.getTime()).toBeLessThanOrEqual(after + 1000);
    }
  });

  it('should include score and commentCount', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(typeof signal.score).toBe('number');
      expect(typeof signal.commentCount).toBe('number');
    }
  });

  it('should use permalink to construct reddit URL', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.url).toMatch(/^https:\/\/www\.reddit\.com\//);
    }
  });

  it('should authenticate before crawling', async () => {
    await crawler.crawl();
    const authCalls = fetchSpy.mock.calls.filter(([url]) =>
      url.toString().includes('access_token'),
    );
    expect(authCalls.length).toBeGreaterThan(0);
  });

  it('should handle 429 rate limit gracefully', async () => {
    let callCount = 0;
    fetchSpy.mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('access_token')) {
        return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE));
      }

      callCount++;
      if (callCount === 1) {
        return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
      }

      return new Response(JSON.stringify(MOCK_REDDIT_LISTING));
    });

    // Should not throw even if rate limited
    const signals = await crawler.crawl();
    expect(Array.isArray(signals)).toBe(true);
  });
});
