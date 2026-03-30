import pino from 'pino';
import client, { MODEL, MAX_TOKENS, TEMPERATURE } from '../client.js';
import { CLUSTER_SYSTEM_PROMPT, buildClusterPrompt } from '../prompts/cluster.js';
import type { ExtractedOpportunity } from './step2-extract.js';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', base: { step: 'cluster' } });

export interface OpportunityCluster {
  clusterId: string;
  clusterTitle: string;
  clusterProblem: string;
  memberIds: string[];    // signal IDs
  primaryId: string;      // signal ID of the primary/representative extraction
  mergeRationale: string;
  // Enriched with data from primary extraction
  primary: ExtractedOpportunity;
  members: ExtractedOpportunity[];
}

/**
 * Step 3: Cluster + Deduplicate
 *
 * Groups semantically similar extracted opportunities together.
 * If clustering is disabled (ENABLE_CLUSTERING=false), each extraction
 * becomes its own cluster.
 *
 * @param extractions - Extracted opportunities from Step 2
 * @returns Clusters of related opportunities
 */
export async function runClusterStep(
  extractions: ExtractedOpportunity[],
): Promise<OpportunityCluster[]> {
  logger.info({ count: extractions.length }, 'Starting cluster step');

  if (extractions.length === 0) {
    logger.info('No extractions to cluster');
    return [];
  }

  // If clustering is disabled, each extraction is its own cluster
  if (process.env['ENABLE_CLUSTERING'] === 'false') {
    logger.info('Clustering disabled — each extraction is its own cluster');
    return extractions.map((e) => ({
      clusterId: `cluster-${e.signalId}`,
      clusterTitle: e.title,
      clusterProblem: e.problemStatement,
      memberIds: [e.signalId],
      primaryId: e.signalId,
      mergeRationale: 'No clustering applied',
      primary: e,
      members: [e],
    }));
  }

  try {
    const rawClusters = await callClusteringAPI(extractions);
    const enriched = enrichClusters(rawClusters, extractions);

    logger.info(
      {
        inputCount: extractions.length,
        clusterCount: enriched.length,
        avgMerge: (extractions.length / enriched.length).toFixed(2),
      },
      'Cluster step complete',
    );

    return enriched;
  } catch (err) {
    logger.error({ err }, 'Clustering API call failed — falling back to no-cluster mode');

    // Fallback: no clustering
    return extractions.map((e) => ({
      clusterId: `cluster-${e.signalId}`,
      clusterTitle: e.title,
      clusterProblem: e.problemStatement,
      memberIds: [e.signalId],
      primaryId: e.signalId,
      mergeRationale: 'Fallback — clustering unavailable',
      primary: e,
      members: [e],
    }));
  }
}

async function callClusteringAPI(
  extractions: ExtractedOpportunity[],
): Promise<Array<{
  clusterId: string;
  clusterTitle: string;
  clusterProblem: string;
  memberIds: string[];
  primaryId: string;
  mergeRationale: string;
}>> {
  // Build lightweight representation for clustering prompt
  const summaries = extractions.map((e) => ({
    id: e.signalId,
    title: e.title,
    problemStatement: e.problemStatement,
    keywords: e.keywords,
    targetAudience: e.targetAudience,
  }));

  const prompt = buildClusterPrompt(summaries);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.1, // Lower temperature for more deterministic clustering
    system: CLUSTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response from Anthropic');
  }

  const jsonStr = content.text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  return JSON.parse(jsonStr);
}

function enrichClusters(
  rawClusters: Array<{
    clusterId: string;
    clusterTitle: string;
    clusterProblem: string;
    memberIds: string[];
    primaryId: string;
    mergeRationale: string;
  }>,
  extractions: ExtractedOpportunity[],
): OpportunityCluster[] {
  const extractionMap = new Map(extractions.map((e) => [e.signalId, e]));

  return rawClusters
    .map((cluster) => {
      const primary = extractionMap.get(cluster.primaryId);
      if (!primary) {
        logger.warn({ clusterId: cluster.clusterId }, 'Primary extraction not found for cluster');
        return null;
      }

      const members = cluster.memberIds
        .map((id) => extractionMap.get(id))
        .filter((e): e is ExtractedOpportunity => e !== undefined);

      return {
        ...cluster,
        primary,
        members,
      };
    })
    .filter((c): c is OpportunityCluster => c !== null);
}
