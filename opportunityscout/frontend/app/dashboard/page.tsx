import type { Metadata } from 'next';
import Link from 'next/link';
import { OpportunityCard } from '@/components/OpportunityCard';
import { ExportButton } from '@/components/ExportButton';

export const metadata: Metadata = { title: 'Dashboard' };

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

async function fetchDashboardData() {
  try {
    const [opportunitiesRes, summaryRes] = await Promise.all([
      fetch(`${API_URL}/api/opportunities?limit=10&sortBy=composite&order=desc`, {
        next: { revalidate: 300 }, // 5 minute cache
      }),
      fetch(`${API_URL}/api/summaries?limit=1`, {
        next: { revalidate: 300 },
      }),
    ]);

    const opportunitiesData = opportunitiesRes.ok ? await opportunitiesRes.json() : { data: [] };
    const summaryData = summaryRes.ok ? await summaryRes.json() : { data: [] };

    return {
      opportunities: opportunitiesData.data ?? [],
      summary: summaryData.data?.[0] ?? null,
    };
  } catch {
    return { opportunities: [], summary: null };
  }
}

export default async function DashboardPage() {
  const { opportunities, summary } = await fetchDashboardData();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Today's Opportunities</h1>
          <p className="text-secondary mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            data={opportunities}
            filename={`opportunities-${new Date().toISOString().split('T')[0]}`}
          />
          <Link href="/opportunities" className="btn-secondary">
            View All
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Signals Processed"
            value={summary.totalSignalsProcessed.toLocaleString()}
            icon="📡"
          />
          <StatCard
            label="Opportunities Found"
            value={summary.totalOpportunitiesFound.toString()}
            icon="🎯"
          />
          <StatCard
            label="Top Score"
            value={
              opportunities[0]
                ? `${opportunities[0].score.composite}/100`
                : '—'
            }
            icon="⭐"
          />
          <StatCard
            label="Last Updated"
            value={new Date(summary.generatedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            icon="🕐"
          />
        </div>
      )}

      {/* Executive Summary */}
      {summary && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Executive Summary</h2>
            <Link
              href={`/summaries/${summary.date}`}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
            >
              Full report →
            </Link>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-secondary line-clamp-4">
            {extractFirstParagraph(summary.markdownContent)}
          </div>
        </div>
      )}

      {/* Opportunity Cards */}
      {opportunities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <h2 className="section-title">
            Top Opportunities
            <span className="ml-2 text-sm font-normal text-secondary">
              Ranked by composite score
            </span>
          </h2>
          <div className="grid gap-4">
            {opportunities.map(
              (
                opp: {
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
                  createdAt: string;
                },
                i: number,
              ) => (
                <OpportunityCard key={opp.id} opportunity={opp} rank={i + 1} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-secondary mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h3 className="section-title mb-2">No opportunities yet</h3>
      <p className="text-secondary mb-6">
        Run your first crawl to start discovering market opportunities.
      </p>
      <Link href="/sources" className="btn-primary">
        Check Sources
      </Link>
    </div>
  );
}

function extractFirstParagraph(markdown: string): string {
  const lines = markdown.split('\n');
  const paragraphLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('---') || line.startsWith('|')) continue;
    if (line.trim() === '') {
      if (paragraphLines.length > 0) break;
      continue;
    }
    paragraphLines.push(line.trim());
    if (paragraphLines.length >= 3) break;
  }

  return paragraphLines.join(' ') || 'No summary available.';
}
