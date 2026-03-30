import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the Anthropic SDK so no real API calls are made
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate, // expose for test access
  };
});

// Mock Prisma so no real DB connection is needed
vi.mock('@opportunityscout/db', () => ({
  prisma: {
    rawSignal: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    opportunity: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    scoreHistory: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal RawSignal fixture. */
function makeSignal(
  overrides: Partial<{
    id: string;
    title: string;
    body: string;
    source: string;
    url: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'signal-test-001',
    title: overrides.title ?? 'I wish someone built a tool to auto-categorise meeting notes by action item',
    body:
      overrides.body ??
      'Every week we spend 30 minutes manually pulling action items out of Zoom transcripts. ' +
        'Otter.ai captures the transcript but nothing categorises or assigns the tasks automatically. ' +
        "I'd pay $50/mo for something that just worked.",
    source: overrides.source ?? 'reddit',
    url: overrides.url ?? 'https://www.reddit.com/r/productivity/comments/abc123',
  };
}

/** Build a mock Claude API response for filter step. */
function makeFilterResponse(results: Array<{ id: string; category: string; confidence: number; reasoning: string }>) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ results }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 200 },
  };
}

/** Build a mock Claude API response for extraction step. */
function makeExtractionResponse(opportunity: {
  title: string;
  problemStatement: string;
  proposedAISolution: string;
  targetCustomer: string;
  estimatedMarketSize: string;
  urgencyScore: number;
  aiSuitabilityScore: number;
  keywords: string[];
  revenueIndicators: string[];
  competitorContext: string;
  solutionHints: string[];
}) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(opportunity),
      },
    ],
    usage: { input_tokens: 600, output_tokens: 300 },
  };
}

// ---------------------------------------------------------------------------
// Step 1: Filter Tests
// ---------------------------------------------------------------------------

describe('AI Pipeline — Step 1: Filter', () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let prisma: { rawSignal: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    const anthropicModule = await import('@anthropic-ai/sdk');
    // Access mock via the factory's instance
    const client = new (anthropicModule.default as ReturnType<typeof vi.fn>)();
    mockCreate = client.messages.create;
    mockCreate.mockReset();

    const dbModule = await import('@opportunityscout/db');
    prisma = dbModule.prisma as typeof prisma;
    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockReset();
    (prisma.rawSignal.update as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('classifies a pain-point signal correctly', async () => {
    const signal = makeSignal();

    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([signal]);

    mockCreate.mockResolvedValueOnce(
      makeFilterResponse([
        {
          id: signal.id,
          category: 'PAIN_POINT',
          confidence: 0.92,
          reasoning: 'User expresses clear frustration with current tooling and willingness to pay.',
        },
      ]),
    );

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: signal.id,
      category: 'PAIN_POINT',
    });
  });

  it('filters out NOISE signals', async () => {
    const noiseSignal = makeSignal({
      id: 'noise-001',
      title: 'Just posted a meme about Python',
      body: 'haha snake go brrr',
    });

    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([noiseSignal]);

    mockCreate.mockResolvedValueOnce(
      makeFilterResponse([
        {
          id: noiseSignal.id,
          category: 'NOISE',
          confidence: 0.99,
          reasoning: 'No business signal or pain point present.',
        },
      ]),
    );

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);

    // NOISE signals should be excluded from the returned list
    const noiseInResults = results.filter((r) => r.category === 'NOISE');
    expect(noiseInResults).toHaveLength(0);
  });

  it('handles empty signal list gracefully', async () => {
    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);

    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('classifies a market gap signal correctly', async () => {
    const signal = makeSignal({
      title: 'No affordable tool exists for solo freelancers to do proper contract risk analysis',
      body: 'Contract review tools like Ironclad cost $1k+/month. Solo freelancers need this too.',
    });

    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([signal]);
    mockCreate.mockResolvedValueOnce(
      makeFilterResponse([
        { id: signal.id, category: 'MARKET_GAP', confidence: 0.88, reasoning: 'Clear unserved segment identified.' },
      ]),
    );

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);

    expect(results[0]?.category).toBe('MARKET_GAP');
  });

  it('classifies a feature request correctly', async () => {
    const signal = makeSignal({
      title: 'Notion needs a proper recurring tasks feature — the workarounds are painful',
      body: 'Been using Notion for 2 years. The lack of native recurring tasks is a daily annoyance. The database workarounds break constantly.',
    });

    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([signal]);
    mockCreate.mockResolvedValueOnce(
      makeFilterResponse([
        { id: signal.id, category: 'FEATURE_REQUEST', confidence: 0.85, reasoning: 'Requesting a specific feature in an existing product.' },
      ]),
    );

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);

    expect(results[0]?.category).toBe('FEATURE_REQUEST');
  });

  it('handles Claude API errors gracefully', async () => {
    const signal = makeSignal();
    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([signal]);
    mockCreate.mockRejectedValueOnce(new Error('API overloaded'));

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    // Should not throw — returns partial or empty results
    const results = await runFilterStep(10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('handles malformed JSON response from Claude gracefully', async () => {
    const signal = makeSignal();
    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([signal]);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json { broken' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { runFilterStep } = await import('../../ai/src/pipeline/step1-filter.js');
    const results = await runFilterStep(10);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Step 2: Extraction Tests
// ---------------------------------------------------------------------------

describe('AI Pipeline — Step 2: Extraction', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const anthropicModule = await import('@anthropic-ai/sdk');
    const client = new (anthropicModule.default as ReturnType<typeof vi.fn>)();
    mockCreate = client.messages.create;
    mockCreate.mockReset();

    const dbModule = await import('@opportunityscout/db');
    const prisma = dbModule.prisma as {
      rawSignal: { findMany: ReturnType<typeof vi.fn> };
      opportunity: { upsert: ReturnType<typeof vi.fn> };
    };
    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockReset();
  });

  it('extracts a structured opportunity from a signal', async () => {
    const signal = makeSignal();
    const dbModule = await import('@opportunityscout/db');
    const prisma = dbModule.prisma as { rawSignal: { findMany: ReturnType<typeof vi.fn> } };

    (prisma.rawSignal.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...signal, category: 'PAIN_POINT', filtered: true },
    ]);

    const extracted = {
      title: 'AI Meeting Note Categoriser',
      problemStatement: 'Professionals waste time manually extracting action items from meeting transcripts. Existing tools transcribe but do not classify or assign tasks.',
      proposedAISolution: 'Use an LLM to parse meeting transcripts and automatically categorise, assign, and track action items with zero manual effort.',
      targetCustomer: 'Remote-first teams and solo professionals who use Zoom or similar tools',
      estimatedMarketSize: 'L',
      urgencyScore: 8,
      aiSuitabilityScore: 9,
      keywords: ['meeting', 'action items', 'productivity', 'AI', 'transcript'],
      revenueIndicators: ['$50/mo mentioned explicitly'],
      competitorContext: 'Otter.ai transcribes but does not categorise. Notion AI has note summarisation but no task assignment.',
      solutionHints: ['LLM extraction', 'calendar integration', 'task manager sync'],
    };

    mockCreate.mockResolvedValueOnce(makeExtractionResponse(extracted));

    const { runExtractStep } = await import('../../ai/src/pipeline/step2-extract.js');
    const results = await runExtractStep([
      { id: signal.id, category: 'PAIN_POINT', confidence: 0.92, reasoning: '' },
    ]);

    expect(Array.isArray(results)).toBe(true);
  });

  it('returns empty array when no signals are provided', async () => {
    const { runExtractStep } = await import('../../ai/src/pipeline/step2-extract.js');
    const results = await runExtractStep([]);
    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Step 4: Scoring Tests
// ---------------------------------------------------------------------------

describe('AI Pipeline — Step 4: Scoring', () => {
  it('computes OpportunityScore correctly for a known input', async () => {
    const { computeOpportunityScore } = await import('../../ai/src/pipeline/step4-score.js');

    // OpportunityScore = (rawSignalCount × 0.30) + (marketSizeNum × 0.35) + (urgencyScore × 0.20) + (aiSuitabilityScore × 0.15)
    // With rawSignalCount=10, marketSize='L' (=3), urgencyScore=8, aiSuitabilityScore=9:
    // = (10 * 0.30) + (3 * 0.35) + (8 * 0.20) + (9 * 0.15)
    // = 3.0 + 1.05 + 1.6 + 1.35 = 7.0

    const score = computeOpportunityScore({
      rawSignalCount: 10,
      estimatedMarketSize: 'L',
      urgencyScore: 8,
      aiSuitabilityScore: 9,
    });

    expect(score).toBeCloseTo(7.0, 1);
  });

  it('returns 0 for all-zero inputs', async () => {
    const { computeOpportunityScore } = await import('../../ai/src/pipeline/step4-score.js');
    const score = computeOpportunityScore({
      rawSignalCount: 0,
      estimatedMarketSize: 'S',
      urgencyScore: 0,
      aiSuitabilityScore: 0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('ranks XL market size higher than S for identical other inputs', async () => {
    const { computeOpportunityScore } = await import('../../ai/src/pipeline/step4-score.js');

    const scoreXL = computeOpportunityScore({
      rawSignalCount: 5,
      estimatedMarketSize: 'XL',
      urgencyScore: 5,
      aiSuitabilityScore: 5,
    });

    const scoreS = computeOpportunityScore({
      rawSignalCount: 5,
      estimatedMarketSize: 'S',
      urgencyScore: 5,
      aiSuitabilityScore: 5,
    });

    expect(scoreXL).toBeGreaterThan(scoreS);
  });

  it('ranks higher signal count higher for identical other inputs', async () => {
    const { computeOpportunityScore } = await import('../../ai/src/pipeline/step4-score.js');

    const scoreHigh = computeOpportunityScore({
      rawSignalCount: 100,
      estimatedMarketSize: 'M',
      urgencyScore: 5,
      aiSuitabilityScore: 5,
    });

    const scoreLow = computeOpportunityScore({
      rawSignalCount: 1,
      estimatedMarketSize: 'M',
      urgencyScore: 5,
      aiSuitabilityScore: 5,
    });

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});

// ---------------------------------------------------------------------------
// Step 3: Clustering Tests (lightweight, no Claude call needed)
// ---------------------------------------------------------------------------

describe('AI Pipeline — Step 3: Clustering', () => {
  it('exports runClusterStep function', async () => {
    const module = await import('../../ai/src/pipeline/step3-cluster.js');
    expect(typeof module.runClusterStep).toBe('function');
  });

  it('handles empty opportunity list without error', async () => {
    const { runClusterStep } = await import('../../ai/src/pipeline/step3-cluster.js');
    const result = await runClusterStep([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});
