import { describe, it, expect } from 'vitest';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { flexBand, FLEX_FINGER, measureShot, scoreFlexibility, type FlexMeasures } from '@/lib/flexibility';
import { LM, type Landmark } from '@/lib/posture';

const size = { width: POSTURE_W, height: POSTURE_H };
const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (from: [number, number], len: number, degFromDown: number, forward: 1 | -1 = 1): [number, number] =>
  [Math.round(from[0] + forward * len * Math.sin(rad(degFromDown))), Math.round(from[1] + len * Math.cos(rad(degFromDown)))];

// Side shot base (alignedLandmarks 'left'): near side LEFT, facing image-right (+x). Shoulder (500,500), hip (500,1000).
const shoulderShot = (extensionDeg: number) => alignedLandmarks('left', {
  LEFT_ELBOW: at([500, 500], 250, extensionDeg, -1),
  LEFT_WRIST: at([500, 500], 450, extensionDeg, -1), // behind the body = image-left
});

function withFinger(lms: Landmark[], side: 'LEFT' | 'RIGHT', [x, y]: [number, number]): Landmark[] {
  const out = lms.map((l) => ({ ...l }));
  out[FLEX_FINGER[side]] = { x: x / POSTURE_W, y: y / POSTURE_H, visibility: 1 };
  return out;
}

// Forward fold: hip (500,1000), knee (500,1450), ankle (500,1850), heel line 1880–1900.
const fold = (hipAngle: number, finger: [number, number], knee: [number, number] = [500, 1450]) => withFinger(alignedLandmarks('left', {
  LEFT_KNEE: knee,
  LEFT_SHOULDER: at([500, 1000], 450, hipAngle), // hip angle = trunk vs thigh (pointing down)
  LEFT_EAR: at([500, 1000], 600, hipAngle),
  LEFT_WRIST: [finger[0], finger[1] - 60],
}), 'LEFT', finger);

// Butterfly (front shot, seated): shoulders 400–600 (width 200), hips at y 1500; heels (floor line) at `heels`.
const butterfly = (kneeHeightLeft: number, kneeHeightRight: number, heels: [number, number] = [500, 1600]) => alignedLandmarks('front', {
  LEFT_SHOULDER: [600, 1100], RIGHT_SHOULDER: [400, 1100],
  LEFT_HIP: [560, 1500], RIGHT_HIP: [440, 1500],
  LEFT_KNEE: [780, heels[1] - kneeHeightLeft], RIGHT_KNEE: [220, heels[1] - kneeHeightRight],
  LEFT_ANKLE: [heels[0] + 20, heels[1] - 20], RIGHT_ANKLE: [heels[0] - 20, heels[1] - 20],
  LEFT_HEEL: [heels[0] + 15, heels[1]], RIGHT_HEEL: [heels[0] - 15, heels[1]],
  LEFT_FOOT_INDEX: [heels[0] + 10, heels[1] - 10], RIGHT_FOOT_INDEX: [heels[0] - 10, heels[1] - 10],
});

describe('measureShot — shoulder extension', () => {
  it('arms hanging = 0°, swept back = the angle behind the trunk', () => {
    expect(measureShot('shoulderExtLeft', shoulderShot(0), size).shoulderExtensionDeg).toBe(0);
    expect(measureShot('shoulderExtLeft', shoulderShot(45), size).shoulderExtensionDeg).toBeCloseTo(45, 0);
    expect(measureShot('shoulderExtLeft', shoulderShot(70), size).shoulderExtensionDeg).toBeCloseTo(70, 0);
  });

  it('arms in front of the body read as negative', () => {
    const forward = alignedLandmarks('left', { LEFT_WRIST: at([500, 500], 450, 30, 1) });
    expect(measureShot('shoulderExtLeft', forward, size).shoulderExtensionDeg).toBeCloseTo(-30, 0);
  });

  it('falls back to the elbow when the wrist is hidden; not measurable without either', () => {
    const lms = shoulderShot(45);
    lms[LM.LEFT_WRIST] = { x: 0, y: 0, visibility: 0 };
    expect(measureShot('shoulderExtLeft', lms, size).shoulderExtensionDeg).toBeCloseTo(45, 0);
    lms[LM.LEFT_ELBOW] = { x: 0, y: 0, visibility: 0 };
    expect(measureShot('shoulderExtLeft', lms, size).shoulderExtensionDeg).toBeNull();
  });
});

describe('measureShot — forward fold', () => {
  it('hip angle: upright ≈ 180°, deeper fold = smaller', () => {
    expect(measureShot('forwardFold', fold(170, [560, 1200]), size).hipAngleDeg).toBeCloseTo(170, 0);
    expect(measureShot('forwardFold', fold(90, [800, 1300]), size).hipAngleDeg).toBeCloseTo(90, 0);
    expect(measureShot('forwardFold', fold(45, [700, 1880]), size).hipAngleDeg).toBeCloseTo(45, 0);
  });

  it('reach level from the fingertip', () => {
    expect(measureShot('forwardFold', fold(90, [800, 1300]), size).reach).toBe('aboveKnee');
    expect(measureShot('forwardFold', fold(70, [700, 1500]), size).reach).toBe('knee');
    expect(measureShot('forwardFold', fold(60, [700, 1700]), size).reach).toBe('shin');
    expect(measureShot('forwardFold', fold(55, [700, 1840]), size).reach).toBe('ankle');
    expect(measureShot('forwardFold', fold(45, [700, 1890]), size).reach).toBe('floor');
  });

  it('flags bent knees', () => {
    expect(measureShot('forwardFold', fold(60, [700, 1700]), size).flags).toEqual([]);
    const bent = fold(60, [700, 1700], [620, 1420]); // knee pushed forward
    expect(measureShot('forwardFold', bent, size).kneeAngleDeg!).toBeLessThan(165);
    expect(measureShot('forwardFold', bent, size).flags).toEqual(['kneesBent']);
  });
});

describe('measureShot — butterfly', () => {
  it('knee height above the floor as a fraction of shoulder width, per side', () => {
    const m = measureShot('butterfly', butterfly(20, 180), size);
    expect(m.kneeDrop).toEqual({ left: 0.1, right: 0.9 });
    expect(m.flags).toEqual([]);
  });

  it('flags heels far from the pelvis', () => {
    expect(measureShot('butterfly', butterfly(20, 20, [500, 1700]), size).flags).toEqual(['heelsFar']);
  });
});

describe('flexBand', () => {
  it("uses FlexifyMe's bands", () => {
    expect([0, 35, 36, 70, 71, 100].map(flexBand)).toEqual(['veryInflexible', 'veryInflexible', 'moderate', 'moderate', 'flexible', 'flexible']);
    expect(flexBand(null)).toBeNull();
  });
});

describe('scoreFlexibility', () => {
  const measures = (extra: FlexMeasures = {}): FlexMeasures => ({
    shoulderExtLeft: measureShot('shoulderExtLeft', shoulderShot(60), size),
    shoulderExtRight: measureShot('shoulderExtRight', shoulderShot(30), size),
    forwardFold: measureShot('forwardFold', fold(45, [700, 1890]), size),
    butterfly: measureShot('butterfly', butterfly(30, 30), size),
    ...extra,
  });

  it('scores each test 0–100 with its band; shoulder = mean of sides', () => {
    const s = scoreFlexibility(measures());
    expect(s.shoulderExtension).toMatchObject({ score: 75, band: 'flexible', sides: { left: 100, right: 50 } });
    expect(s.forwardFold).toMatchObject({ score: 100, band: 'flexible', flags: [] });
    expect(s.butterfly).toMatchObject({ score: 100, band: 'flexible', sides: { left: 100, right: 100 } });
  });

  it('flags a left/right shoulder gap of 15° or more', () => {
    expect(scoreFlexibility(measures()).shoulderExtension!.flags).toEqual(['sideGap']);
    const even = measures({ shoulderExtRight: measureShot('shoulderExtRight', shoulderShot(50), size) });
    expect(scoreFlexibility(even).shoulderExtension!.flags).toEqual([]);
  });

  it('clamps to 0–100 and scales linearly between the cut-offs', () => {
    const s = scoreFlexibility(measures({
      shoulderExtLeft: measureShot('shoulderExtLeft', shoulderShot(0), size),
      shoulderExtRight: measureShot('shoulderExtRight', alignedLandmarks('left', { LEFT_WRIST: at([500, 500], 450, 30, 1) }), size),
      forwardFold: measureShot('forwardFold', fold(97.5, [800, 1300]), size),
    }));
    expect(s.shoulderExtension).toMatchObject({ score: 0, sides: { left: 0, right: 0 } });
    expect(s.forwardFold!.score).toBe(50);
  });

  it('a test is null when its shots are missing; one shoulder side is enough', () => {
    const s = scoreFlexibility({ shoulderExtLeft: measureShot('shoulderExtLeft', shoulderShot(45), size) });
    expect(s.shoulderExtension).toMatchObject({ score: 75, sides: { left: 75, right: null } });
    expect(s.forwardFold).toBeNull();
    expect(s.butterfly).toBeNull();
  });
});
