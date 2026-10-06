import { describe, it, expect } from 'vitest';
import { IDEAL_SHOTS, idealFigure, idealLandmarks, idealSize } from '@/lib/ideal-figures';
import { computeViewMetrics, POSTURE_VIEWS, POSE_LANDMARK_COUNT } from '@/lib/posture';
import { FLEX_SHOTS, measureShot, scoreFlexibility } from '@/lib/flexibility';
import { shotFrameChecks } from '@/lib/capture-shots';

describe('ideal figures', () => {
  it('exist for every posture view and flexibility shot', () => {
    expect([...IDEAL_SHOTS].sort()).toEqual([...POSTURE_VIEWS, ...FLEX_SHOTS].sort());
    for (const shot of IDEAL_SHOTS) expect(idealLandmarks(shot)).toHaveLength(POSE_LANDMARK_COUNT);
  });

  it('every ideal posture view measures normal on every rated measure (it can never contradict the report)', () => {
    for (const view of POSTURE_VIEWS) {
      const metrics = computeViewMetrics(view, idealLandmarks(view), idealSize(view));
      const rated = metrics.filter((m) => m.severity !== null);
      expect(rated.length, view).toBeGreaterThan(0);
      for (const m of rated) expect(m.severity, `${view} ${m.key}`).toBe('normal');
    }
  });

  it('every ideal flexibility pose scores 100 with no flags', () => {
    const measures = Object.fromEntries(FLEX_SHOTS.map((s) => [s, measureShot(s, idealLandmarks(s), idealSize(s))]));
    const scores = scoreFlexibility(measures);
    for (const [test, r] of Object.entries(scores)) {
      expect(r?.score, test).toBe(100);
      expect(r?.flags, test).toEqual([]);
    }
  });

  it('would pass the live capture checks for its own shot (in frame, facing the right way)', () => {
    for (const shot of IDEAL_SHOTS) expect(shotFrameChecks(shot, idealLandmarks(shot), idealSize(shot)), shot).toEqual({ inFrame: true, facing: true });
  });

  it('draws with the same overlay as the report, coloured as normal', () => {
    const f = idealFigure('front');
    expect(f.overlay.lines.some((l) => l.kind === 'bone')).toBe(true);
    expect(f.metrics.every((m) => m.severity === null || m.severity === 'normal')).toBe(true);
    expect(idealFigure('butterfly').metrics).toEqual([]);
  });
});
