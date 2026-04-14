import { Router } from 'express';
import { prisma } from '@opportunityscout/db';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { SourceHealthStatus, SignalSource } from '../types/index.js';

const router = Router();

const ALL_SOURCES: SignalSource[] = [
  'reddit',
  'hackernews',
  'producthunt',
  'github',
  'stackoverflow',
  'devto',
  'g2reviews',
  'indiehackers',
];

/**
 * GET /api/sources
 * Returns health status and stats for each configured crawler source.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Get the most recent JobRun per source
    const recentRuns = await prisma.jobRun.findMany({
      where: {
        jobType: 'crawl',
      },
      orderBy: { startedAt: 'desc' },
      take: ALL_SOURCES.length * 3, // get a few per source in case we need to filter
    });

    // Get total signal counts per source
    const signalCounts = await prisma.rawSignal.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const signalCountMap = new Map(
      signalCounts.map((s) => [s.source, s._count.id]),
    );

    // Get enabled sources from settings
    const settings = await prisma.settings.findFirst();
    const enabledSources: string[] = settings?.enabledSources ?? ALL_SOURCES;

    // Build status per source
    const statuses: SourceHealthStatus[] = ALL_SOURCES.map((source) => {
      // Find most recent run mentioning this source (stored in metadata)
      const sourceRun = recentRuns.find(
        (r) => (r.metadata as Record<string, unknown>)?.[source] !== undefined,
      );

      return {
        source,
        enabled: enabledSources.includes(source),
        lastRunAt: sourceRun?.startedAt.toISOString() ?? null,
        lastRunStatus: sourceRun?.status as SourceHealthStatus['lastRunStatus'] ?? null,
        signalsLastRun:
          (sourceRun?.metadata as Record<string, number>)?.[source] ?? 0,
        totalSignals: signalCountMap.get(source) ?? 0,
        errorMessage:
          sourceRun?.status === 'failed'
            ? ((sourceRun.metadata as Record<string, unknown>)?.[`${source}_error`] as string) ?? null
            : null,
      };
    });

    res.json({ data: statuses });
  }),
);

export default router;
