import { Queue, Worker, type Job } from 'bullmq';
import pino from 'pino';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { module: 'bull-queue' } });

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

const connection = parseRedisUrl(REDIS_URL);

export const QUEUE_NAME = 'opportunityscout-jobs';

// Job data types
export interface CrawlJobData {
  type: 'crawl';
  jobRunId?: string;
}

export interface AnalyzeJobData {
  type: 'analyze';
  jobRunId?: string;
  limit?: number;
}

export interface SummaryJobData {
  type: 'summary';
  jobRunId?: string;
}

export interface EmailJobData {
  type: 'email';
  jobRunId?: string;
  date?: string;
}

export type JobData = CrawlJobData | AnalyzeJobData | SummaryJobData | EmailJobData;

/**
 * BullMQ queue instance for enqueueing jobs.
 */
export const jobQueue = new Queue<JobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30_000, // 30 seconds base
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Enqueues a job immediately.
 */
export async function enqueueJob(data: JobData, options?: { priority?: number }): Promise<string> {
  const job = await jobQueue.add(data.type, data, {
    priority: options?.priority,
  });
  logger.info({ jobId: job.id, type: data.type }, 'Job enqueued');
  return job.id ?? '';
}

/**
 * Creates a BullMQ worker that processes jobs using the provided handler function.
 */
export function createWorker(
  handler: (job: Job<JobData>) => Promise<void>,
  concurrency = 1,
): Worker<JobData> {
  const worker = new Worker<JobData>(
    QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, type: job.name }, 'Processing job');
      await handler(job);
      logger.info({ jobId: job.id, type: job.name }, 'Job completed');
    },
    {
      connection,
      concurrency,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, type: job?.name, err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}

/**
 * Gracefully closes the queue and all workers.
 */
export async function closeQueue(): Promise<void> {
  await jobQueue.close();
  logger.info('Queue closed');
}
