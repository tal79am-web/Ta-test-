import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@opportunityscout/db';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(7),
});

/**
 * GET /api/summaries
 * Returns the most recent daily summaries (newest first).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit } = listQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [total, summaries] = await Promise.all([
      prisma.dailySummary.count(),
      prisma.dailySummary.findMany({
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          markdownContent: true,
          topOpportunityIds: true,
          totalSignalsProcessed: true,
          totalOpportunitiesFound: true,
          emailSent: true,
          generatedAt: true,
        },
      }),
    ]);

    res.json({
      data: summaries.map((s) => ({
        ...s,
        date: s.date,
        generatedAt: s.generatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

/**
 * GET /api/summaries/:date
 * Returns the daily summary for a specific date in YYYY-MM-DD format.
 */
router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const dateParam = req.params['date'] as string;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      throw new AppError(400, 'BadRequest', 'Date must be in YYYY-MM-DD format');
    }

    const summary = await prisma.dailySummary.findUnique({
      where: { date: dateParam },
    });

    if (!summary) {
      throw new AppError(404, 'NotFound', `No summary found for date ${dateParam}`);
    }

    res.json({
      ...summary,
      generatedAt: summary.generatedAt.toISOString(),
    });
  }),
);

export default router;
