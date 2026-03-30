import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import { generateDailySummary } from '@opportunityscout/ai';
import type { ScoredOpportunity } from '@opportunityscout/ai';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { job: 'summary' } });

interface SummaryJobOptions {
  jobRunId?: string;
  scoredOpportunities?: ScoredOpportunity[];
  crawlStats?: { totalSignalsProcessed: number; bySource: Record<string, number> };
}

/**
 * Generates and stores the daily executive summary.
 *
 * If scoredOpportunities are not passed (e.g., when run independently),
 * it fetches today's top opportunities directly from the database.
 */
export async function runSummaryJob(options: SummaryJobOptions = {}): Promise<void> {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0] as string;

  logger.info({ date: today }, 'Starting summary job');

  if (options.jobRunId) {
    await prisma.jobRun.update({
      where: { id: options.jobRunId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  try {
    let scoredOpportunities = options.scoredOpportunities;
    let crawlStats = options.crawlStats;

    // If not provided, load today's opportunities from the database
    if (!scoredOpportunities) {
      const opportunities = await prisma.opportunity.findMany({
        where: {
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { scoreComposite: 'desc' },
        take: 20,
        include: {
          signals: {
            select: { source: true },
          },
        },
      });

      // Build a minimal ScoredOpportunity shape for the generator
      scoredOpportunities = opportunities.map((opp) => ({
        clusterId: opp.id,
        opportunityId: opp.id,
        score: {
          composite: opp.scoreComposite,
          volume: opp.scoreVolume,
          marketSize: opp.scoreMarketSize,
          significance: opp.scoreSignificance,
          urgency: opp.scoreUrgency,
        },
        cluster: {
          clusterId: opp.id,
          clusterTitle: opp.title,
          clusterProblem: opp.problemStatement,
          memberIds: opp.signals.map((_, i) => `${opp.id}-${i}`),
          primaryId: opp.id,
          mergeRationale: '',
          primary: {
            signalId: opp.id,
            title: opp.title,
            problemStatement: opp.problemStatement,
            targetAudience: opp.targetAudience,
            category: opp.category,
            keywords: opp.keywords,
            solutionHints: opp.solutionHints,
            competitorContext: opp.competitorContext ?? '',
            revenueIndicators: opp.revenueIndicators,
            extractionConfidence: 1.0,
          },
          members: [],
        },
      }));
    }

    if (!crawlStats) {
      // Get today's signal stats
      const signalCount = await prisma.rawSignal.count({
        where: { crawledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });

      const byCrawler = await prisma.rawSignal.groupBy({
        by: ['source'],
        where: { crawledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _count: { id: true },
      });

      crawlStats = {
        totalSignalsProcessed: signalCount,
        bySource: Object.fromEntries(byCrawler.map((r) => [r.source, r._count.id])),
      };
    }

    await generateDailySummary(scoredOpportunities, crawlStats);

    const durationMs = Date.now() - startTime;

    if (options.jobRunId) {
      await prisma.jobRun.update({
        where: { id: options.jobRunId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          durationMs,
          opportunitiesCreated: scoredOpportunities.length,
        },
      });
    }

    logger.info({ date: today, durationMs }, 'Summary job complete');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Summary job failed');

    if (options.jobRunId) {
      await prisma.jobRun.update({
        where: { id: options.jobRunId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage,
        },
      });
    }

    throw err;
  }
}
