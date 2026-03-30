import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import {
  runFilterStep,
  runExtractStep,
  runClusterStep,
  runScoreStep,
} from '@opportunityscout/ai';
import type { ScoredOpportunity } from '@opportunityscout/ai';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { job: 'analyze' } });

interface AnalyzeJobOptions {
  jobRunId?: string;
  signalLimit?: number;
}

/**
 * Runs the complete 4-step AI analysis pipeline on unprocessed signals.
 *
 * Steps:
 * 1. Filter — classify signals as MARKET_GAP | PAIN_POINT | FEATURE_REQUEST | NOISE
 * 2. Extract — pull structured data from non-noise signals
 * 3. Cluster — group semantically similar opportunities
 * 4. Score — compute composite scores and persist opportunities
 *
 * @returns Scored opportunities created or updated in this run
 */
export async function runAnalyzeJob(
  options: AnalyzeJobOptions = {},
): Promise<ScoredOpportunity[]> {
  const startTime = Date.now();
  const limit = options.signalLimit ?? 500;

  logger.info({ limit }, 'Starting analyze job');

  if (options.jobRunId) {
    await prisma.jobRun.update({
      where: { id: options.jobRunId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  let opportunitiesCreated = 0;

  try {
    // Step 1: Filter
    logger.info('Running Step 1: Filter');
    const filterResults = await runFilterStep(limit);
    logger.info({ nonNoise: filterResults.length }, 'Step 1 complete');

    if (filterResults.length === 0) {
      logger.info('No signals passed filter — stopping pipeline');
      await finalizeJobRun(options.jobRunId, 'completed', 0, 0, Date.now() - startTime);
      return [];
    }

    // Step 2: Extract
    logger.info('Running Step 2: Extract');
    const extractions = await runExtractStep(filterResults);
    logger.info({ extractions: extractions.length }, 'Step 2 complete');

    if (extractions.length === 0) {
      logger.info('No extractions produced — stopping pipeline');
      await finalizeJobRun(options.jobRunId, 'completed', filterResults.length, 0, Date.now() - startTime);
      return [];
    }

    // Step 3: Cluster
    logger.info('Running Step 3: Cluster');
    const clusters = await runClusterStep(extractions);
    logger.info({ clusters: clusters.length }, 'Step 3 complete');

    // Step 4: Score
    logger.info('Running Step 4: Score');
    const scored = await runScoreStep(clusters);
    opportunitiesCreated = scored.length;
    logger.info({ opportunities: opportunitiesCreated }, 'Step 4 complete');

    const durationMs = Date.now() - startTime;
    await finalizeJobRun(options.jobRunId, 'completed', filterResults.length, opportunitiesCreated, durationMs);

    logger.info({ durationMs, opportunitiesCreated }, 'Analyze job complete');
    return scored;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error({ err, durationMs }, 'Analyze job failed');
    await finalizeJobRun(options.jobRunId, 'failed', 0, 0, durationMs, errorMessage);

    throw err;
  }
}

async function finalizeJobRun(
  jobRunId: string | undefined,
  status: string,
  signalsProcessed: number,
  opportunitiesCreated: number,
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  if (!jobRunId) return;

  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status,
      completedAt: new Date(),
      durationMs,
      signalsProcessed,
      opportunitiesCreated,
      errorMessage: errorMessage ?? null,
    },
  });
}
