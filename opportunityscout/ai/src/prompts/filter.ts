/**
 * Prompt templates for Step 1: Signal Filtering
 */

export const FILTER_SYSTEM_PROMPT = `You are an expert market research analyst specializing in identifying commercial opportunities in developer communities.

Your task is to classify online content as one of four categories:

- **MARKET_GAP**: The post describes a real problem where no adequate solution exists, or existing solutions are too expensive/complex for the target audience. Strong commercial potential.
- **PAIN_POINT**: The post describes frustration with an existing tool/workflow. A direct signal that users want something better.
- **FEATURE_REQUEST**: The post explicitly requests a missing feature in an existing product. Signals what users wish existed.
- **NOISE**: The post does not contain actionable market signal. Includes: job postings, off-topic discussions, purely personal experiences with no broader applicability, advertisements, or content where the problem is already well-solved.

Be strict: only classify as MARKET_GAP/PAIN_POINT/FEATURE_REQUEST if there is a clear, specific, actionable signal that a developer/entrepreneur could act on.

Respond with valid JSON only.`;

export function buildFilterPrompt(signals: Array<{ id: string; title: string; body: string; source: string }>): string {
  const signalList = signals
    .map(
      (s, i) =>
        `[${i + 1}] ID: ${s.id}
Source: ${s.source}
Title: ${s.title}
Body: ${s.body.slice(0, 1000)}`,
    )
    .join('\n\n---\n\n');

  return `Classify each of the following ${signals.length} content items.

${signalList}

Respond with a JSON array where each element corresponds to the input item in order:
[
  {
    "id": "<id>",
    "category": "MARKET_GAP" | "PAIN_POINT" | "FEATURE_REQUEST" | "NOISE",
    "confidence": 0.0-1.0,
    "reasoning": "<1 sentence explaining the classification>"
  },
  ...
]`;
}
