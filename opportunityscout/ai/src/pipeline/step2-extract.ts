import pino from 'pino';
import client, { MODEL, MAX_TOKENS, TEMPERATURE } from '../client.js';
import { EXTRACT_SYSTEM_PROMPT, buildExtractPrompt } from '../prompts/extract.js';
import { prisma } from '@opportunityscout/db';
import type { FilterResult } from './step1-filter.js';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { step: 'extract' } });

export interface ExtractedOpportunity {
  signalId: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  category: string;
  keywords: string[];
  solutionHints: string[];
  competitorContext: string;
  revenueIndicators: string[];
  extractionConfidence: number;
}

const BATCH_SIZE = 10; // Smaller batches for extraction (more detailed output)

/**
 * Step 2: Extract
 *
 * For each non-noise signal from Step 1, extracts structured opportunity data:
 * title, problem statement, audience, keywords, solution hints, etc.
 *
 * @param filterResults - Non-noise results from Step 1
 * @returns Array of extracted opportunities ready for clustering
 */
export async function runExtractStep(
  filterResults: FilterResult[],
): Promise<ExtractedOpportunity[]> {
  logger.info({ count: filterResults.length }, 'Starting extract step');

  if (filterResults.length === 0) {
    logger.info('No signals to extract from');
    return [];
  }

  // Fetch full signal data for non-noise signals
  const signalIds = filterResults.map((r) => r.id);
  const signals = await prisma.rawSignal.findMany({
    where: {
      id: { in: signalIds },
      noise: false,
    },
    select: {
      id: true,
      title: true,
      body: true,
      source: true,
      category: true,
    },
  });

  const allExtractions: ExtractedOpportunity[] = [];

  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    logger.debug({ batchIndex: i / BATCH_SIZE, batchSize: batch.length }, 'Extracting batch');

    try {
      const extractions = await extractBatch(
        batch.map((s) => ({
          id: s.id,
          title: s.title,
          body: s.body,
          source: s.source,
          category: s.category ?? 'PAIN_POINT',
        })),
      );

      allExtractions.push(...extractions);
    } catch (err) {
      logger.error({ err, batchIndex: i / BATCH_SIZE }, 'Extract batch failed');
    }
  }

  logger.info({ count: allExtractions.length }, 'Extract step complete');
  return allExtractions;
}

async function extractBatch(
  signals: Array<{
    id: string;
    title: string;
    body: string;
    source: string;
    category: string;
  }>,
): Promise<ExtractedOpportunity[]> {
  const prompt = buildExtractPrompt(signals);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response from Anthropic');
  }

  const jsonStr = content.text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const parsed = JSON.parse(jsonStr) as Array<{
    signalId: string;
    title: string;
    problemStatement: string;
    targetAudience: string;
    category: string;
    keywords: string[];
    solutionHints: string[];
    competitorContext: string;
    revenueIndicators: string[];
    extractionConfidence: number;
  }>;

  return parsed.filter((e) => e.extractionConfidence >= 0.5);
}
