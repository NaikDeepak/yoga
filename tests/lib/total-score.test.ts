import { describe, it, expect } from 'vitest';
import { TOTAL_MAX, TOTAL_SAME_BAND, totalScore, totalTrend } from '@/lib/total-score';
import { REGIONS, type PostureScore } from '@/lib/posture-insights';
import type { FlexResult, FlexTest } from '@/lib/flexibility';

const posture = (overall: number | null, missingRegion = false): PostureScore => ({
  overall, grade: null,
  regions: Object.fromEntries(REGIONS.map((r, i) => [r, { score: missingRegion && i === 0 ? null : 90, worst: null }])) as PostureScore['regions'],
});
const r = (score: number | null, sides?: { left: number | null; right: number | null }): FlexResult =>
  ({ score, band: null, flags: [], ...(sides && { sides }) });
const flex = (s: number | null, f: number | null, b: number | null, o: Partial<Record<FlexTest, FlexResult>> = {}): Record<FlexTest, FlexResult | null> =>
  ({ shoulderExtension: r(s, { left: s, right: s }), forwardFold: r(f), butterfly: r(b, { left: b, right: b }), ...o });

describe('totalScore', () => {
  it('adds posture and the three flexibility scores, out of 400', () => {
    expect(TOTAL_MAX).toBe(400);
    expect(totalScore(posture(82), flex(78, 48, 80))).toEqual({
      total: 288, parts: { posture: 82, shoulderExtension: 78, forwardFold: 48, butterfly: 80 },
    });
  });

  it('is null unless every part exists', () => {
    expect(totalScore(posture(null), flex(78, 48, 80))).toBeNull();
    expect(totalScore(posture(82), flex(78, null, 80))).toBeNull();
    expect(totalScore(posture(82), { ...flex(78, 48, 80), butterfly: null })).toBeNull();
  });

  it('is null when a part is itself partial: one shoulder side, one knee, or a posture region not measured', () => {
    expect(totalScore(posture(82), flex(78, 48, 80, { shoulderExtension: r(78, { left: 78, right: null }) }))).toBeNull();
    expect(totalScore(posture(82), flex(78, 48, 80, { butterfly: r(80, { left: null, right: 80 }) }))).toBeNull();
    expect(totalScore(posture(82, true), flex(78, 48, 80))).toBeNull();
  });
});

describe('totalTrend', () => {
  it('changes under 12 points are steady; 12+ is better or worse', () => {
    expect(TOTAL_SAME_BAND).toBe(12);
    expect(totalTrend(300, 289)).toEqual({ change: 11, trend: 'same' });
    expect(totalTrend(300, 288)).toEqual({ change: 12, trend: 'better' });
    expect(totalTrend(276, 288)).toEqual({ change: -12, trend: 'worse' });
  });

  it('no trend without both totals', () => {
    expect(totalTrend(300, null)).toEqual({ change: null, trend: null });
    expect(totalTrend(null, 300)).toEqual({ change: null, trend: null });
  });
});
