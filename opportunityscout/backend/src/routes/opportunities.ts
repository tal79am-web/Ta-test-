import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@opportunityscout/db';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import type { PaginatedResponse, OpportunityListItem, OpportunityDetail } from '../types/index.js';

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['composite', 'volume', 'marketSize', 'significance', 'urgency', 'createdAt'])
    .default('composite'),
  order: z.enum(['asc', 'desc']).default('desc'),
  minScore: z.coerce.number().min(0).max(100).optional(),
  category: z.enum(['MARKET_GAP', 'PAIN_POINT', 'FEATURE_REQUEST', 'NOISE']).optional(),
  source: z
    .enum(['reddit', 'hackernews', 'producthunt', 'github', 'stackoverflow', 'devto', 'g2reviews', 'indiehackers'])
    .optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(200).optional(),
});

/**
 * GET /api/opportunities
 * Returns a paginated, sortable, filterable list of opportunities.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { page, limit, sortBy, order, minScore, category, source, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    // Build Prisma where clause
    const where: Record<string, unknown> = {};

    if (minScore !== undefined) {
      where['scoreComposite'] = { gte: minScore };
    }

    if (category) {
      where['category'] = category;
    }

    if (source) {
      where['sources'] = { has: source };
    }

    if (dateFrom || dateTo) {
      where['createdAt'] = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
      };
    }

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { problemStatement: { contains: search, mode: 'insensitive' } },
        { keywords: { has: search.toLowerCase() } },
      ];
    }

    // Map sortBy field to Prisma column
    const orderByMap: Record<string, string> = {
      composite: 'scoreComposite',
      volume: 'scoreVolume',
      marketSize: 'scoreMarketSize',
      significance: 'scoreSignificance',
      urgency: 'scoreUrgency',
      createdAt: 'createdAt',
    };

    const [total, opportunities] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        orderBy: { [orderByMap[sortBy] ?? 'scoreComposite']: order },
        skip,
        take: limit,
        include: {
          _count: { select: { signals: true } },
        },
      }),
    ]);

    // Compute isNew and isRising
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const items: OpportunityListItem[] = opportunities.map((opp) => ({
      id: opp.id,
      title: opp.title,
      problemStatement: opp.problemStatement,
      targetAudience: opp.targetAudience,
      category: opp.category as OpportunityListItem['category'],
      score: {
        composite: opp.scoreComposite,
        volume: opp.scoreVolume,
        marketSize: opp.scoreMarketSize,
        significance: opp.scoreSignificance,
        urgency: opp.scoreUrgency,
      },
      sources: opp.sources as OpportunityListItem['sources'],
      signalCount: opp._count.signals,
      keywords: opp.keywords,
      isNew: opp.createdAt >= oneDayAgo,
      isRising:
        opp.previousScore !== null &&
        opp.scoreComposite - opp.previousScore > 10 &&
        opp.updatedAt >= oneWeekAgo,
      createdAt: opp.createdAt.toISOString(),
      updatedAt: opp.updatedAt.toISOString(),
    }));

    const response: PaginatedResponse<OpportunityListItem> = {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  }),
);

/**
 * GET /api/opportunities/:id
 * Returns full opportunity detail including all source signals and score history.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        signals: {
          orderBy: { score: 'desc' },
          take: 50,
        },
        scoreHistory: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!opportunity) {
      throw new AppError(404, 'NotFound', `Opportunity ${id} not found`);
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const detail: OpportunityDetail = {
      id: opportunity.id,
      title: opportunity.title,
      problemStatement: opportunity.problemStatement,
      targetAudience: opportunity.targetAudience,
      category: opportunity.category as OpportunityDetail['category'],
      score: {
        composite: opportunity.scoreComposite,
        volume: opportunity.scoreVolume,
        marketSize: opportunity.scoreMarketSize,
        significance: opportunity.scoreSignificance,
        urgency: opportunity.scoreUrgency,
      },
      sources: opportunity.sources as OpportunityDetail['sources'],
      signalCount: opportunity.signals.length,
      keywords: opportunity.keywords,
      isNew: opportunity.createdAt >= oneDayAgo,
      isRising:
        opportunity.previousScore !== null &&
        opportunity.scoreComposite - opportunity.previousScore > 10 &&
        opportunity.updatedAt >= oneWeekAgo,
      solutionHints: opportunity.solutionHints,
      competitorContext: opportunity.competitorContext ?? '',
      revenueIndicators: opportunity.revenueIndicators,
      createdAt: opportunity.createdAt.toISOString(),
      updatedAt: opportunity.updatedAt.toISOString(),
      signals: opportunity.signals.map((sig) => ({
        id: sig.id,
        source: sig.source as OpportunityDetail['sources'][number],
        url: sig.url,
        title: sig.title,
        score: sig.score,
        commentCount: sig.commentCount,
        publishedAt: sig.publishedAt.toISOString(),
        category: sig.category as OpportunityDetail['category'],
      })),
      scoreHistory: opportunity.scoreHistory.map((h) => ({
        date: h.date,
        composite: h.composite,
      })),
    };

    res.json(detail);
  }),
);

export default router;
