import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Trend } from '@/lib/posture-compare';
import { BRAND } from './ReportParts';

const STYLE: Record<Trend, { color: string; Icon: typeof TrendingUp }> = {
  better: { color: BRAND.green, Icon: TrendingUp },
  worse: { color: BRAND.red, Icon: TrendingDown },
  same: { color: '#6b7280', Icon: Minus },
};

/** "▲ +8" style change in the posture score vs the previous assessment. */
export function ScoreTrend({ change, trend, label, compact = false }: {
  change: number;
  trend: Trend;
  label: string; // e.g. "Improved" — spoken / tooltip text
  compact?: boolean;
}) {
  const { color, Icon } = STYLE[trend];
  return (
    <span className="inline-flex items-center gap-0.5 font-medium tabular-nums" style={{ color }} title={label}>
      <Icon className={compact ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden="true" />
      {trend !== 'same' && <span>{change > 0 ? `+${change}` : change}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
