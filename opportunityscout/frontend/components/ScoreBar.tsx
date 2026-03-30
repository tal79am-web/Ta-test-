import { clsx } from 'clsx';

interface ScoreBarProps {
  value: number;           // 0–100
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * ScoreBar — visual representation of a 0-100 score.
 *
 * Color thresholds:
 * - 0–39: red
 * - 40–59: amber
 * - 60–74: yellow
 * - 75–89: emerald
 * - 90–100: green
 */
export function ScoreBar({
  value,
  label,
  showLabel = true,
  size = 'md',
  className,
}: ScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const percentage = clamped;

  const fillColor =
    clamped >= 90
      ? 'bg-green-500'
      : clamped >= 75
      ? 'bg-emerald-500'
      : clamped >= 60
      ? 'bg-yellow-400'
      : clamped >= 40
      ? 'bg-amber-500'
      : 'bg-red-500';

  const scoreTextColor =
    clamped >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : clamped >= 40
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (label !== undefined || value !== undefined) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
          )}
          <span className={clsx('text-sm font-semibold tabular-nums', scoreTextColor)}>
            {clamped}
          </span>
        </div>
      )}
      <div className={clsx('score-bar-track', barHeight)}>
        <div
          className={clsx('score-bar-fill', fillColor)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ? `${label}: ${clamped}/100` : `Score: ${clamped}/100`}
        />
      </div>
    </div>
  );
}

/**
 * MiniScoreBar — compact inline version for use in tables.
 */
export function MiniScoreBar({ value }: { value: number }) {
  return (
    <ScoreBar
      value={value}
      showLabel={false}
      size="sm"
      className="w-16"
    />
  );
}
