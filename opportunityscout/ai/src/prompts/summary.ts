/**
 * Prompt templates for daily executive summary generation.
 */

export const SUMMARY_SYSTEM_PROMPT = `You are an expert market analyst writing a daily briefing for a technical founder or product manager.

Your summaries are:
- Concise and actionable (not padded with generic market commentary)
- Specific: you name the exact problem, the exact audience, and the exact signal
- Honest about confidence levels — you flag when a signal is weak or a trend is uncertain
- Formatted in clean Markdown

Respond with a complete Markdown document.`;

export function buildSummaryPrompt(input: {
  date: string;
  topOpportunities: Array<{
    title: string;
    score: number;
    category: string;
    problemStatement: string;
    targetAudience: string;
    sources: string[];
    signalCount: number;
    solutionHints: string[];
    revenueIndicators: string[];
    competitorContext: string;
    keywords: string[];
  }>;
  stats: {
    totalSignals: number;
    totalOpportunities: number;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
  };
}): string {
  const oppSections = input.topOpportunities
    .slice(0, 5)
    .map(
      (opp, i) => `Opportunity ${i + 1}:
- Title: ${opp.title}
- Score: ${opp.score}/100
- Category: ${opp.category}
- Sources: ${opp.sources.join(', ')} (${opp.signalCount} signals)
- Problem: ${opp.problemStatement}
- Target Audience: ${opp.targetAudience}
- Solution Hints: ${opp.solutionHints.join('; ')}
- Revenue Signals: ${opp.revenueIndicators.join('; ') || 'None identified'}
- Competitor Context: ${opp.competitorContext || 'None identified'}
- Keywords: ${opp.keywords.join(', ')}`,
    )
    .join('\n\n');

  const sourceStats = Object.entries(input.stats.bySource)
    .map(([src, count]) => `- ${src}: ${count} signals`)
    .join('\n');

  return `Generate a daily opportunity briefing for ${input.date}.

## Stats
- Total signals processed today: ${input.stats.totalSignals}
- Opportunities identified: ${input.stats.totalOpportunities}
- By category: ${JSON.stringify(input.stats.byCategory)}

## Source Breakdown
${sourceStats}

## Top Opportunities (most important first)
${oppSections}

Write a Markdown briefing document with:
1. A brief executive overview (2-3 sentences)
2. A section for each top opportunity with:
   - Score and category badge
   - Clear problem description
   - Who to build for
   - Quick win ideas
   - Revenue potential assessment
   - Any warnings about signal quality
3. A "Source Performance" table
4. A "Trends to Watch" section (patterns you notice across multiple opportunities)

Keep the tone direct and analytical. This is for a busy technical founder who reads fast.`;
}
