import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HackerNewsCrawler } from '../../scraper/src/crawlers/hackernews.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the db module to avoid requiring a real DB connection
vi.mock('@opportunityscout/db', () => ({
  prisma: {
    rawSignal: {
      findUnique: vi.fn().mockResolvedValue(null), // No duplicates by default
      create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}));

// Sample HN API responses
const MOCK_STORY_IDS = [12345, 12346, 12347];

const MOCK_ITEMS: Record<number, unknown> = {
  12345: {
    id: 12345,
    type: 'story',
    title: 'Ask HN: Why is there no affordable secret management for small teams?',
    text: 'We are a 3-person startup and cannot afford HashiCorp Vault. We tried Doppler but the pricing is not right for our stage. Looking for alternatives that are self-hosted or very cheap.',
    by: 'founder_test',
    score: 245,
    descendants: 67,
    time: Math.floor(Date.now() / 1000) - 3600,
    kids: [99001, 99002],
  },
  12346: {
    id: 12346,
    type: 'story',
    title: 'Show HN: I built a simpler Stripe Connect for marketplaces',
    text: 'After spending 3 months integrating Stripe Connect for my marketplace, I realized every marketplace team rebuilds the same boilerplate. So I abstracted it.',
    by: 'indie_builder',
    score: 312,
    descendants: 89,
    time: Math.floor(Date.now() / 1000) - 7200,
    kids: [],
  },
  12347: {
    id: 12347,
    type: 'job',
    title: 'Acme Corp is hiring React developers',
    time: Math.floor(Date.now() / 1000) - 1800,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HackerNewsCrawler', () => {
  let crawler: HackerNewsCrawler;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    crawler = new HackerNewsCrawler();

    // Mock global fetch
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('askstories')) {
        return new Response(JSON.stringify(MOCK_STORY_IDS));
      }
      if (urlStr.includes('showstories')) {
        return new Response(JSON.stringify([12346]));
      }
      if (urlStr.includes('topstories')) {
        return new Response(JSON.stringify([]));
      }
      if (urlStr.includes('/v0/item/')) {
        const idMatch = urlStr.match(/\/v0\/item\/(\d+)\.json/);
        const id = idMatch ? parseInt(idMatch[1]!, 10) : 0;
        const item = MOCK_ITEMS[id];
        if (!item) return new Response('null');
        return new Response(JSON.stringify(item));
      }

      return new Response('{}');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return an array of RawSignals', async () => {
    const signals = await crawler.crawl();
    expect(Array.isArray(signals)).toBe(true);
  });

  it('should skip job listings', async () => {
    const signals = await crawler.crawl();
    const jobSignals = signals.filter((s) => s.title.includes('is hiring'));
    expect(jobSignals).toHaveLength(0);
  });

  it('should include Ask HN posts with body text', async () => {
    const signals = await crawler.crawl();
    const askSignals = signals.filter((s) => s.title.startsWith('Ask HN:'));
    expect(askSignals.length).toBeGreaterThan(0);
  });

  it('should include Show HN posts', async () => {
    const signals = await crawler.crawl();
    const showSignals = signals.filter((s) => s.title.startsWith('Show HN:'));
    expect(showSignals.length).toBeGreaterThan(0);
  });

  it('should set correct source field', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.source).toBe('hackernews');
    }
  });

  it('should generate sourceId in format hn-{id}', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.sourceId).toMatch(/^hn-\d+$/);
    }
  });

  it('should include engagement metadata', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      expect(signal.score).toBeGreaterThanOrEqual(0);
      expect(signal.commentCount).toBeGreaterThanOrEqual(0);
      expect(signal.publishedAt).toBeInstanceOf(Date);
    }
  });

  it('should not include signals with score < 10 AND comments < 5', async () => {
    // The mock items all have score >= 10 or descendants >= 5
    const signals = await crawler.crawl();
    for (const signal of signals) {
      const hasEnoughEngagement =
        signal.score >= 10 || signal.commentCount >= 5;
      expect(hasEnoughEngagement).toBe(true);
    }
  });

  it('should handle fetch errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const signals = await crawler.crawl();
    expect(Array.isArray(signals)).toBe(true);
    expect(signals).toHaveLength(0);
  });

  it('should mark metadata type correctly', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      const type = (signal.metadata as Record<string, unknown>)['type'];
      expect(['ask_hn', 'show_hn', 'story']).toContain(type);
    }
  });

  it('should include hn_url in metadata', async () => {
    const signals = await crawler.crawl();
    for (const signal of signals) {
      const hnUrl = (signal.metadata as Record<string, unknown>)['hn_url'];
      expect(hnUrl).toMatch(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/);
    }
  });
});
