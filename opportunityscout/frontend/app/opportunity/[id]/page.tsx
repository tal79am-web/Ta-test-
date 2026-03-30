import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScoreBar } from '@/components/ScoreBar';
// TrendChart is defined locally below (see InlineTrendChart wrapper)

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface ScoreHistoryPoint {
  date: string;
  composite: number;
}

interface OpportunityDetail {
  id: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  category: string;
  score: { composite: number; volume: number; marketSize: number; significance: number; urgency: number };
  sources: string[];
  signalCount: number;
  keywords: string[];
  isNew: boolean;
  isRising: boolean;
  solutionHints: string[];
  competitorContext: string;
  revenueIndicators: string[];
  createdAt: string;
  updatedAt: string;
  signals: Array<{
    id: string;
    source: string;
    url: string;
    title: string;
    score: number;
    commentCount: number;
    publishedAt: string;
    category: string;
  }>;
  scoreHistory: ScoreHistoryPoint[];
}

async function fetchOpportunity(id: string): Promise<OpportunityDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
      next: { revalidate: 300 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const opp = await fetchOpportunity(params.id);
  if (!opp) return { title: 'Opportunity Not Found' };
  return {
    title: opp.title,
    description: opp.problemStatement.slice(0, 160),
  };
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const opportunity = await fetchOpportunity(params.id);

  if (!opportunity) notFound();

  const categoryClass =
    opportunity.category === 'MARKET_GAP'
      ? 'badge-market-gap'
      : opportunity.category === 'PAIN_POINT'
      ? 'badge-pain-point'
      : 'badge-feature';

  const categoryLabel =
    opportunity.category === 'MARKET_GAP'
      ? 'Market Gap'
      : opportunity.category === 'PAIN_POINT'
      ? 'Pain Point'
      : 'Feature Request';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-sm text-secondary">
        <Link href="/opportunities" className="hover:text-brand-600 dark:hover:text-brand-400">
          Opportunities
        </Link>
        {' / '}
        <span className="text-gray-900 dark:text-gray-100 truncate">{opportunity.title}</span>
      </nav>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <span className={categoryClass}>{categoryLabel}</span>
          {opportunity.isNew && <span className="badge-new">NEW</span>}
          {opportunity.isRising && <span className="badge-rising">↑ RISING</span>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {opportunity.title}
        </h1>

        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {opportunity.problemStatement}
        </p>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#2d2d4e]">
          <p className="text-sm text-secondary">
            <span className="font-medium text-gray-700 dark:text-gray-300">Target Audience: </span>
            {opportunity.targetAudience}
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Opportunity Score</h2>
          <div className="text-right">
            <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {opportunity.score.composite}
            </span>
            <span className="text-secondary text-lg">/100</span>
          </div>
        </div>

        <div className="space-y-4">
          <ScoreBar label="Volume" value={opportunity.score.volume} showLabel />
          <ScoreBar label="Market Size" value={opportunity.score.marketSize} showLabel />
          <ScoreBar label="Significance" value={opportunity.score.significance} showLabel />
          <ScoreBar label="Urgency" value={opportunity.score.urgency} showLabel />
        </div>
      </div>

      {/* Score trend chart */}
      {opportunity.scoreHistory.length > 1 && (
        <div className="card p-6">
          <h2 className="section-title mb-4">Score Trend (7 days)</h2>
          <TrendChart data={opportunity.scoreHistory} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solution Hints */}
        <div className="card p-6">
          <h2 className="section-title mb-4">Solution Hints</h2>
          <ul className="space-y-2">
            {opportunity.solutionHints.length === 0 ? (
              <li className="text-secondary text-sm">No hints available</li>
            ) : (
              opportunity.solutionHints.map((hint, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-brand-500 mt-1">→</span>
                  <span>{hint}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Revenue Indicators */}
        <div className="card p-6">
          <h2 className="section-title mb-4">Revenue Indicators</h2>
          {opportunity.revenueIndicators.length === 0 ? (
            <p className="text-secondary text-sm">No revenue signals detected</p>
          ) : (
            <ul className="space-y-2">
              {opportunity.revenueIndicators.map((indicator, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-emerald-500 mt-1">$</span>
                  <span>{indicator}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Competitor context */}
      {opportunity.competitorContext && (
        <div className="card p-6">
          <h2 className="section-title mb-3">Competitive Context</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {opportunity.competitorContext}
          </p>
        </div>
      )}

      {/* Keywords */}
      <div className="card p-6">
        <h2 className="section-title mb-3">Keywords</h2>
        <div className="flex flex-wrap gap-2">
          {opportunity.keywords.map((kw) => (
            <span
              key={kw}
              className="px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Source Evidence */}
      <div className="card p-6">
        <h2 className="section-title mb-4">
          Source Evidence
          <span className="ml-2 text-sm font-normal text-secondary">
            {opportunity.signalCount} signals from {opportunity.sources.join(', ')}
          </span>
        </h2>

        <div className="space-y-3">
          {opportunity.signals.map((signal) => (
            <div
              key={signal.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#252540]"
            >
              <SourceIcon source={signal.source} />
              <div className="flex-1 min-w-0">
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors line-clamp-2"
                >
                  {signal.title}
                </a>
                <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
                  <span>{signal.source}</span>
                  <span>↑ {signal.score}</span>
                  <span>💬 {signal.commentCount}</span>
                  <span>{new Date(signal.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs text-secondary text-right pb-4">
        First seen: {new Date(opportunity.createdAt).toLocaleString()} ·
        Updated: {new Date(opportunity.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function SourceIcon({ source }: { source: string }) {
  const icons: Record<string, string> = {
    reddit: '🔴',
    hackernews: '🟠',
    producthunt: '🔶',
    github: '⚫',
    stackoverflow: '🟡',
    devto: '🟢',
    g2reviews: '🔷',
    indiehackers: '🔵',
  };

  return (
    <span className="text-lg" title={source}>
      {icons[source] ?? '🌐'}
    </span>
  );
}

// Inline TrendChart component (Recharts must be in a client component)
// Exported separately in components/TrendChart.tsx — this is the SSR-compatible wrapper
function TrendChart({ data }: { data: ScoreHistoryPoint[] }) {
  // We pass data as a JSON string via data attribute and render client-side
  // The actual chart is in components/TrendChart.tsx
  return (
    <div
      id="trend-chart-data"
      data-chart={JSON.stringify(data)}
      className="h-48 w-full"
    >
      <ClientTrendChart data={data} />
    </div>
  );
}

// This needs to be a separate client component in production
// For now, rendering as a simple SVG chart
function ClientTrendChart({ data }: { data: ScoreHistoryPoint[] }) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.composite));
  const min = Math.min(...data.map((d) => d.composite));
  const range = max - min || 1;

  const width = 600;
  const height = 120;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.composite - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#667eea"
        strokeWidth="2"
      />
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((d.composite - min) / range) * (height - padding * 2);
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="#667eea">
            <title>{`${d.date}: ${Math.round(d.composite)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
