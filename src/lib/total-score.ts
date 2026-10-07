// Total score per assessment (spec 2026-10-07-total-score): posture overall + the three flexibility
// tests, each 0–100, so 0–400. Only when every part is complete — both shoulder sides, both knees and
// every posture region measured — so two totals are always comparable.
import { FLEX_TESTS, type FlexResult, type FlexTest } from './flexibility';
import { REGIONS, type PostureScore } from './posture-insights';
import { scoreTrend, type Trend } from './posture-compare';

export const TOTAL_MAX = 400;
/** Total changes smaller than this are retake noise (3% of 400, like the posture score's 3/100). */
export const TOTAL_SAME_BAND = 12;

export type TotalParts = { posture: number } & Record<FlexTest, number>;

const complete = (r: FlexResult | null): r is FlexResult & { score: number } =>
  !!r && r.score !== null && (!r.sides || (r.sides.left !== null && r.sides.right !== null));

export function totalScore(
  posture: PostureScore,
  flex: Record<FlexTest, FlexResult | null>,
): { total: number; parts: TotalParts } | null {
  if (posture.overall === null || REGIONS.some((r) => posture.regions[r].score === null)) return null;
  const parts = { posture: posture.overall } as TotalParts;
  for (const test of FLEX_TESTS) {
    const r = flex[test];
    if (!complete(r)) return null;
    parts[test] = r.score;
  }
  return { total: parts.posture + FLEX_TESTS.reduce((sum, test) => sum + parts[test], 0), parts };
}

export const totalTrend = (latest: number | null, previous: number | null): { change: number | null; trend: Trend | null } =>
  scoreTrend(latest, previous, TOTAL_SAME_BAND);
