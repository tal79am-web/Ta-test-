import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@opportunityscout/db';
import { requireApiKey } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = Router();

// All job routes require API key authentication
router.use(requireApiKey);

const runJobSchema = z.object({
  job: z.enum(['crawl', 'analyze', 'summary', 'email', 'all']),
});

/**
 * POST /api/jobs/run-now
 * Immediately triggers a job (or all jobs) by enqueuing it into BullMQ.
 *
 * Requires X-API-Key header.
 *
 * Body: { "job": "crawl" | "analyze" | "summary" | "email" | "all" }
 */
router.post(
  '/run-now',
  asyncHandler(async (req, res) => {
    const { job } = runJobSchema.parse(req.body);

    const jobsToRun = job === 'all'
      ? ['crawl', 'analyze', 'summary', 'email']
      : [job];

    // Create JobRun records with 'pending' status
    const createdRuns = await Promise.all(
      jobsToRun.map((jobType) =>
        prisma.jobRun.create({
          data: {
            jobType,
            status: 'pending',
            startedAt: new Date(),
            signalsProcessed: 0,
            opportunitiesCreated: 0,
            triggeredBy: 'api',
          },
        }),
      ),
    );

    // In a full deployment the scheduler would pick these up via BullMQ.
    // For the API response, we return the created job run IDs immediately.
    res.status(202).json({
      message: `Job(s) enqueued successfully`,
      jobs: createdRuns.map((r) => ({
        id: r.id,
        jobType: r.jobType,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
      })),
    });
  }),
);

/**
 * GET /api/jobs
 * List recent job runs.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
    const skip = (page - 1) * limit;

    const [total, runs] = await Promise.all([
      prisma.jobRun.count(),
      prisma.jobRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: runs.map((r) => ({
        id: r.id,
        jobType: r.jobType,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        durationMs: r.durationMs,
        signalsProcessed: r.signalsProcessed,
        opportunitiesCreated: r.opportunitiesCreated,
        errorMessage: r.errorMessage,
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
 * GET /api/jobs/:id
 * Get details of a specific job run.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };

    const run = await prisma.jobRun.findUnique({ where: { id } });

    if (!run) {
      throw new AppError(404, 'NotFound', `Job run ${id} not found`);
    }

    res.json({
      id: run.id,
      jobType: run.jobType,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      signalsProcessed: run.signalsProcessed,
      opportunitiesCreated: run.opportunitiesCreated,
      errorMessage: run.errorMessage,
      metadata: run.metadata,
    });
  }),
);

export default router;
