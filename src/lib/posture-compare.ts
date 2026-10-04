// Before/after comparison of two posture assessments, on the combined (averaged) findings.
import { LIMB_METRICS as LIMB, round1, SEVERITY_RANK as RANK, THRESHOLDS, type MetricKey, type MetricUnit, type Side } from './posture';
import { REGIONS, type CombinedMetric, type PostureScore, type Region } from './posture-insights';

export type Trend = 'better' | 'worse' | 'same';

export interface CompareRow {
  key: MetricKey;
  /** For per-leg measures (knee, heel): which leg. */
  limbSide: Side | null;
  before: CombinedMetric | null;
  after: CombinedMetric | null;
  /** after − before, in the measure's unit (positive = larger deviation). */
  change: number | null;
  trend: Trend | null;
}

/** Changes up to this size are measurement noise, not progress. */
const NOISE: Record<MetricUnit, number> = { deg: 0.5, cm: 0.5, pct: 0.3 };

const idOf = (m: CombinedMetric) => `${m.key}:${LIMB.has(m.key) ? m.side ?? '' : ''}`;

/** Changes within measurement noise are 'same' even across a band boundary (1.9° → 2.0° isn't worse). */
function trendOf(before: CombinedMetric, after: CombinedMetric, change: number): Trend {
  if (Math.abs(change) <= NOISE[after.unit]) return 'same';
  const rb = RANK[before.severity!], ra = RANK[after.severity!];
  if (ra !== rb) return ra < rb ? 'better' : 'worse';
  return change < 0 ? 'better' : 'worse';
}

/** One row per rated measure (informational ones are skipped), in the order first seen. */
export function compareMetrics(before: CombinedMetric[], after: CombinedMetric[]): CompareRow[] {
  const rated = (m: CombinedMetric) => THRESHOLDS[m.key] !== undefined;
  const ids: string[] = [];
  const byId = (list: CombinedMetric[]) => new Map(list.filter(rated).map((m) => [idOf(m), m]));
  const b = byId(before), a = byId(after);
  for (const id of [...b.keys(), ...a.keys()]) if (!ids.includes(id)) ids.push(id);

  return ids.map((id) => {
    const bm = b.get(id) ?? null, am = a.get(id) ?? null;
    const any = (bm ?? am)!;
    const measurable = bm?.value != null && am?.value != null;
    const change = measurable ? round1(am!.value! - bm!.value!) : null;
    return {
      key: any.key,
      limbSide: LIMB.has(any.key) ? any.side : null,
      before: bm,
      after: am,
      change,
      trend: measurable ? trendOf(bm!, am!, change!) : null,
    };
  });
}

export interface ScoreChange { before: number | null; after: number | null; change: number | null }

export function compareScores(before: PostureScore, after: PostureScore): {
  overall: ScoreChange;
  regions: Record<Region, ScoreChange>;
} {
  const diff = (x: number | null, y: number | null): ScoreChange =>
    ({ before: x, after: y, change: x !== null && y !== null ? y - x : null });
  return {
    overall: diff(before.overall, after.overall),
    regions: Object.fromEntries(REGIONS.map((r) => [r, diff(before.regions[r].score, after.regions[r].score)])) as Record<Region, ScoreChange>,
  };
}
