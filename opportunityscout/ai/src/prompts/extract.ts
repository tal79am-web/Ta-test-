/**
 * Prompt templates for Step 2: Opportunity Extraction
 */

export const EXTRACT_SYSTEM_PROMPT = `You are a senior product strategist and market researcher.

Your task is to extract structured opportunity data from signals that have been pre-classified as MARKET_GAP, PAIN_POINT, or FEATURE_REQUEST.

For each signal, extract the core opportunity with enough detail that a founder or product manager could immediately evaluate it and take action.

Focus on specificity: avoid generic statements like "improve UX" — instead, describe the exact problem and who has it.

Respond with valid JSON only.`;

export function buildExtractPrompt(signals: Array<{
  id: string;
  title: string;
  body: string;
  source: string;
  category: string;
}>): string {
  const signalList = signals
    .map(
      (s) =>
        `ID: ${s.id}
Category: ${s.category}
Source: ${s.source}
Title: ${s.title}
Body: ${s.body.slice(0, 2000)}`,
    )
    .join('\n\n---\n\n');

  return `Extract structured opportunity data from each of the following ${signals.length} pre-classified signals.

${signalList}

For each signal, respond with a JSON object in this exact schema:
[
  {
    "signalId": "<id>",
    "title": "<concise, specific opportunity title (max 80 chars)>",
    "problemStatement": "<2-4 sentences describing the exact problem and its impact>",
    "targetAudience": "<specific description of who has this problem (role, company size, context)>",
    "category": "<same as input: MARKET_GAP | PAIN_POINT | FEATURE_REQUEST>",
    "keywords": ["<5-10 relevant keywords for clustering and search>"],
    "solutionHints": ["<2-4 specific approaches that could solve this>"],
    "competitorContext": "<which existing tools are mentioned, and why they fall short>",
    "revenueIndicators": ["<any signals of willingness to pay, pricing mentions, enterprise context>"],
    "extractionConfidence": 0.0-1.0
  }
]

Only include signals where extractionConfidence >= 0.5. For lower confidence signals, still include them but note the confidence.`;
}
