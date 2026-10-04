import { describe, it, expect } from 'vitest';
import { compareMetrics, compareScores } from '@/lib/posture-compare';
import { combineViews, scorePosture } from '@/lib/posture-insights';
import { severity, type Metric, type MetricKey, type PostureView } from '@/lib/posture';

const mk = (key: MetricKey, value: number | null, over: Partial<Metric> = {}): Metric => ({
  key, value, unit: 'deg', side: value ? over.side ?? null : null, direction: value ? over.direction ?? null : null,
  severity: severity(key, value), approx: false, ...over,
});
const combined = (byView: Partial<Record<PostureView, Metric[]>>) =>
  combineViews((Object.entries(byView) as [PostureView, Metric[]][]).map(([view, metrics]) => ({ view, metrics })));
const row = (rows: ReturnType<typeof compareMetrics>, key: MetricKey, side?: 'left' | 'right') =>
  rows.find((r) => r.key === key && (side === undefined || r.limbSide === side))!;

describe('compareMetrics', () => {
  it('marks a measure better when it drops into a lower band', () => {
    const rows = compareMetrics(
      combined({ front: [mk('shoulderLevel', 5, { side: 'right' })] }),
      combined({ front: [mk('shoulderLevel', 1.5, { side: 'right' })] }),
    );
    expect(row(rows, 'shoulderLevel')).toMatchObject({ change: -3.5, trend: 'better' });
    expect(row(rows, 'shoulderLevel').before?.severity).toBe('marked');
    expect(row(rows, 'shoulderLevel').after?.severity).toBe('normal');
  });

  it('marks a measure worse when it rises into a higher band', () => {
    const rows = compareMetrics(
      combined({ left: [mk('forwardHead', 8, { direction: 'forward' })] }),
      combined({ left: [mk('forwardHead', 15, { direction: 'forward' })] }),
    );
    expect(row(rows, 'forwardHead')).toMatchObject({ change: 7, trend: 'worse' });
  });

  it('within the same band, ignores changes up to 0.5° and reports larger ones', () => {
    const small = compareMetrics(
      combined({ front: [mk('headTilt', 1, { side: 'left' })] }),
      combined({ front: [mk('headTilt', 1.4, { side: 'left' })] }),
    );
    expect(row(small, 'headTilt')).toMatchObject({ change: 0.4, trend: 'same' });
    const larger = compareMetrics(
      combined({ left: [mk('forwardHead', 18, { direction: 'forward' })] }),
      combined({ left: [mk('forwardHead', 12, { direction: 'forward' })] }),
    );
    expect(row(larger, 'forwardHead')).toMatchObject({ change: -6, trend: 'better' });
  });

  it('treats a tiny change across a band boundary as no change', () => {
    const rows = compareMetrics(
      combined({ front: [mk('shoulderLevel', 1.9, { side: 'right' })] }),
      combined({ front: [mk('shoulderLevel', 2, { side: 'right' })] }),
    );
    expect(row(rows, 'shoulderLevel')).toMatchObject({ change: 0.1, trend: 'same' });
  });

  it('compares each leg separately', () => {
    const rows = compareMetrics(
      combined({ front: [mk('kneeAlignment', 7, { side: 'left', direction: 'valgus' }), mk('kneeAlignment', 2, { side: 'right', direction: 'varus' })] }),
      combined({ front: [mk('kneeAlignment', 3, { side: 'left', direction: 'valgus' }), mk('kneeAlignment', 2, { side: 'right', direction: 'varus' })] }),
    );
    expect(row(rows, 'kneeAlignment', 'left').trend).toBe('better');
    expect(row(rows, 'kneeAlignment', 'right').trend).toBe('same');
  });

  it('has no trend when either side was not measurable, and skips informational measures', () => {
    const rows = compareMetrics(
      combined({ front: [mk('pelvicLevel', null), mk('armHang', 3, { unit: 'cm', side: 'left' })] }),
      combined({ front: [mk('pelvicLevel', 2, { side: 'left' }), mk('armHang', 1, { unit: 'cm', side: 'left' })] }),
    );
    expect(row(rows, 'pelvicLevel')).toMatchObject({ change: null, trend: null });
    expect(rows.some((r) => r.key === 'armHang')).toBe(false);
  });

  it('includes measures present in only one of the assessments', () => {
    const rows = compareMetrics(
      combined({ front: [mk('headTilt', 1, { side: 'left' })] }),
      combined({ back: [mk('hindfoot', 6, { side: 'left', direction: 'valgus' })], front: [mk('headTilt', 1, { side: 'left' })] }),
    );
    expect(rows.map((r) => r.key)).toEqual(['headTilt']); // hindfoot is informational
    const both = compareMetrics(
      combined({ front: [mk('headTilt', 1, { side: 'left' })] }),
      combined({ front: [mk('headTilt', 1, { side: 'left' })], left: [mk('trunkLean', 3, { direction: 'forward' })] }),
    );
    expect(row(both, 'trunkLean')).toMatchObject({ before: null, trend: null });
  });
});

describe('compareScores', () => {
  it('reports overall and per-region changes', () => {
    const before = scorePosture(combined({ front: [mk('shoulderLevel', 5, { side: 'right' }), mk('headTilt', 3, { side: 'left' })] }));
    const after = scorePosture(combined({ front: [mk('shoulderLevel', 1, { side: 'right' }), mk('headTilt', 3, { side: 'left' })] }));
    const c = compareScores(before, after);
    expect(c.overall).toEqual({ before: before.overall, after: after.overall, change: after.overall! - before.overall! });
    expect(c.regions.shoulders).toEqual({ before: 65, after: 100, change: 35 });
    expect(c.regions.headNeck).toEqual({ before: 85, after: 85, change: 0 });
    expect(c.regions.legs).toEqual({ before: null, after: null, change: null });
  });
});
