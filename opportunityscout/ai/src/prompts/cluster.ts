/**
 * Prompt templates for Step 3: Semantic Clustering
 */

export const CLUSTER_SYSTEM_PROMPT = `You are an expert at identifying patterns and grouping related concepts.

Your task is to cluster a set of opportunity extractions that describe similar or overlapping problems.
Two opportunities should be in the same cluster if they describe the same underlying market gap or pain point, even if they come from different sources or are phrased differently.

DO NOT cluster opportunities just because they are in the same industry — they must describe the same specific problem.

Respond with valid JSON only.`;

export function buildClusterPrompt(opportunities: Array<{
  id: string;
  title: string;
  problemStatement: string;
  keywords: string[];
  targetAudience: string;
}>): string {
  const oppList = opportunities
    .map(
      (o) =>
        `ID: ${o.id}
Title: ${o.title}
Problem: ${o.problemStatement}
Audience: ${o.targetAudience}
Keywords: ${o.keywords.join(', ')}`,
    )
    .join('\n\n---\n\n');

  return `Group these ${opportunities.length} opportunities into clusters of semantically related items.

${oppList}

Rules:
1. Each cluster must have a clear, specific problem theme
2. Only cluster items that describe the SAME specific problem
3. A cluster can contain a single item if it is unique
4. Choose the best title and problem statement for the cluster (may be from one item or a synthesis)

Respond with a JSON array of clusters:
[
  {
    "clusterId": "<unique-cluster-id>",
    "clusterTitle": "<best title for this cluster>",
    "clusterProblem": "<synthesized problem statement if multiple items, else the single item's>",
    "memberIds": ["<id1>", "<id2>", ...],
    "primaryId": "<id of the strongest/most representative signal>",
    "mergeRationale": "<1 sentence explaining why these are the same opportunity>"
  }
]`;
}
