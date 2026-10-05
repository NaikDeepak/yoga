// Client progress report helpers (spec 2026-10-05-progress-report-link): first → latest values and
// the points for the server-rendered SVG charts. Dates are 'YYYY-MM-DD'.

export interface DatedValue { date: string; value: number | null }
export interface Recorded { date: string; value: number }

const round1 = (n: number) => Math.round(n * 10) / 10;
const recorded = (series: DatedValue[]) => series.filter((p): p is Recorded => p.value !== null);

/** First and latest recorded values (oldest-first series), or null when nothing was recorded. */
export function firstLatest(series: DatedValue[]): { first: Recorded; latest: Recorded; change: number } | null {
  const values = recorded(series);
  if (!values.length) return null;
  const first = values[0], latest = values[values.length - 1];
  return { first, latest, change: round1(latest.value - first.value) };
}

export interface ChartPoint extends Recorded { x: number; y: number }

/**
 * Points for a line chart in a `width` × `height` box: x by date (true to time), y from `min`/`max`
 * (or the data's own range), higher values nearer the top. Gaps (null values) split the line into
 * `segments` (SVG polyline `points` strings); a point on its own is left to the caller's dots.
 */
export function chartPoints(
  series: DatedValue[],
  { width, height, min, max }: { width: number; height: number; min?: number; max?: number },
): { points: ChartPoint[]; segments: string[]; min: number; max: number } {
  const values = recorded(series);
  const lo = min ?? Math.min(...values.map((p) => p.value));
  const hi = max ?? Math.max(...values.map((p) => p.value));
  if (!values.length) return { points: [], segments: [], min: lo, max: hi };

  const t0 = Date.parse(values[0].date);
  const span = Date.parse(values[values.length - 1].date) - t0;
  const toPoint = (p: Recorded): ChartPoint => ({
    ...p,
    x: span ? round1(((Date.parse(p.date) - t0) / span) * width) : width / 2,
    y: hi === lo ? height / 2 : round1(height - ((p.value - lo) / (hi - lo)) * height),
  });

  const runs: ChartPoint[][] = [[]];
  for (const p of series) {
    if (p.value === null) runs.push([]);
    else runs[runs.length - 1].push(toPoint(p as Recorded));
  }
  return {
    points: runs.flat(),
    segments: runs.filter((r) => r.length > 1).map((r) => r.map((p) => `${p.x},${p.y}`).join(' ')),
    min: lo,
    max: hi,
  };
}
