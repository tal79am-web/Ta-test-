import pino from 'pino';
import client, { MODEL, MAX_TOKENS } from '../client.js';
import { SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt } from '../prompts/summary.js';
import { prisma } from '@opportunityscout/db';
import type { ScoredOpportunity } from '../pipeline/step4-score.js';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { step: 'summary' } });

export interface SummaryResult {
  date: string;
  markdownContent: string;
  topOpportunityIds: string[];
  totalSignalsProcessed: number;
  totalOpportunitiesFound: number;
}

/**
 * Generates the daily executive summary from today's top scored opportunities.
 *
 * The summary is persisted to the DailySummary table and can be:
 * 1. Served via the /api/summaries/:date endpoint
 * 2. Emailed via Resend in the email job
 * 3. Displayed on the dashboard
 *
 * @param scoredOpportunities - Today's scored opportunities from Step 4
 * @param stats - Crawl statistics for context
 */
export async function generateDailySummary(
  scoredOpportunities: ScoredOpportunity[],
  stats: {
    totalSignalsProcessed: number;
    bySource: Record<string, number>;
  },
): Promise<SummaryResult> {
  const today = new Date().toISOString().split('T')[0] as string;

  logger.info({ date: today, opportunityCount: scoredOpportunities.length }, 'Generating summary');

  if (scoredOpportunities.length === 0) {
    const emptyContent = buildEmptySummary(today, stats.totalSignalsProcessed);
    const result: SummaryResult = {
      date: today,
      markdownContent: emptyContent,
      topOpportunityIds: [],
      totalSignalsProcessed: stats.totalSignalsProcessed,
      totalOpportunitiesFound: 0,
    };

    await persistSummary(result);
    return result;
  }

  // Get signal counts by category for context
  const byCategoryRaw = await prisma.rawSignal.groupBy({
    by: ['category'],
    where: {
      category: { not: null },
      crawledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    _count: { id: true },
  });

  const byCategory = Object.fromEntries(
    byCategoryRaw.map((r) => [r.category ?? 'UNKNOWN', r._count.id]),
  );

  // Build prompt input from top 5 opportunities
  const topOpportunities = scoredOpportunities.slice(0, 5).map((so) => ({
    title: so.cluster.clusterTitle,
    score: so.score.composite,
    category: so.cluster.primary.category,
    problemStatement: so.cluster.clusterProblem,
    targetAudience: so.cluster.primary.targetAudience,
    sources: [
      ...new Set(so.cluster.members.map((m) => m.signalId.split('-')[0] ?? 'unknown')),
    ],
    signalCount: so.cluster.members.length,
    solutionHints: so.cluster.primary.solutionHints,
    revenueIndicators: so.cluster.primary.revenueIndicators,
    competitorContext: so.cluster.primary.competitorContext,
    keywords: so.cluster.primary.keywords,
  }));

  const prompt = buildSummaryPrompt({
    date: today,
    topOpportunities,
    stats: {
      totalSignals: stats.totalSignalsProcessed,
      totalOpportunities: scoredOpportunities.length,
      bySource: stats.bySource,
      byCategory,
    },
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response from Anthropic for summary generation');
  }

  const result: SummaryResult = {
    date: today,
    markdownContent: content.text,
    topOpportunityIds: scoredOpportunities.slice(0, 10).map((so) => so.opportunityId),
    totalSignalsProcessed: stats.totalSignalsProcessed,
    totalOpportunitiesFound: scoredOpportunities.length,
  };

  await persistSummary(result);

  logger.info({ date: today }, 'Summary generated and saved');
  return result;
}

async function persistSummary(result: SummaryResult): Promise<void> {
  await prisma.dailySummary.upsert({
    where: { date: result.date },
    create: {
      date: result.date,
      markdownContent: result.markdownContent,
      topOpportunityIds: result.topOpportunityIds,
      totalSignalsProcessed: result.totalSignalsProcessed,
      totalOpportunitiesFound: result.totalOpportunitiesFound,
      emailSent: false,
    },
    update: {
      markdownContent: result.markdownContent,
      topOpportunityIds: result.topOpportunityIds,
      totalSignalsProcessed: result.totalSignalsProcessed,
      totalOpportunitiesFound: result.totalOpportunitiesFound,
    },
  });
}

function buildEmptySummary(date: string, signalsProcessed: number): string {
  return `# OpportunityScout Daily Summary — ${date}

## No Opportunities Found Today

The crawl processed **${signalsProcessed} signals** but found no opportunities above the minimum score threshold.

This may indicate:
- All discovered content was classified as noise
- The minimum score threshold is set too high (check \`MIN_OPPORTUNITY_SCORE\`)
- Crawlers may have encountered errors (check the Sources health page)

---

*Check the Sources page for crawler health status.*`;
}
