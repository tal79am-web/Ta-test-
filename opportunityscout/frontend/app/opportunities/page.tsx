'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ScoreBar } from '@/components/ScoreBar';
import { ExportButton } from '@/components/ExportButton';

type Category = 'MARKET_GAP' | 'PAIN_POINT' | 'FEATURE_REQUEST' | 'NOISE';
type Source = 'reddit' | 'hackernews' | 'producthunt' | 'github' | 'stackoverflow' | 'devto' | 'g2reviews' | 'indiehackers';
type SortBy = 'composite' | 'volume' | 'marketSize' | 'significance' | 'urgency' | 'createdAt';

interface Opportunity {
  id: string;
  title: string;
  problemStatement: string;
  targetAudience: string;
  category: Category;
  score: { composite: number; volume: number; marketSize: number; significance: number; urgency: number };
  sources: Source[];
  signalCount: number;
  keywords: string[];
  isNew: boolean;
  isRising: boolean;
  createdAt: string;
}

interface PaginatedResponse {
  data: Opportunity[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';

const CATEGORY_LABELS: Record<Category, string> = {
  MARKET_GAP: 'Market Gap',
  PAIN_POINT: 'Pain Point',
  FEATURE_REQUEST: 'Feature Request',
  NOISE: 'Noise',
};

const SORT_LABELS: Record<SortBy, string> = {
  composite: 'Overall Score',
  volume: 'Volume',
  marketSize: 'Market Size',
  significance: 'Significance',
  urgency: 'Urgency',
  createdAt: 'Date Found',
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('composite');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [category, setCategory] = useState<Category | ''>('');
  const [minScore, setMinScore] = useState('');
  const [page, setPage] = useState(1);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      sortBy,
      order,
    });

    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (minScore) params.set('minScore', minScore);

    try {
      const res = await fetch(`${API_URL}/api/opportunities?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: PaginatedResponse = await res.json();
      setOpportunities(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, order, search, category, minScore]);

  useEffect(() => {
    void fetchOpportunities();
  }, [fetchOpportunities]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sortBy, order, category, minScore]);

  function toggleSort(field: SortBy) {
    if (sortBy === field) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">All Opportunities</h1>
          <p className="text-secondary mt-1">
            {pagination.total.toLocaleString()} total opportunities
          </p>
        </div>
        <ExportButton data={opportunities} filename="opportunities" />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="search"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | '')}
            className="input"
          >
            <option value="">All Categories</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).filter((c) => c !== 'NOISE').map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Min score (0-100)"
            value={minScore}
            min={0}
            max={100}
            onChange={(e) => setMinScore(e.target.value)}
            className="input"
          />

          <select
            value={`${sortBy}_${order}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('_') as [SortBy, 'asc' | 'desc'];
              setSortBy(field);
              setOrder(dir);
            }}
            className="input"
          >
            {(Object.keys(SORT_LABELS) as SortBy[]).map((field) => (
              <>
                <option key={`${field}_desc`} value={`${field}_desc`}>
                  {SORT_LABELS[field]} ↓
                </option>
                <option key={`${field}_asc`} value={`${field}_asc`}>
                  {SORT_LABELS[field]} ↑
                </option>
              </>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="card p-8 text-center text-danger">{error}</div>
      ) : opportunities.length === 0 ? (
        <div className="card p-8 text-center text-secondary">No opportunities match your filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-[#2d2d4e] bg-gray-50 dark:bg-[#252540]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-secondary w-1/3">Opportunity</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary">Category</th>
                  <th
                    className="text-right px-4 py-3 font-medium text-secondary cursor-pointer hover:text-brand-600"
                    onClick={() => toggleSort('composite')}
                  >
                    Score {sortBy === 'composite' && (order === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-secondary hidden lg:table-cell">Sources</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary hidden xl:table-cell">Keywords</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#2d2d4e]">
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-[#252540] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/opportunity/${opp.id}`} className="group">
                        <div className="flex items-start gap-2">
                          {opp.isNew && <span className="badge-new mt-0.5">NEW</span>}
                          {opp.isRising && <span className="badge-rising mt-0.5">↑</span>}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                              {opp.title}
                            </p>
                            <p className="text-secondary text-xs mt-0.5 line-clamp-1">
                              {opp.targetAudience}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={opp.category} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                          {opp.score.composite}
                        </span>
                        <div className="w-20">
                          <ScoreBar value={opp.score.composite} showLabel={false} size="sm" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {opp.sources.slice(0, 3).map((s) => (
                          <span key={s} className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {s}
                          </span>
                        ))}
                        {opp.sources.length > 3 && (
                          <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-500">
                            +{opp.sources.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {opp.keywords.slice(0, 3).map((k) => (
                          <span key={k} className="text-xs text-secondary">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-secondary text-xs whitespace-nowrap">
                      {new Date(opp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#2d2d4e]">
              <p className="text-sm text-secondary">
                Showing {((page - 1) * pagination.limit) + 1}–
                {Math.min(page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="btn-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const cls =
    category === 'MARKET_GAP'
      ? 'badge-market-gap'
      : category === 'PAIN_POINT'
      ? 'badge-pain-point'
      : 'badge-feature';

  return <span className={cls}>{CATEGORY_LABELS[category]}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-gray-100 dark:divide-[#2d2d4e]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="px-4 py-3 animate-pulse">
            <div className="flex gap-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/8 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
