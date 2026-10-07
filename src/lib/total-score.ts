// Total score per assessment (spec 2026-10-07-total-score): posture overall + the three flexibility
// tests, each 0–100, so 0–400. Only when every part exists — a partial total isn't comparable.
import { FLEX_TESTS, type FlexResult, type FlexTest } from './flexibility';
import type { Trend } from './posture-compare';

export const TOTAL_MAX = 400;
/** Total changes smaller than this are retake noise (3% of 400, like the posture score's 3/100). */
export const TOTAL_SAME_BAND = 12;

export type TotalParts = { posture: number } & Record<FlexTest, number>;

export function totalScore(
  posture: number | null,
  flex: Record<FlexTest, FlexResult | null>,
): { total: number; parts: TotalParts } | null {
  if (posture === null) return null;
  const parts = { posture } as TotalParts;
  for (const test of FLEX_TESTS) {
    const score = flex[test]?.score ?? null;
    if (score === null) return null;
    parts[test] = score;
  }
  return { total: posture + FLEX_TESTS.reduce((sum, test) => sum + parts[test], 0), parts };
}

export function totalTrend(latest: number | null, previous: number | null): { change: number | null; trend: Trend | null } {
  if (latest === null || previous === null) return { change: null, trend: null };
  const change = latest - previous;
  if (Math.abs(change) < TOTAL_SAME_BAND) return { change, trend: 'same' };
  return { change, trend: change > 0 ? 'better' : 'worse' };
}
