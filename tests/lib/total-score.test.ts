import { describe, it, expect } from 'vitest';
import { TOTAL_MAX, TOTAL_SAME_BAND, totalScore, totalTrend } from '@/lib/total-score';
import type { FlexResult, FlexTest } from '@/lib/flexibility';

const r = (score: number | null): FlexResult => ({ score, band: null, flags: [] });
const flex = (s: number | null, f: number | null, b: number | null): Record<FlexTest, FlexResult | null> =>
  ({ shoulderExtension: r(s), forwardFold: r(f), butterfly: r(b) });

describe('totalScore', () => {
  it('adds posture and the three flexibility scores, out of 400', () => {
    expect(TOTAL_MAX).toBe(400);
    expect(totalScore(82, flex(78, 48, 80))).toEqual({
      total: 288, parts: { posture: 82, shoulderExtension: 78, forwardFold: 48, butterfly: 80 },
    });
  });

  it('is null unless every part exists (no partial totals)', () => {
    expect(totalScore(null, flex(78, 48, 80))).toBeNull();
    expect(totalScore(82, flex(78, null, 80))).toBeNull();
    expect(totalScore(82, { ...flex(78, 48, 80), butterfly: null })).toBeNull();
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
