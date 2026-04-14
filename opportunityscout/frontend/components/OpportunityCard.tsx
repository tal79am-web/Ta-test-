import Link from 'next/link';
import { clsx } from 'clsx';
import { ScoreBar } from './ScoreBar';

interface OpportunityScore {
  composite: number;
  volume: number;
  marketSize: number;
  significance: number;
  urgency: number;
}

interface Opportunity {
  id: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  category: string;
  score: OpportunityScore;
  sources: string[];
  signalCount: number;
  keywords: string[];
  isNew: boolean;
  isRising: boolean;
  createdAt: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  rank?: number;
}

const CATEGORY_STYLES: Record<string, string> = {
  MARKET_GAP: 'badge-market-gap',
  PAIN_POINT: 'badge-pain-point',
  FEATURE_REQUEST: 'badge-feature',
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKET_GAP: 'Market Gap',
  PAIN_POINT: 'Pain Point',
  FEATURE_REQUEST: 'Feature Request',
};

const SOURCE_ICONS: Record<string, string> = {
  reddit: '🔴',
  hackernews: '🟠',
  producthunt: '🔶',
  github: '⚫',
  stackoverflow: '🟡',
  devto: '🟢',
  g2reviews: '🔷',
  indiehackers: '🔵',
};

export function OpportunityCard({ opportunity: opp, rank }: OpportunityCardProps) {
  const compositeColor =
    opp.score.composite >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : opp.score.composite >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <Link href={`/opportunity/${opp.id}`} className="block group">
      <div className="card p-5 hover:shadow-md transition-shadow duration-200 hover:border-brand-200 dark:hover:border-brand-800">
        <div className="flex gap-4">
          {/* Rank indicator */}
          {rank !== undefined && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-sm font-bold text-secondary">#{rank}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {opp.category in CATEGORY_STYLES && (
                <span className={CATEGORY_STYLES[opp.category]}>
                  {CATEGORY_LABELS[opp.category] ?? opp.category}
                </span>
              )}
              {opp.isNew && (
                <span className="badge-new">
                  ✦ NEW
                </span>
              )}
              {opp.isRising && (
                <span className="badge-rising">
                  ↑ RISING
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors mb-2 line-clamp-2">
              {opp.title}
            </h3>

            {/* Problem statement */}
            <p className="text-sm text-secondary line-clamp-2 mb-3">
              {opp.problemStatement}
            </p>

            {/* Score bars */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
              <ScoreBar label="Volume" value={opp.score.volume} size="sm" />
              <ScoreBar label="Market Size" value={opp.score.marketSize} size="sm" />
              <ScoreBar label="Significance" value={opp.score.significance} size="sm" />
              <ScoreBar label="Urgency" value={opp.score.urgency} size="sm" />
            </div>

            {/* Footer: sources + keywords */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1">
                {opp.sources.slice(0, 5).map((source) => (
                  <span key={source} title={source} className="text-sm">
                    {SOURCE_ICONS[source] ?? '🌐'}
                  </span>
                ))}
                <span className="text-xs text-secondary ml-1">
                  {opp.signalCount} signals
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {opp.keywords.slice(0, 3).map((kw) => (
                  <span key={kw} className="text-xs text-secondary">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Composite score */}
          <div className="flex-shrink-0 text-right">
            <div className={clsx('text-3xl font-bold tabular-nums', compositeColor)}>
              {opp.score.composite}
            </div>
            <div className="text-xs text-secondary">/100</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
