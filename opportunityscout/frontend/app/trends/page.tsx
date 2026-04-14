'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface Opportunity {
  id: string;
  title: string;
  score: { composite: number };
}

interface ScorePoint {
  date: string;
  [key: string]: number | string;
}

// Color palette for trend lines
const COLORS = [
  '#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899',
];

export default function TrendsPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [chartData, setChartData] = useState<ScorePoint[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch top 20 opportunities
        const res = await fetch(`${API_URL}/api/opportunities?limit=20&sortBy=composite&order=desc`);
        if (!res.ok) throw new Error('Failed to fetch opportunities');
        const data = await res.json();
        const opps: Opportunity[] = data.data ?? [];
        setOpportunities(opps);

        // Default: show top 5
        const top5Ids = opps.slice(0, 5).map((o: Opportunity) => o.id);
        setSelected(top5Ids);

        // Fetch score history for each
        const historyResults = await Promise.all(
          top5Ids.map((id: string) =>
            fetch(`${API_URL}/api/opportunities/${id}`)
              .then((r) => r.json())
              .then((d) => ({ id, history: d.scoreHistory ?? [] })),
          ),
        );

        // Merge into a single chart dataset keyed by date
        const dateMap = new Map<string, ScorePoint>();

        for (const { id, history } of historyResults) {
          const opp = opps.find((o: Opportunity) => o.id === id);
          if (!opp) continue;

          const shortTitle = opp.title.slice(0, 30);

          for (const point of history) {
            const existing: ScorePoint = dateMap.get(point.date) ?? { date: point.date };
            existing[shortTitle] = Math.round(point.composite);
            dateMap.set(point.date, existing);
          }
        }

        const sorted = Array.from(dateMap.values()).sort((a, b) =>
          (a.date as string).localeCompare(b.date as string),
        );

        setChartData(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const opportunityNames = opportunities
    .filter((o) => selected.includes(o.id))
    .map((o) => o.title.slice(0, 30));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Trends</h1>
        <p className="text-secondary mt-1">
          Week-over-week score momentum for top opportunities
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-secondary">Loading trend data...</div>
      ) : error ? (
        <div className="card p-8 text-center text-danger">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="card p-8 text-center text-secondary">
          No trend data available yet. Run the analysis pipeline to generate score history.
        </div>
      ) : (
        <>
          {/* Main trend chart */}
          <div className="card p-6">
            <h2 className="section-title mb-6">Score History</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {opportunityNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Opportunity selector */}
          <div className="card p-6">
            <h2 className="section-title mb-4">Select Opportunities to Compare</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opportunities.map((opp, i) => (
                <label
                  key={opp.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-[#2d2d4e] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#252540] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opp.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected((s) => [...s, opp.id].slice(0, 8));
                      } else {
                        setSelected((s) => s.filter((id) => id !== opp.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{opp.title}</p>
                    <p className="text-xs text-secondary">Score: {opp.score.composite}</p>
                  </div>
                </label>
              ))}
            </div>
            {selected.length === 8 && (
              <p className="text-xs text-secondary mt-3">Maximum 8 opportunities can be compared at once.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
