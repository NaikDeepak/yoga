import { formatDueDate } from '@/lib/dates';
import { chartPoints, type DatedValue } from '@/lib/progress';

const W = 300, H = 110;
const PAD = { top: 10, right: 12, bottom: 22, left: 30 };
const PLOT_W = W - PAD.left - PAD.right, PLOT_H = H - PAD.top - PAD.bottom;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Small line chart rendered on the server as plain SVG (no JavaScript, light on budget phones), for the
 * client's progress page. Points are spaced true to time; gaps in the series break the line. Fixed
 * `min`/`max` (e.g. pain 0–10) keep charts comparable; without them the data's own range is used.
 */
export function TrendChart({
  series, label, color, min, max,
}: { series: DatedValue[]; label: string; color: string; min?: number; max?: number }) {
  const c = chartPoints(series, { width: PLOT_W, height: PLOT_H, min, max });
  if (!c.points.length) return null;
  const first = c.points[0], last = c.points[c.points.length - 1];
  // Short, language-neutral summary for screen readers (not every point of a 30-day series).
  const summary = `${label}: ${formatDueDate(first.date)} ${fmt(first.value)} → ${formatDueDate(last.date)} ${fmt(last.value)}`;

  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium text-muted-foreground">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={summary}>
        <g fill="currentColor" className="text-muted-foreground" fontSize="10">
          <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">{fmt(c.max)}</text>
          <text x={PAD.left - 6} y={PAD.top + PLOT_H} textAnchor="end">{fmt(c.min)}</text>
          <text x={PAD.left} y={H - 6}>{formatDueDate(first.date)}</text>
          {last.date !== first.date && <text x={W - PAD.right} y={H - 6} textAnchor="end">{formatDueDate(last.date)}</text>}
        </g>
        <g stroke="currentColor" className="text-border" strokeWidth="1">
          <line x1={PAD.left} y1={PAD.top} x2={W - PAD.right} y2={PAD.top} strokeDasharray="2 3" />
          <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={W - PAD.right} y2={PAD.top + PLOT_H} />
        </g>
        <g transform={`translate(${PAD.left} ${PAD.top})`}>
          {c.segments.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* Index keys: two visits can share a day. */}
          {c.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />)}
        </g>
      </svg>
    </figure>
  );
}
