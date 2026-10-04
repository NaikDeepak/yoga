// Posture score and pattern detection from computed metrics. Deterministic, rule-based and
// clinician-reviewable: patterns map to i18n text (causes / long-term effects) and to exercise
// library categories. Not a diagnosis — see the report disclaimer.
import {
  LIMB_METRICS as LIMB, round1, SEVERITY_RANK as RANK, severity, type Direction, type Metric, type MetricKey, type MetricUnit, type PostureView, type Severity, type Side } from './posture';

export type Region = 'headNeck' | 'shoulders' | 'trunk' | 'pelvis' | 'legs';
export const REGIONS: readonly Region[] = ['headNeck', 'shoulders', 'trunk', 'pelvis', 'legs'];

export const REGION_OF: Record<MetricKey, Region> = {
  headTilt: 'headNeck', headShift: 'headNeck', forwardHead: 'headNeck', headForward: 'headNeck',
  shoulderLevel: 'shoulders', shoulderForward: 'shoulders', armHang: 'shoulders',
  trunkShift: 'trunk', trunkLean: 'trunk',
  pelvicLevel: 'pelvis', pelvicShift: 'pelvis', pelvicTilt: 'pelvis',
  kneeAlignment: 'legs', kneeSagittal: 'legs', hindfoot: 'legs',
};

/** Exercise library categories (see `exercises_category_check`). */
export type ExerciseCategory = 'neck' | 'back' | 'core' | 'lower_body' | 'shoulder';

export type Grade = 'good' | 'fair' | 'needsAttention';
export interface RegionScore { score: number | null; worst: Severity | null }
export interface PostureScore { overall: number | null; grade: Grade | null; regions: Record<Region, RegionScore> }

type ViewMetrics = { view: PostureView; metrics: Metric[] }[];

/** One measure across the views that saw it (front+back, or left+right side views). */
export interface CombinedMetric extends Metric {
  /** The per-view readings that went into the average (measurable ones only). */
  sources: { view: PostureView; metric: Metric }[];
  /** The views rate it differently and differ by more than DISAGREE_TOLERANCE — suggest retaking those photos. */
  lowConfidence: boolean;
}

/** Measures whose `side` is the direction of the deviation (lower side / shifted-to side). */
const SIDED = new Set<MetricKey>(['headTilt', 'shoulderLevel', 'pelvicLevel', 'trunkShift', 'headShift', 'armHang']);
export const DISAGREE_TOLERANCE: Record<MetricUnit, number> = { deg: 2.5, cm: 2, pct: 1.2 };


/** Deviation as a signed number, so readings on opposite sides average towards zero. */
function signed(m: Metric): number {
  const v = m.value ?? 0;
  if (SIDED.has(m.key)) return m.side === 'left' ? -v : v;
  if (LIMB.has(m.key)) return m.direction === 'varus' ? -v : v;
  return m.direction === 'backward' ? -v : v;
}

function unsigned(key: MetricKey, s: number, limbSide: Side | null): Pick<Metric, 'side' | 'direction'> {
  if (s === 0) return { side: LIMB.has(key) ? limbSide : null, direction: null };
  if (SIDED.has(key)) return { side: s > 0 ? 'right' : 'left', direction: null };
  if (LIMB.has(key)) return { side: limbSide, direction: (s > 0 ? 'valgus' : 'varus') as Direction };
  return { side: null, direction: s > 0 ? 'forward' : 'backward' };
}

/**
 * Averages each measure over the views that measured it — front with back, left side with right side —
 * keeping direction (a 1° right tilt and a 1° left tilt average to 0). Severity is re-banded from the
 * average. Readings that differ by more than the tolerance are marked low-confidence.
 */
export function combineViews(views: ViewMetrics): CombinedMetric[] {
  const groups = new Map<string, { key: MetricKey; limbSide: Side | null; unit: MetricUnit; approx: boolean; sources: { view: PostureView; metric: Metric }[] }>();
  for (const { view, metrics } of views) {
    for (const m of metrics) {
      const limbSide = LIMB.has(m.key) ? m.side : null;
      const id = `${m.key}:${limbSide ?? ''}`;
      if (!groups.has(id)) groups.set(id, { key: m.key, limbSide, unit: m.unit, approx: m.approx, sources: [] });
      if (m.value !== null) groups.get(id)!.sources.push({ view, metric: m });
    }
  }
  return [...groups.values()].map((g) => {
    if (!g.sources.length) {
      return { key: g.key, value: null, unit: g.unit, side: null, direction: null, severity: null, approx: g.approx, sources: [], lowConfidence: false };
    }
    const values = g.sources.map((s) => signed(s.metric));
    const unit = g.sources[0].metric.unit;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const value = round1(Math.abs(mean));
    // Only worth a retake when the views would rate it differently and are clearly apart.
    const bands = new Set(g.sources.map((src) => src.metric.severity));
    const lowConfidence = values.length > 1 && !bands.has(null) && bands.size > 1
      && Math.max(...values) - Math.min(...values) > DISAGREE_TOLERANCE[unit];
    return {
      key: g.key, value, unit, ...unsigned(g.key, value === 0 ? 0 : mean, g.limbSide),
      severity: severity(g.key, value, unit), approx: g.approx, sources: g.sources, lowConfidence,
    };
  });
}

const PENALTY: Record<Severity, number> = { normal: 0, mild: 15, marked: 35 };

export function gradeFor(score: number): Grade {
  if (score >= 85) return 'good';
  return score >= 65 ? 'fair' : 'needsAttention';
}

/**
 * Region score = 100 − 15 per mild − 35 per marked finding (min 0), over the combined measures
 * (see combineViews), so a measure seen in two views counts once. Left/right limbs count separately.
 * Overall = mean of regions that had anything measurable.
 */
export function scorePosture(metrics: CombinedMetric[]): PostureScore {
  const scored = metrics.filter((m) => m.severity !== null);
  const regions = Object.fromEntries(REGIONS.map((r) => {
    const found = scored.filter((m) => REGION_OF[m.key] === r);
    if (!found.length) return [r, { score: null, worst: null }];
    const score = Math.max(0, 100 - found.reduce((sum, m) => sum + PENALTY[m.severity!], 0));
    const w = found.reduce<Severity>((acc, m) => (RANK[m.severity!] > RANK[acc] ? m.severity! : acc), 'normal');
    return [r, { score, worst: w }];
  })) as Record<Region, RegionScore>;

  const measured = REGIONS.map((r) => regions[r].score).filter((s): s is number => s !== null);
  const overall = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;
  return { overall, grade: overall === null ? null : gradeFor(overall), regions };
}

export type PatternKey =
  | 'forwardHead' | 'headTilt' | 'shoulderImbalance' | 'trunkShift' | 'trunkLean' | 'pelvicImbalance'
  | 'kneeValgus' | 'kneeVarus' | 'kneeHyperextension' | 'kneeFlexion';

interface PatternRule { key: PatternKey; matches: (m: Metric) => boolean; focus: ExerciseCategory[] }

// Order = display order among patterns of equal severity.
const PATTERNS: PatternRule[] = [
  { key: 'forwardHead', matches: (m) => m.key === 'forwardHead' && m.direction === 'forward', focus: ['neck', 'shoulder'] },
  { key: 'headTilt', matches: (m) => m.key === 'headTilt' || m.key === 'headShift', focus: ['neck'] },
  { key: 'shoulderImbalance', matches: (m) => m.key === 'shoulderLevel', focus: ['shoulder', 'neck'] },
  { key: 'trunkShift', matches: (m) => m.key === 'trunkShift', focus: ['back', 'core'] },
  { key: 'trunkLean', matches: (m) => m.key === 'trunkLean', focus: ['core', 'back'] },
  { key: 'pelvicImbalance', matches: (m) => m.key === 'pelvicLevel', focus: ['core', 'lower_body', 'back'] },
  { key: 'kneeValgus', matches: (m) => m.key === 'kneeAlignment' && m.direction === 'valgus', focus: ['lower_body'] },
  { key: 'kneeVarus', matches: (m) => m.key === 'kneeAlignment' && m.direction === 'varus', focus: ['lower_body'] },
  { key: 'kneeHyperextension', matches: (m) => m.key === 'kneeSagittal' && m.direction === 'backward', focus: ['lower_body', 'core'] },
  { key: 'kneeFlexion', matches: (m) => m.key === 'kneeSagittal' && m.direction === 'forward', focus: ['lower_body'] },
];

export interface DetectedPattern {
  key: PatternKey;
  severity: 'mild' | 'marked';
  evidence: CombinedMetric[];
}

/** Patterns with at least one mild/marked combined finding, marked first, then in PATTERNS order. */
export function detectPatterns(metrics: CombinedMetric[]): DetectedPattern[] {
  const found: DetectedPattern[] = [];
  for (const rule of PATTERNS) {
    const evidence = metrics.filter((m) => (m.severity === 'mild' || m.severity === 'marked') && rule.matches(m));
    if (!evidence.length) continue;
    found.push({ key: rule.key, severity: evidence.some((m) => m.severity === 'marked') ? 'marked' : 'mild', evidence });
  }
  return found.sort((a, b) => Number(b.severity === 'marked') - Number(a.severity === 'marked'));
}

/** Exercise categories to focus on, unique, in the order the patterns were detected. */
export function focusCategories(patterns: DetectedPattern[]): ExerciseCategory[] {
  const out: ExerciseCategory[] = [];
  for (const p of patterns) {
    for (const c of PATTERNS.find((r) => r.key === p.key)!.focus) if (!out.includes(c)) out.push(c);
  }
  return out;
}
