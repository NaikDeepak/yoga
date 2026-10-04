// Posture score and pattern detection from computed metrics. Deterministic, rule-based and
// clinician-reviewable: patterns map to i18n text (causes / long-term effects) and to exercise
// library categories. Not a diagnosis — see the report disclaimer.
import type { Metric, MetricKey, PostureView, Severity } from './posture';

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

const PENALTY: Record<Severity, number> = { normal: 0, mild: 15, marked: 35 };
const RANK: Record<Severity, number> = { normal: 0, mild: 1, marked: 2 };

export function gradeFor(score: number): Grade {
  if (score >= 85) return 'good';
  return score >= 65 ? 'fair' : 'needsAttention';
}

/**
 * Region score = 100 − 15 per mild − 35 per marked finding (min 0). A measure seen in several
 * views (e.g. shoulder level front + back) counts once at its worst; left/right limbs count separately.
 * Overall = mean of regions that had anything measurable.
 */
export function scorePosture(views: ViewMetrics): PostureScore {
  const worst = new Map<string, Metric>();
  for (const { metrics } of views) {
    for (const m of metrics) {
      if (m.severity === null) continue;
      const id = REGION_OF[m.key] === 'legs' ? `${m.key}:${m.side ?? ''}` : m.key;
      const prev = worst.get(id);
      if (!prev || RANK[m.severity] > RANK[prev.severity!]) worst.set(id, m);
    }
  }
  const regions = Object.fromEntries(REGIONS.map((r) => {
    const found = [...worst.values()].filter((m) => REGION_OF[m.key] === r);
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
  evidence: { view: PostureView; metric: Metric }[];
}

/** Patterns with at least one mild/marked finding, marked first, then in PATTERNS order. */
export function detectPatterns(views: ViewMetrics): DetectedPattern[] {
  const found: DetectedPattern[] = [];
  for (const rule of PATTERNS) {
    const evidence = views.flatMap(({ view, metrics }) =>
      metrics
        .filter((m) => (m.severity === 'mild' || m.severity === 'marked') && rule.matches(m))
        .map((metric) => ({ view, metric })));
    if (!evidence.length) continue;
    const severity = evidence.some((e) => e.metric.severity === 'marked') ? 'marked' : 'mild';
    found.push({ key: rule.key, severity, evidence });
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
