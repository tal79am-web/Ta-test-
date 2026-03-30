import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sources' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface SourceStatus {
  source: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  signalsLastRun: number;
  totalSignals: number;
  errorMessage: string | null;
}

async function fetchSources(): Promise<SourceStatus[]> {
  try {
    const res = await fetch(`${API_URL}/api/sources`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

const SOURCE_LABELS: Record<string, { label: string; url: string; description: string }> = {
  reddit: {
    label: 'Reddit',
    url: 'https://reddit.com',
    description: 'r/entrepreneur, r/startups, r/SaaS, r/smallbusiness, r/webdev',
  },
  hackernews: {
    label: 'Hacker News',
    url: 'https://news.ycombinator.com',
    description: 'Ask HN, Show HN, Front page top stories',
  },
  producthunt: {
    label: 'Product Hunt',
    url: 'https://producthunt.com',
    description: 'Daily launches + high-vote comments',
  },
  github: {
    label: 'GitHub',
    url: 'https://github.com',
    description: 'Trending repos + feature-request labeled issues',
  },
  stackoverflow: {
    label: 'Stack Overflow',
    url: 'https://stackoverflow.com',
    description: 'High-view unanswered developer questions',
  },
  devto: {
    label: 'Dev.to',
    url: 'https://dev.to',
    description: 'Pain point articles about developer tooling',
  },
  g2reviews: {
    label: 'G2 Reviews',
    url: 'https://g2.com',
    description: '1–2 star reviews of popular SaaS tools',
  },
  indiehackers: {
    label: 'IndieHackers',
    url: 'https://indiehackers.com',
    description: 'Co-founder searches, revenue milestones, pain point discussions',
  },
};

export default async function SourcesPage() {
  const sources = await fetchSources();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Source Health</h1>
        <p className="text-secondary mt-1">
          Status of each crawler and signal collection statistics
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold">{sources.filter((s) => s.enabled).length}</p>
          <p className="text-xs text-secondary mt-1">Active Sources</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {sources.filter((s) => s.lastRunStatus === 'completed').length}
          </p>
          <p className="text-xs text-secondary mt-1">Last Run OK</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {sources.filter((s) => s.lastRunStatus === 'failed').length}
          </p>
          <p className="text-xs text-secondary mt-1">Last Run Failed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold">
            {sources.reduce((sum, s) => sum + s.totalSignals, 0).toLocaleString()}
          </p>
          <p className="text-xs text-secondary mt-1">Total Signals</p>
        </div>
      </div>

      {/* Source cards */}
      {sources.length === 0 ? (
        <div className="card p-8 text-center text-secondary">
          No source data available. Run the application and wait for the first crawl.
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => {
            const info = SOURCE_LABELS[source.source] ?? {
              label: source.source,
              url: '#',
              description: '',
            };

            const statusColor =
              !source.enabled
                ? 'text-gray-400 dark:text-gray-600'
                : source.lastRunStatus === 'completed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : source.lastRunStatus === 'failed'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-400';

            const statusLabel =
              !source.enabled
                ? 'Disabled'
                : source.lastRunStatus === 'completed'
                ? 'OK'
                : source.lastRunStatus === 'failed'
                ? 'Failed'
                : 'Not run yet';

            return (
              <div key={source.source} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {info.label}
                      </a>
                      <span className={`text-sm font-medium ${statusColor}`}>
                        ● {statusLabel}
                      </span>
                      {!source.enabled && (
                        <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-500">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-secondary mt-1">{info.description}</p>

                    {source.errorMessage && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Error: {source.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {source.totalSignals.toLocaleString()}
                    </div>
                    <div className="text-xs text-secondary">total signals</div>

                    {source.signalsLastRun > 0 && (
                      <div className="mt-1">
                        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          +{source.signalsLastRun}
                        </div>
                        <div className="text-xs text-secondary">last run</div>
                      </div>
                    )}
                  </div>
                </div>

                {source.lastRunAt && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2d2d4e]">
                    <p className="text-xs text-secondary">
                      Last crawled:{' '}
                      {new Date(source.lastRunAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
