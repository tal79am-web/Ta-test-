// AI package main exports

export { runFilterStep } from './pipeline/step1-filter.js';
export { runExtractStep } from './pipeline/step2-extract.js';
export { runClusterStep } from './pipeline/step3-cluster.js';
export { runScoreStep } from './pipeline/step4-score.js';
export { generateDailySummary } from './summary/generator.js';

export type { FilterResult, SignalCategory } from './pipeline/step1-filter.js';
export type { ExtractedOpportunity } from './pipeline/step2-extract.js';
export type { OpportunityCluster } from './pipeline/step3-cluster.js';
export type { OpportunityScore, ScoredOpportunity } from './pipeline/step4-score.js';
export type { SummaryResult } from './summary/generator.js';
