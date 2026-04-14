'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ScoreHistoryPoint {
  date: string;
  composite: number;
}

interface TrendChartProps {
  data: ScoreHistoryPoint[];
}

/**
 * TrendChart — displays an opportunity's composite score over time.
 * Uses Recharts for interactive hover tooltips.
 * Must be a client component due to Recharts requiring browser APIs.
 */
export function TrendChart({ data }: TrendChartProps) {
  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-secondary text-sm">
        Not enough history to show a trend (need at least 2 data points).
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    score: Math.round(d.composite),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 11 }}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number) => [`${value}/100`, 'Score']}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#667eea"
          strokeWidth={2}
          dot={{ r: 4, fill: '#667eea' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
