import pino from 'pino';
import client, { MODEL, MAX_TOKENS, TEMPERATURE } from '../client.js';
import { FILTER_SYSTEM_PROMPT, buildFilterPrompt } from '../prompts/filter.js';
import { prisma } from '@opportunityscout/db';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { step: 'filter' } });

export type SignalCategory = 'MARKET_GAP' | 'PAIN_POINT' | 'FEATURE_REQUEST' | 'NOISE';

export interface FilterResult {
  id: string;
  category: SignalCategory;
  confidence: number;
  reasoning: string;
}

const BATCH_SIZE = 20; // Process signals in batches to stay within context limits

/**
 * Step 1: Filter
 *
 * Takes unprocessed raw signals and classifies each as:
 *   MARKET_GAP | PAIN_POINT | FEATURE_REQUEST | NOISE
 *
 * Noise signals are marked as such in the DB and excluded from Step 2.
 * Results are persisted back to the RawSignal table.
 *
 * @returns Array of non-noise signals ready for Step 2
 */
export async function runFilterStep(limit = 500): Promise<FilterResult[]> {
  logger.info({ limit }, 'Starting filter step');

  // Fetch unprocessed signals
  const signals = await prisma.rawSignal.findMany({
    where: { filtered: false },
    orderBy: { crawledAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      source: true,
    },
  });

  if (signals.length === 0) {
    logger.info('No unprocessed signals found');
    return [];
  }

  logger.info({ count: signals.length }, 'Signals to filter');

  const allResults: FilterResult[] = [];

  // Process in batches
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    logger.debug({ batchIndex: i / BATCH_SIZE, batchSize: batch.length }, 'Processing batch');

    try {
      const results = await classifyBatch(batch);
      allResults.push(...results);

      // Persist classification results
      await persistFilterResults(results);

      logger.debug({ processed: allResults.length }, 'Batch complete');
    } catch (err) {
      logger.error({ err, batchIndex: i / BATCH_SIZE }, 'Filter batch failed');
      // Mark as filtered to avoid infinite retry, but don't classify as NOISE
      await prisma.rawSignal.updateMany({
        where: { id: { in: batch.map((s) => s.id) } },
        data: { filtered: true },
      });
    }
  }

  const nonNoise = allResults.filter((r) => r.category !== 'NOISE');
  logger.info(
    {
      total: allResults.length,
      nonNoise: nonNoise.length,
      noise: allResults.length - nonNoise.length,
    },
    'Filter step complete',
  );

  return nonNoise;
}

async function classifyBatch(
  signals: Array<{ id: string; title: string; body: string; source: string }>,
): Promise<FilterResult[]> {
  const prompt = buildFilterPrompt(signals);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: FILTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API');
  }

  // Parse JSON response (strip markdown code fences if present)
  const jsonStr = content.text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const parsed = JSON.parse(jsonStr) as Array<{
    id: string;
    category: string;
    confidence: number;
    reasoning: string;
  }>;

  return parsed.map((item) => ({
    id: item.id,
    category: item.category as SignalCategory,
    confidence: item.confidence,
    reasoning: item.reasoning,
  }));
}

async function persistFilterResults(results: FilterResult[]): Promise<void> {
  const updates = results.map((r) =>
    prisma.rawSignal.update({
      where: { id: r.id },
      data: {
        category: r.category,
        filtered: true,
        noise: r.category === 'NOISE',
        metadata: {
          filterConfidence: r.confidence,
          filterReasoning: r.reasoning,
        },
      },
    }),
  );

  await Promise.all(updates);
}
