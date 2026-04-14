import pino from 'pino';
import { prisma } from '@opportunityscout/db';
import type { OpportunityCluster } from './step3-cluster.js';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { step: 'score' } });

export interface OpportunityScore {
  composite: number;
  volume: number;
  marketSize: number;
  significance: number;
  urgency: number;
}

export interface ScoredOpportunity {
  clusterId: string;
  cluster: OpportunityCluster;
  score: OpportunityScore;
  opportunityId: string; // Database ID after upsert
}

// Default scoring weights (overridden by env vars)
function getWeights(): {
  volume: number;
  marketSize: number;
  significance: number;
  urgency: number;
} {
  const volume = parseFloat(process.env['SCORE_WEIGHT_VOLUME'] ?? '0.30');
  const marketSize = parseFloat(process.env['SCORE_WEIGHT_MARKET_SIZE'] ?? '0.30');
  const significance = parseFloat(process.env['SCORE_WEIGHT_SIGNIFICANCE'] ?? '0.25');
  const urgency = parseFloat(process.env['SCORE_WEIGHT_URGENCY'] ?? '0.15');

  return { volume, marketSize, significance, urgency };
}

/**
 * Step 4: Score + Rank
 *
 * Computes a composite 0–100 score for each clustered opportunity using
 * four weighted dimensions. Upserts the opportunity into the database
 * and records a score history snapshot.
 *
 * Scoring is heuristic-based (no additional AI call) for speed and cost efficiency.
 * The evidence gathered in Steps 1–3 feeds directly into the scoring functions.
 *
 * @param clusters - Clustered opportunities from Step 3
 * @returns Scored opportunities with their database IDs
 */
export async function runScoreStep(
  clusters: OpportunityCluster[],
): Promise<ScoredOpportunity[]> {
  logger.info({ count: clusters.length }, 'Starting score step');

  const minScore = parseInt(process.env['MIN_OPPORTUNITY_SCORE'] ?? '40', 10);
  const weights = getWeights();
  const today = new Date().toISOString().split('T')[0] as string;

  const results: ScoredOpportunity[] = [];

  for (const cluster of clusters) {
    try {
      const score = computeScore(cluster, weights);

      if (score.composite < minScore) {
        logger.debug(
          { title: cluster.clusterTitle, score: score.composite, minScore },
          'Opportunity below threshold, skipping',
        );
        continue;
      }

      // Get all source signals for this cluster
      const sources = [
        ...new Set(cluster.members.map((m) => {
          // Extract source from signalId prefix pattern like "reddit-abc"
          return m.signalId.split('-')[0] ?? 'unknown';
        })),
      ];

      // Aggregate keywords from all members
      const keywords = [
        ...new Set(cluster.members.flatMap((m) => m.keywords)),
      ].slice(0, 20);

      // Upsert opportunity
      const existing = await prisma.opportunity.findFirst({
        where: {
          title: { equals: cluster.clusterTitle, mode: 'insensitive' },
        },
        select: { id: true, scoreComposite: true },
      });

      const opportunityData = {
        title: cluster.clusterTitle,
        problemStatement: cluster.clusterProblem,
        targetAudience: cluster.primary.targetAudience,
        category: cluster.primary.category,
        scoreComposite: score.composite,
        scoreVolume: score.volume,
        scoreMarketSize: score.marketSize,
        scoreSignificance: score.significance,
        scoreUrgency: score.urgency,
        previousScore: existing?.scoreComposite ?? null,
        keywords,
        sources,
        solutionHints: cluster.primary.solutionHints,
        competitorContext: cluster.primary.competitorContext,
        revenueIndicators: cluster.primary.revenueIndicators,
      };

      let opportunityId: string;

      if (existing) {
        await prisma.opportunity.update({
          where: { id: existing.id },
          data: opportunityData,
        });
        opportunityId = existing.id;
      } else {
        const created = await prisma.opportunity.create({
          data: opportunityData,
        });
        opportunityId = created.id;
      }

      // Record score history snapshot
      await prisma.scoreHistory.upsert({
        where: {
          opportunityId_date: {
            opportunityId,
            date: today,
          },
        },
        create: {
          opportunityId,
          date: today,
          composite: score.composite,
          volume: score.volume,
          marketSize: score.marketSize,
          significance: score.significance,
          urgency: score.urgency,
        },
        update: {
          composite: score.composite,
          volume: score.volume,
          marketSize: score.marketSize,
          significance: score.significance,
          urgency: score.urgency,
        },
      });

      // Link signals to this opportunity
      await prisma.rawSignal.updateMany({
        where: { id: { in: cluster.memberIds } },
        data: { opportunityId },
      });

      results.push({ clusterId: cluster.clusterId, cluster, score, opportunityId });

      logger.debug(
        { title: cluster.clusterTitle, score: score.composite, opportunityId },
        'Opportunity scored and saved',
      );
    } catch (err) {
      logger.error({ err, clusterId: cluster.clusterId }, 'Failed to score cluster');
    }
  }

  // Sort by composite score descending
  results.sort((a, b) => b.score.composite - a.score.composite);

  logger.info(
    { total: results.length, aboveThreshold: results.length },
    'Score step complete',
  );

  return results;
}

/**
 * Computes a score for an opportunity cluster using heuristic signals.
 *
 * Dimension scoring:
 *
 * VOLUME: Based on signal count, average upvotes/reactions across member signals,
 *   and number of distinct sources
 *
 * MARKET SIZE: Based on revenue indicator count, pricing mentions, enterprise signals,
 *   and keyword matches for high-value markets
 *
 * SIGNIFICANCE: Based on category (MARKET_GAP scores highest), keyword significance,
 *   and cross-source presence
 *
 * URGENCY: Based on recency of signals, language indicators like "just", "now",
 *   "switching", and product launch mentions
 */
function computeScore(
  cluster: OpportunityCluster,
  weights: ReturnType<typeof getWeights>,
): OpportunityScore {
  const volume = computeVolume(cluster);
  const marketSize = computeMarketSize(cluster);
  const significance = computeSignificance(cluster);
  const urgency = computeUrgency(cluster);

  const composite =
    volume * weights.volume +
    marketSize * weights.marketSize +
    significance * weights.significance +
    urgency * weights.urgency;

  return {
    composite: Math.round(Math.min(100, Math.max(0, composite))),
    volume: Math.round(Math.min(100, Math.max(0, volume))),
    marketSize: Math.round(Math.min(100, Math.max(0, marketSize))),
    significance: Math.round(Math.min(100, Math.max(0, significance))),
    urgency: Math.round(Math.min(100, Math.max(0, urgency))),
  };
}

function computeVolume(cluster: OpportunityCluster): number {
  const memberCount = cluster.members.length;
  const sourceCount = new Set(
    cluster.members.map((m) => m.signalId.split('-')[0]),
  ).size;

  // Base score from member count (more signals = more evidence)
  const memberScore = Math.min(50, memberCount * 10);

  // Bonus for cross-source validation
  const sourceBonus = Math.min(30, sourceCount * 10);

  // Keyword richness
  const keywordScore = Math.min(20, cluster.primary.keywords.length * 2);

  return memberScore + sourceBonus + keywordScore;
}

function computeMarketSize(cluster: OpportunityCluster): number {
  const revenueCount = cluster.primary.revenueIndicators.length;
  const competitorMentions = cluster.primary.competitorContext.length > 50 ? 20 : 0;

  // Revenue signals are the strongest indicator
  const revenueScore = Math.min(60, revenueCount * 20);

  // Known high-value market keywords
  const marketKeywords = [
    'enterprise', 'b2b', 'saas', 'api', 'platform', 'infrastructure',
    'compliance', 'security', 'fintech', 'healthcare', 'legal',
  ];
  const allText = [
    cluster.clusterTitle,
    cluster.clusterProblem,
    ...cluster.primary.keywords,
  ]
    .join(' ')
    .toLowerCase();

  const marketKeywordScore = marketKeywords.filter((k) => allText.includes(k)).length * 5;

  return Math.min(100, revenueScore + competitorMentions + marketKeywordScore);
}

function computeSignificance(cluster: OpportunityCluster): number {
  // Category bonus
  const categoryBonus =
    cluster.primary.category === 'MARKET_GAP'
      ? 30
      : cluster.primary.category === 'PAIN_POINT'
      ? 20
      : 10; // FEATURE_REQUEST

  // Solution hint count (more hints = clearer opportunity)
  const solutionScore = Math.min(20, cluster.primary.solutionHints.length * 7);

  // Keyword breadth
  const keywordScore = Math.min(25, cluster.primary.keywords.length * 3);

  // Extraction confidence
  const confidenceScore = cluster.primary.extractionConfidence * 25;

  return Math.min(100, categoryBonus + solutionScore + keywordScore + confidenceScore);
}

function computeUrgency(cluster: OpportunityCluster): number {
  const allText = [
    cluster.clusterTitle,
    cluster.clusterProblem,
    ...cluster.primary.keywords,
  ]
    .join(' ')
    .toLowerCase();

  const urgencyKeywords = [
    'just', 'now', 'today', 'switching', 'migrating', 'leaving',
    'looking for', 'need', 'urgent', 'asap', 'recently', 'new',
    'launched', 'just released', 'breaking', 'deprecated',
  ];

  const urgencyMatches = urgencyKeywords.filter((k) => allText.includes(k)).length;
  const urgencyScore = Math.min(70, urgencyMatches * 10);

  // Multi-member clusters signal ongoing trend
  const trendBonus = cluster.members.length > 2 ? 20 : 0;
  const multiSourceBonus = new Set(cluster.members.map((m) => m.signalId.split('-')[0])).size > 1 ? 10 : 0;

  return Math.min(100, urgencyScore + trendBonus + multiSourceBonus);
}

// ---------------------------------------------------------------------------
// Standalone scoring helper — exported for tests and external callers
// ---------------------------------------------------------------------------

const MARKET_SIZE_MAP: Record<string, number> = { S: 1, M: 2, L: 3, XL: 4 };

/**
 * Compute a simple composite OpportunityScore from the four raw dimensions.
 *
 * Formula from the spec:
 *   OpportunityScore =
 *     (rawSignalCount × 0.30) +
 *     (marketSizeNum  × 0.35) +   // S=1, M=2, L=3, XL=4
 *     (urgencyScore   × 0.20) +
 *     (aiSuitability  × 0.15)
 *
 * @param input - Raw scoring dimensions
 */
export function computeOpportunityScore(input: {
  rawSignalCount: number;
  estimatedMarketSize: 'S' | 'M' | 'L' | 'XL';
  urgencyScore: number;
  aiSuitabilityScore: number;
}): number {
  const marketSizeNum = MARKET_SIZE_MAP[input.estimatedMarketSize] ?? 1;
  return (
    input.rawSignalCount * 0.30 +
    marketSizeNum * 0.35 +
    input.urgencyScore * 0.20 +
    input.aiSuitabilityScore * 0.15
  );
}
