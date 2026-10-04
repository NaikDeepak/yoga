import { describe, it, expect } from 'vitest';
import { buildOverlay, type OverlayLine } from '@/lib/posture-overlay';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { LM } from '@/lib/posture';

const measure = (lines: OverlayLine[], metric: string) => lines.find((l) => l.kind === 'measure' && l.metric === metric);
const refs = (lines: OverlayLine[]) => lines.filter((l) => l.kind === 'reference');

describe('buildOverlay — frontal views', () => {
  it('draws the measured lines in image pixels', () => {
    const o = buildOverlay('front', alignedLandmarks('front', { RIGHT_SHOULDER: [400, 535] }), POSTURE_W, POSTURE_H);
    expect(o).toMatchObject({ width: POSTURE_W, height: POSTURE_H });
    expect(measure(o.lines, 'shoulderLevel')).toMatchObject({ x1: 600, y1: 500, x2: 400, y2: 535 });
    expect(measure(o.lines, 'pelvicLevel')).toMatchObject({ x1: 560, y1: 1000, x2: 440, y2: 1000 });
    expect(measure(o.lines, 'headTilt')).toMatchObject({ x1: 520, y1: 280, x2: 480, y2: 280 });
  });

  it('adds a full-height plumb line through the mid-ankles and level references at the higher point', () => {
    const o = buildOverlay('front', alignedLandmarks('front', { RIGHT_SHOULDER: [400, 535] }), POSTURE_W, POSTURE_H);
    const r = refs(o.lines);
    expect(r).toContainEqual(expect.objectContaining({ x1: 500, y1: 0, x2: 500, y2: POSTURE_H }));
    // Shoulder reference: horizontal at y=500 (the higher shoulder), extended 40px past both ends
    expect(r).toContainEqual(expect.objectContaining({ x1: 360, y1: 500, x2: 640, y2: 500 }));
  });

  it('uses the ear line for head tilt from the back', () => {
    const o = buildOverlay('back', alignedLandmarks('back'), POSTURE_W, POSTURE_H);
    expect(measure(o.lines, 'headTilt')).toMatchObject({ x1: 540, x2: 460, y1: 290 });
  });

  it('skips points and lines whose landmarks are hidden', () => {
    const lms = alignedLandmarks('front');
    lms[LM.RIGHT_SHOULDER].visibility = 0.2;
    const o = buildOverlay('front', lms, POSTURE_W, POSTURE_H);
    expect(measure(o.lines, 'shoulderLevel')).toBeUndefined();
    expect(o.points).not.toContainEqual(expect.objectContaining({ x: 400, y: 500 }));
    expect(o.lines.some((l) => l.x1 === 400 && l.y1 === 500)).toBe(false);
    expect(o.points).toContainEqual({ x: 600, y: 500, index: LM.LEFT_SHOULDER });
  });

  it('omits the plumb line when the ankles are hidden', () => {
    const lms = alignedLandmarks('front');
    lms[LM.LEFT_ANKLE].visibility = 0;
    const o = buildOverlay('front', lms, POSTURE_W, POSTURE_H);
    expect(refs(o.lines).some((l) => l.x1 === l.x2)).toBe(false);
  });
});

describe('buildOverlay — side views', () => {
  it('draws only the near side, with CVA and trunk lines and a plumb line at the ankle', () => {
    const lms = alignedLandmarks('left', { LEFT_EAR: [710, 290] });
    lms[LM.RIGHT_KNEE] = { x: 0.1, y: 0.1, visibility: 0.6 }; // far side, visible but not drawn
    const o = buildOverlay('left', lms, POSTURE_W, POSTURE_H);
    expect(measure(o.lines, 'forwardHead')).toMatchObject({ x1: 500, y1: 500, x2: 710, y2: 290 });
    expect(measure(o.lines, 'trunkLean')).toMatchObject({ x1: 500, y1: 1000, x2: 500, y2: 500 });
    expect(refs(o.lines)).toContainEqual(expect.objectContaining({ x1: 500, y1: 0, x2: 500, y2: POSTURE_H }));
    expect(o.points).not.toContainEqual(expect.objectContaining({ x: 100, y: 200 }));
  });

  it('adds a horizontal reference at shoulder height for the CVA', () => {
    const o = buildOverlay('right', alignedLandmarks('right'), POSTURE_W, POSTURE_H);
    expect(refs(o.lines)).toContainEqual(expect.objectContaining({ y1: 500, y2: 500 }));
  });
});
