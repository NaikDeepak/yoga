import { describe, it, expect } from 'vitest';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { at, butterfly, fold, shoulderShot } from '../helpers/flexibility';
import { flexBand, measureShot, scoreFlexibility, type FlexMeasures } from '@/lib/flexibility';
import { LM } from '@/lib/posture';

const size = { width: POSTURE_W, height: POSTURE_H };
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
