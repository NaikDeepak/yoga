import { describe, it, expect } from 'vitest';
import {
  combineViews, scorePosture, detectPatterns, focusCategories, gradeFor, REGION_OF,
} from '@/lib/posture-insights';
import { severity, type Metric, type MetricKey, type MetricUnit, type PostureView } from '@/lib/posture';

/** A metric as computeViewMetrics would produce it (severity from the real thresholds). */
const mk = (
  key: MetricKey,
  value: number | null,
  over: { side?: Metric['side']; direction?: Metric['direction']; unit?: MetricUnit } = {},
): Metric => {
  const unit = over.unit ?? 'deg';
  return {
    key, value, unit, side: value === null ? null : over.side ?? null,
    direction: value === null || value === 0 ? null : over.direction ?? null,
    severity: severity(key, value, unit), approx: false,
  };
};
const views = (byView: Partial<Record<PostureView, Metric[]>>) =>
  (Object.entries(byView) as [PostureView, Metric[]][]).map(([view, metrics]) => ({ view, metrics }));
const find = (list: ReturnType<typeof combineViews>, key: MetricKey, side?: 'left' | 'right') =>
  list.find((m) => m.key === key && (side === undefined || m.side === side))!;

describe('combineViews', () => {
  it('averages a measure seen from the front and back, keeping the side', () => {
    const c = combineViews(views({
      front: [mk('shoulderLevel', 1, { side: 'right' })],
      back: [mk('shoulderLevel', 3, { side: 'right' })],
    }));
    expect(find(c, 'shoulderLevel')).toMatchObject({ value: 2, side: 'right', severity: 'mild', lowConfidence: false });
    expect(find(c, 'shoulderLevel').sources.map((s) => s.view)).toEqual(['front', 'back']);
  });

  it('cancels out when the two views disagree on the side', () => {
    const c = combineViews(views({
      front: [mk('headTilt', 1, { side: 'right' })],
      back: [mk('headTilt', 1, { side: 'left' })],
    }));
    expect(find(c, 'headTilt')).toMatchObject({ value: 0, side: null, severity: 'normal' });
  });

  it('flags low confidence when the views differ by more than 2.5°', () => {
    const c = combineViews(views({
      front: [mk('pelvicLevel', 0.1, { side: 'right' })],
      back: [mk('pelvicLevel', 4.1, { side: 'right' })],
    }));
    expect(find(c, 'pelvicLevel')).toMatchObject({ value: 2.1, side: 'right', severity: 'mild', lowConfidence: true });
  });

  it('never flags informational measures (no rating to change)', () => {
    const c = combineViews(views({
      front: [mk('armHang', 1, { side: 'left', unit: 'cm' })],
      back: [mk('armHang', 5, { side: 'left', unit: 'cm' })],
    }));
    expect(find(c, 'armHang')).toMatchObject({ value: 3, unit: 'cm', lowConfidence: false });
  });

  it('does not flag readings that disagree but share the same rating', () => {
    const c = combineViews(views({
      front: [mk('headTilt', 1.7, { side: 'right' })],
      back: [mk('headTilt', 1.7, { side: 'left' })],
    }));
    expect(find(c, 'headTilt')).toMatchObject({ value: 0, lowConfidence: false });
  });

  it('does not flag readings in different bands that are within tolerance', () => {
    const c = combineViews(views({
      front: [mk('shoulderLevel', 1.9, { side: 'right' })],
      back: [mk('shoulderLevel', 2.1, { side: 'right' })],
    }));
    expect(find(c, 'shoulderLevel').lowConfidence).toBe(false);
  });

  it('keeps left and right limbs separate and averages valgus/varus by direction', () => {
    const c = combineViews(views({
      front: [mk('kneeAlignment', 6, { side: 'left', direction: 'valgus' }), mk('kneeAlignment', 6, { side: 'right', direction: 'valgus' })],
      back: [mk('kneeAlignment', 2, { side: 'left', direction: 'varus' }), mk('kneeAlignment', 8, { side: 'right', direction: 'valgus' })],
    }));
    expect(find(c, 'kneeAlignment', 'left')).toMatchObject({ value: 2, direction: 'valgus', severity: 'normal', lowConfidence: true });
    expect(find(c, 'kneeAlignment', 'right')).toMatchObject({ value: 7, direction: 'valgus', severity: 'mild', lowConfidence: false });
  });

  it('averages the left and right side views by direction', () => {
    const c = combineViews(views({
      left: [mk('forwardHead', 11, { direction: 'forward' })],
      right: [mk('forwardHead', 13.6, { direction: 'forward' })],
    }));
    expect(find(c, 'forwardHead')).toMatchObject({ value: 12.3, direction: 'forward', severity: 'mild', lowConfidence: false });
    const split = combineViews(views({
      left: [mk('forwardHead', 8, { direction: 'forward' })],
      right: [mk('forwardHead', 14, { direction: 'forward' })],
    }));
    expect(find(split, 'forwardHead')).toMatchObject({ value: 11, lowConfidence: true });
  });

  it('uses the single measurable view when the other is not measurable', () => {
    const c = combineViews(views({
      front: [mk('shoulderLevel', null)],
      back: [mk('shoulderLevel', 3, { side: 'left' }), mk('hindfoot', 6, { side: 'left', direction: 'valgus' })],
    }));
    expect(find(c, 'shoulderLevel')).toMatchObject({ value: 3, side: 'left', lowConfidence: false });
    expect(find(c, 'shoulderLevel').sources).toHaveLength(1);
    expect(find(c, 'hindfoot', 'left')).toMatchObject({ value: 6, direction: 'valgus' });
  });

  it('reports not measurable when no view could measure it', () => {
    const c = combineViews(views({ front: [mk('pelvicLevel', null)], back: [mk('pelvicLevel', null)] }));
    expect(find(c, 'pelvicLevel')).toMatchObject({ value: null, severity: null, sources: [], lowConfidence: false });
  });
});

describe('scorePosture', () => {
  const score = (v: Parameters<typeof views>[0]) => scorePosture(combineViews(views(v)));

  it('scores a fully normal posture 100 / good', () => {
    const s = score({ front: [mk('shoulderLevel', 0)], left: [mk('forwardHead', 3, { direction: 'forward' })] });
    expect(s).toMatchObject({ overall: 100, grade: 'good' });
    expect(s.regions.headNeck).toEqual({ score: 100, worst: 'normal' });
  });

  it('deducts 15 per mild and 35 per marked finding within a region', () => {
    const s = score({
      front: [mk('headTilt', 3, { side: 'left' }), mk('shoulderLevel', 5, { side: 'right' })],
      left: [mk('forwardHead', 12, { direction: 'forward' })],
    });
    expect(s.regions.headNeck).toEqual({ score: 70, worst: 'mild' });
    expect(s.regions.shoulders).toEqual({ score: 65, worst: 'marked' });
  });

  it('keeps left and right limbs separate', () => {
    const s = score({
      front: [mk('kneeAlignment', 6, { side: 'left', direction: 'valgus' }), mk('kneeAlignment', 6, { side: 'right', direction: 'varus' })],
    });
    expect(s.regions.legs.score).toBe(70);
  });

  it('averages measured regions only and never goes below 0', () => {
    const s = score({
      front: [mk('trunkShift', 5, { side: 'left' }), mk('pelvicLevel', 5, { side: 'left' }), mk('headTilt', null)],
      left: [mk('trunkLean', 5, { direction: 'forward' }), mk('kneeSagittal', 12, { direction: 'backward' }), mk('pelvicTilt', 4, { direction: 'forward' })],
    });
    expect(s.regions.trunk).toEqual({ score: 30, worst: 'marked' });
    expect(s.regions.headNeck).toEqual({ score: null, worst: null });
    expect(s.regions.shoulders).toEqual({ score: null, worst: null });
    // pelvis 65 (pelvicTilt is informational), legs 65, trunk 30
    expect(s.overall).toBe(Math.round((65 + 30 + 65) / 3));
  });

  it('returns no overall score when nothing was measurable', () => {
    expect(score({ front: [mk('headTilt', null)] })).toMatchObject({ overall: null, grade: null });
  });

  it('grades the overall score', () => {
    expect(gradeFor(85)).toBe('good');
    expect(gradeFor(84)).toBe('fair');
    expect(gradeFor(65)).toBe('fair');
    expect(gradeFor(64)).toBe('needsAttention');
  });

  it('maps every metric to a body region', () => {
    expect(REGION_OF.forwardHead).toBe('headNeck');
    expect(REGION_OF.hindfoot).toBe('legs');
  });
});

describe('detectPatterns', () => {
  const detect = (v: Parameters<typeof views>[0]) => detectPatterns(combineViews(views(v)));

  it('returns nothing for normal findings', () => {
    expect(detect({ front: [mk('shoulderLevel', 1, { side: 'right' })] })).toEqual([]);
  });

  it('detects patterns from the combined findings, marked first, with evidence', () => {
    const p = detect({
      front: [mk('shoulderLevel', 3, { side: 'right' }), mk('headShift', 3, { side: 'right' })],
      back: [mk('pelvicLevel', 5, { side: 'right' })],
      left: [mk('forwardHead', 22, { direction: 'forward' })],
      right: [mk('forwardHead', 24, { direction: 'forward' })],
    });
    expect(p.map((x) => [x.key, x.severity])).toEqual([
      ['forwardHead', 'marked'],
      ['pelvicImbalance', 'marked'],
      ['headTilt', 'mild'],
      ['shoulderImbalance', 'mild'],
    ]);
    expect(p[0].evidence[0]).toMatchObject({ key: 'forwardHead', value: 23 });
    expect(p[0].evidence[0].sources.map((s) => s.view)).toEqual(['left', 'right']);
  });

  it('separates knee valgus/varus and hyperextension/flexion by direction', () => {
    const p = detect({
      front: [
        mk('kneeAlignment', 6, { side: 'left', direction: 'valgus' }),
        mk('kneeAlignment', 6, { side: 'right', direction: 'varus' }),
      ],
      left: [mk('kneeSagittal', 6, { direction: 'backward' })],
    }).map((x) => x.key);
    expect(p).toEqual(['kneeValgus', 'kneeVarus', 'kneeHyperextension']);
    expect(detect({ left: [mk('kneeSagittal', 12, { direction: 'forward' })] }).map((x) => x.key)).toEqual(['kneeFlexion']);
  });

  it('ignores a head held behind the shoulders (not forward head posture)', () => {
    expect(detect({ left: [mk('forwardHead', 12, { direction: 'backward' })] })).toEqual([]);
  });

  it('detects trunk shift and trunk lean separately', () => {
    const p = detect({
      back: [mk('trunkShift', 3, { side: 'right' })],
      right: [mk('trunkLean', 3, { direction: 'forward' })],
    }).map((x) => x.key);
    expect(p).toEqual(['trunkShift', 'trunkLean']);
  });
});

describe('focusCategories', () => {
  it('collects unique exercise-library categories for the detected patterns, in pattern order', () => {
    const p = detectPatterns(combineViews(views({
      left: [mk('forwardHead', 25, { direction: 'forward' })],
      front: [mk('pelvicLevel', 3, { side: 'left' })],
    })));
    expect(focusCategories(p)).toEqual(['neck', 'shoulder', 'core', 'lower_body', 'back']);
  });
});
