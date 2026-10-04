import { describe, it, expect } from 'vitest';
import { scorePosture, detectPatterns, focusCategories, gradeFor, REGION_OF } from '@/lib/posture-insights';
import type { Metric, MetricKey, PostureView } from '@/lib/posture';

const m = (key: MetricKey, severity: Metric['severity'], over: Partial<Metric> = {}): Metric => ({
  key, value: severity === null ? null : 1, unit: 'deg', side: null, direction: null, severity, approx: false, ...over,
});
const views = (byView: Partial<Record<PostureView, Metric[]>>) =>
  (Object.entries(byView) as [PostureView, Metric[]][]).map(([view, metrics]) => ({ view, metrics }));

describe('scorePosture', () => {
  it('scores a fully normal posture 100 / good', () => {
    const s = scorePosture(views({ front: [m('shoulderLevel', 'normal')], left: [m('forwardHead', 'normal')] }));
    expect(s).toMatchObject({ overall: 100, grade: 'good' });
    expect(s.regions.headNeck).toEqual({ score: 100, worst: 'normal' });
  });

  it('deducts 15 per mild and 35 per marked finding within a region', () => {
    const s = scorePosture(views({
      front: [m('headTilt', 'mild'), m('shoulderLevel', 'marked')],
      left: [m('forwardHead', 'mild')],
    }));
    expect(s.regions.headNeck).toEqual({ score: 70, worst: 'mild' });
    expect(s.regions.shoulders).toEqual({ score: 65, worst: 'marked' });
  });

  it('counts a measure seen in several views once, at its worst', () => {
    const s = scorePosture(views({
      front: [m('shoulderLevel', 'mild')],
      back: [m('shoulderLevel', 'marked')],
    }));
    expect(s.regions.shoulders.score).toBe(65);
  });

  it('keeps left and right limbs separate', () => {
    const s = scorePosture(views({
      front: [m('kneeAlignment', 'mild', { side: 'left' }), m('kneeAlignment', 'mild', { side: 'right' })],
    }));
    expect(s.regions.legs.score).toBe(70);
  });

  it('averages measured regions only and never goes below 0', () => {
    const s = scorePosture(views({
      front: [m('pelvicLevel', 'marked'), m('trunkShift', 'marked'), m('headTilt', null)],
      back: [m('pelvicLevel', 'marked')],
      left: [m('pelvicTilt', null), m('trunkLean', 'marked'), m('kneeSagittal', 'marked')],
      right: [m('kneeSagittal', 'marked')],
    }));
    expect(s.regions.trunk).toEqual({ score: 30, worst: 'marked' });
    expect(s.regions.headNeck).toEqual({ score: null, worst: null }); // nothing measurable
    // pelvis: pelvicLevel marked (35); pelvicTilt has no threshold → 65. legs: 65. trunk: 30.
    expect(s.overall).toBe(Math.round((65 + 30 + 65) / 3));
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
  it('returns nothing for normal findings', () => {
    expect(detectPatterns(views({ front: [m('shoulderLevel', 'normal')] }))).toEqual([]);
  });

  it('detects patterns from mild/marked findings, marked first, with evidence', () => {
    const p = detectPatterns(views({
      front: [m('shoulderLevel', 'mild', { side: 'right' }), m('headShift', 'mild', { side: 'right' })],
      back: [m('pelvicLevel', 'marked', { side: 'right' })],
      left: [m('forwardHead', 'mild', { direction: 'forward' })],
      right: [m('forwardHead', 'marked', { direction: 'forward' })],
    }));
    expect(p.map((x) => [x.key, x.severity])).toEqual([
      ['forwardHead', 'marked'],
      ['pelvicImbalance', 'marked'],
      ['headTilt', 'mild'],
      ['shoulderImbalance', 'mild'],
    ]);
    expect(p[0].evidence.map((e) => e.view)).toEqual(['left', 'right']);
  });

  it('separates knee valgus/varus and hyperextension/flexion by direction', () => {
    const p = detectPatterns(views({
      front: [
        m('kneeAlignment', 'mild', { side: 'left', direction: 'valgus' }),
        m('kneeAlignment', 'mild', { side: 'right', direction: 'varus' }),
      ],
      left: [m('kneeSagittal', 'mild', { direction: 'backward' })],
      right: [m('kneeSagittal', 'marked', { direction: 'forward' })],
    })).map((x) => x.key);
    expect(p).toEqual(['kneeFlexion', 'kneeValgus', 'kneeVarus', 'kneeHyperextension']);
  });

  it('ignores a forward lean pattern for a backward-leaning head (not forward head posture)', () => {
    expect(detectPatterns(views({ left: [m('forwardHead', 'mild', { direction: 'backward' })] }))).toEqual([]);
  });

  it('detects trunk shift and trunk lean separately', () => {
    const p = detectPatterns(views({
      back: [m('trunkShift', 'mild', { side: 'right' })],
      right: [m('trunkLean', 'mild', { direction: 'forward' })],
    })).map((x) => x.key);
    expect(p).toEqual(['trunkShift', 'trunkLean']);
  });
});

describe('focusCategories', () => {
  it('collects unique exercise-library categories for the detected patterns, in pattern order', () => {
    const p = detectPatterns(views({
      left: [m('forwardHead', 'marked', { direction: 'forward' })],
      front: [m('pelvicLevel', 'mild')],
    }));
    expect(focusCategories(p)).toEqual(['neck', 'shoulder', 'core', 'lower_body', 'back']);
  });
});
