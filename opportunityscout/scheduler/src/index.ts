import cron from 'node-cron';
import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import { runCrawlJob } from './jobs/crawl-job.js';
import { runAnalyzeJob } from './jobs/analyze-job.js';
import { runSummaryJob } from './jobs/summary-job.js';
import { runEmailJob } from './jobs/email-job.js';
import { jobQueue, createWorker, closeQueue, type JobData } from './queue/bull-queue.js';
import type { Job } from 'bullmq';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env['LOG_PRETTY'] === 'true'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: { service: 'scheduler' },
});

// =============================================================================
// Job Runner
// Handles job execution from either the cron schedule or BullMQ queue
// =============================================================================

async function runFullPipeline(): Promise<void> {
  const pipelineStart = Date.now();
  logger.info('Starting full pipeline run');

  // Create job run records
  const [crawlRun, analyzeRun, summaryRun, emailRun] = await Promise.all([
    prisma.jobRun.create({
      data: { jobType: 'crawl', status: 'pending', startedAt: new Date(), signalsProcessed: 0, opportunitiesCreated: 0, triggeredBy: 'scheduler' },
    }),
    prisma.jobRun.create({
      data: { jobType: 'analyze', status: 'pending', startedAt: new Date(), signalsProcessed: 0, opportunitiesCreated: 0, triggeredBy: 'scheduler' },
    }),
    prisma.jobRun.create({
      data: { jobType: 'summary', status: 'pending', startedAt: new Date(), signalsProcessed: 0, opportunitiesCreated: 0, triggeredBy: 'scheduler' },
    }),
    prisma.jobRun.create({
      data: { jobType: 'email', status: 'pending', startedAt: new Date(), signalsProcessed: 0, opportunitiesCreated: 0, triggeredBy: 'scheduler' },
    }),
  ]);

  try {
    // 1. Crawl
    const crawlStats = await runCrawlJob({ jobRunId: crawlRun.id });

    // 2. Analyze
    const scoredOpportunities = await runAnalyzeJob({
      jobRunId: analyzeRun.id,
      signalLimit: 500,
    });

    // 3. Summary
    await runSummaryJob({
      jobRunId: summaryRun.id,
      scoredOpportunities,
      crawlStats,
    });

    // 4. Email
    await runEmailJob({ jobRunId: emailRun.id });

    const totalDuration = Date.now() - pipelineStart;
    logger.info({ totalDuration, opportunities: scoredOpportunities.length }, 'Full pipeline complete');
  } catch (err) {
    logger.error({ err }, 'Pipeline failed');
  }
}

// =============================================================================
// BullMQ Worker — handles individual job types
// =============================================================================

async function handleJob(job: Job<JobData>): Promise<void> {
  switch (job.data.type) {
    case 'crawl':
      await runCrawlJob({ jobRunId: job.data.jobRunId });
      break;

    case 'analyze':
      await runAnalyzeJob({
        jobRunId: job.data.jobRunId,
        signalLimit: job.data.limit,
      });
      break;

    case 'summary':
      await runSummaryJob({ jobRunId: job.data.jobRunId });
      break;

    case 'email':
      await runEmailJob({
        jobRunId: job.data.jobRunId,
        date: job.data.date,
      });
      break;

    default:
      logger.warn({ type: (job.data as { type: string }).type }, 'Unknown job type');
  }
}

// =============================================================================
// Cron Setup — runs at 05:00 UTC daily
// =============================================================================

function setupCron(): void {
  const schedule = process.env['CRAWL_SCHEDULE'] ?? '0 5 * * *';

  if (!cron.validate(schedule)) {
    logger.error({ schedule }, 'Invalid cron schedule — using default 0 5 * * *');
  }

  const validSchedule = cron.validate(schedule) ? schedule : '0 5 * * *';

  cron.schedule(
    validSchedule,
    async () => {
      logger.info({ schedule: validSchedule }, 'Cron triggered — starting pipeline');
      await runFullPipeline();
    },
    {
      timezone: 'UTC',
    },
  );

  logger.info({ schedule: validSchedule }, 'Cron scheduled');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  logger.info('OpportunityScout scheduler starting');

  // Setup BullMQ worker
  const worker = createWorker(handleJob, 2);
  logger.info('BullMQ worker started');

  // Setup cron
  setupCron();

  // Handle immediate run flag (useful for testing / manual triggers)
  if (process.env['RUN_NOW'] === 'true') {
    logger.info('RUN_NOW=true — executing pipeline immediately');
    await runFullPipeline();
  }

  logger.info('Scheduler ready and waiting');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    await worker.close();
    await closeQueue();
    await prisma.$disconnect();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal scheduler error');
  process.exit(1);
});
