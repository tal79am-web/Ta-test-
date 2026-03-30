import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@opportunityscout/db';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const VALID_SOURCES = [
  'reddit',
  'hackernews',
  'producthunt',
  'github',
  'stackoverflow',
  'devto',
  'g2reviews',
  'indiehackers',
] as const;

const settingsSchema = z.object({
  keywords: z.array(z.string().min(1).max(100)).max(100).optional(),
  enabledSources: z.array(z.enum(VALID_SOURCES)).optional(),
  minOpportunityScore: z.number().int().min(0).max(100).optional(),
  scoreWeightVolume: z.number().min(0).max(1).optional(),
  scoreWeightMarketSize: z.number().min(0).max(1).optional(),
  scoreWeightSignificance: z.number().min(0).max(1).optional(),
  scoreWeightUrgency: z.number().min(0).max(1).optional(),
  emailAlertsEnabled: z.boolean().optional(),
  alertEmail: z.string().email().optional(),
  alertThreshold: z.number().int().min(0).max(100).optional(),
  crawlSchedule: z
    .string()
    .regex(
      /^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})$/,
    )
    .optional(),
  maxConcurrentCrawlers: z.number().int().min(1).max(10).optional(),
  crawlerDelayMs: z.number().int().min(100).max(30000).optional(),
});

function validateWeights(data: z.infer<typeof settingsSchema>, current: Record<string, number>): string | null {
  const volume = data.scoreWeightVolume ?? current['scoreWeightVolume'] ?? 0.3;
  const market = data.scoreWeightMarketSize ?? current['scoreWeightMarketSize'] ?? 0.3;
  const significance = data.scoreWeightSignificance ?? current['scoreWeightSignificance'] ?? 0.25;
  const urgency = data.scoreWeightUrgency ?? current['scoreWeightUrgency'] ?? 0.15;
  const sum = volume + market + significance + urgency;

  if (Math.abs(sum - 1.0) > 0.001) {
    return `Score weights must sum to 1.0, got ${sum.toFixed(3)}`;
  }

  return null;
}

/**
 * GET /api/settings
 * Returns current application settings.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await prisma.settings.findFirst();

    if (!settings) {
      res.status(404).json({
        error: 'NotFound',
        message: 'Settings not found. Run db:seed to initialize.',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      ...settings,
      updatedAt: settings.updatedAt.toISOString(),
    });
  }),
);

/**
 * POST /api/settings
 * Partially updates application settings.
 * Only provided fields are updated (PATCH-like semantics).
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);

    // Get current settings to validate weight sums
    const current = await prisma.settings.findFirst();
    const currentWeights = {
      scoreWeightVolume: current?.scoreWeightVolume ?? 0.3,
      scoreWeightMarketSize: current?.scoreWeightMarketSize ?? 0.3,
      scoreWeightSignificance: current?.scoreWeightSignificance ?? 0.25,
      scoreWeightUrgency: current?.scoreWeightUrgency ?? 0.15,
    };

    const weightError = validateWeights(data, currentWeights);
    if (weightError) {
      res.status(400).json({
        error: 'ValidationError',
        message: weightError,
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updated = await prisma.settings.upsert({
      where: { id: current?.id ?? 'default' },
      create: {
        id: 'default',
        keywords: data.keywords ?? [],
        enabledSources: data.enabledSources ?? [...VALID_SOURCES],
        minOpportunityScore: data.minOpportunityScore ?? 40,
        scoreWeightVolume: data.scoreWeightVolume ?? 0.3,
        scoreWeightMarketSize: data.scoreWeightMarketSize ?? 0.3,
        scoreWeightSignificance: data.scoreWeightSignificance ?? 0.25,
        scoreWeightUrgency: data.scoreWeightUrgency ?? 0.15,
        emailAlertsEnabled: data.emailAlertsEnabled ?? false,
        alertEmail: data.alertEmail ?? '',
        alertThreshold: data.alertThreshold ?? 75,
        crawlSchedule: data.crawlSchedule ?? '0 5 * * *',
        maxConcurrentCrawlers: data.maxConcurrentCrawlers ?? 3,
        crawlerDelayMs: data.crawlerDelayMs ?? 1500,
      },
      update: {
        ...(data.keywords !== undefined && { keywords: data.keywords }),
        ...(data.enabledSources !== undefined && { enabledSources: data.enabledSources }),
        ...(data.minOpportunityScore !== undefined && { minOpportunityScore: data.minOpportunityScore }),
        ...(data.scoreWeightVolume !== undefined && { scoreWeightVolume: data.scoreWeightVolume }),
        ...(data.scoreWeightMarketSize !== undefined && { scoreWeightMarketSize: data.scoreWeightMarketSize }),
        ...(data.scoreWeightSignificance !== undefined && { scoreWeightSignificance: data.scoreWeightSignificance }),
        ...(data.scoreWeightUrgency !== undefined && { scoreWeightUrgency: data.scoreWeightUrgency }),
        ...(data.emailAlertsEnabled !== undefined && { emailAlertsEnabled: data.emailAlertsEnabled }),
        ...(data.alertEmail !== undefined && { alertEmail: data.alertEmail }),
        ...(data.alertThreshold !== undefined && { alertThreshold: data.alertThreshold }),
        ...(data.crawlSchedule !== undefined && { crawlSchedule: data.crawlSchedule }),
        ...(data.maxConcurrentCrawlers !== undefined && { maxConcurrentCrawlers: data.maxConcurrentCrawlers }),
        ...(data.crawlerDelayMs !== undefined && { crawlerDelayMs: data.crawlerDelayMs }),
        updatedAt: new Date(),
      },
    });

    res.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }),
);

export default router;
