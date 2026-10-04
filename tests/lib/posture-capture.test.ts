import { describe, it, expect } from 'vitest';
import {
  levelFromGravity,
  isLevel,
  rollFromReferenceLine,
  checkFrame,
  isStill,
  LEVEL_TOLERANCE,
} from '@/lib/posture-capture';
import { LM, type Landmark } from '@/lib/posture';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';

const g = 9.81;
const rad = (deg: number) => (deg * Math.PI) / 180;

describe('levelFromGravity', () => {
  it('reads an upright portrait phone as level', () => {
    expect(levelFromGravity({ x: 0, y: -g, z: 0 })).toEqual({ rollDeg: 0, pitchDeg: 0 });
  });

  it('measures roll (side-to-side) and pitch (leaning back/forward)', () => {
    const rolled = levelFromGravity({ x: g * Math.sin(rad(2)), y: -g * Math.cos(rad(2)), z: 0 })!;
    expect(Math.abs(rolled.rollDeg)).toBeCloseTo(2, 1);
    expect(rolled.pitchDeg).toBeCloseTo(0, 5);
    const pitched = levelFromGravity({ x: 0, y: -g * Math.cos(rad(5)), z: g * Math.sin(rad(5)) })!;
    expect(Math.abs(pitched.pitchDeg!)).toBeCloseTo(5, 1);
    expect(pitched.rollDeg).toBeCloseTo(0, 5);
  });

  it('measures roll against the nearest axis, so landscape and upside-down work too', () => {
    expect(Math.abs(levelFromGravity({ x: -g, y: 0, z: 0 })!.rollDeg)).toBeCloseTo(0, 5);
    expect(Math.abs(levelFromGravity({ x: 0, y: g, z: 0 })!.rollDeg)).toBeCloseTo(0, 5);
    const tilted = levelFromGravity({ x: -g * Math.cos(rad(3)), y: g * Math.sin(rad(3)), z: 0 })!;
    expect(Math.abs(tilted.rollDeg)).toBeCloseTo(3, 1);
  });

  it('returns null without a usable gravity reading (e.g. laptops report zeros or nulls)', () => {
    expect(levelFromGravity({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(levelFromGravity({ x: null, y: null, z: null })).toBeNull();
  });
});

describe('isLevel', () => {
  it('accepts readings within tolerance and rejects outside', () => {
    expect(LEVEL_TOLERANCE).toEqual({ rollDeg: 1.5, pitchDeg: 3 });
    expect(isLevel({ rollDeg: 1.5, pitchDeg: -3 })).toBe(true);
    expect(isLevel({ rollDeg: -1.6, pitchDeg: 0 })).toBe(false);
    expect(isLevel({ rollDeg: 0, pitchDeg: 3.1 })).toBe(false);
  });

  it('ignores pitch when it cannot be measured (door-frame calibration)', () => {
    expect(isLevel({ rollDeg: 1, pitchDeg: null })).toBe(true);
  });
});

describe('rollFromReferenceLine', () => {
  it('returns 0 for a perfectly vertical door frame', () => {
    expect(rollFromReferenceLine({ x: 300, y: 100 }, { x: 300, y: 900 })).toBe(0);
  });

  it('returns the signed angle from vertical regardless of which end is first', () => {
    // 21px over 800px → 1.5°
    const a = rollFromReferenceLine({ x: 300, y: 100 }, { x: 321, y: 900 })!;
    const b = rollFromReferenceLine({ x: 321, y: 900 }, { x: 300, y: 100 })!;
    expect(a).toBeCloseTo(1.5, 1);
    expect(b).toBeCloseTo(a, 10);
    expect(rollFromReferenceLine({ x: 321, y: 100 }, { x: 300, y: 900 })!).toBeCloseTo(-1.5, 1);
  });

  it('rejects lines that are too short or not roughly vertical', () => {
    expect(rollFromReferenceLine({ x: 300, y: 100 }, { x: 300, y: 130 })).toBeNull();
    expect(rollFromReferenceLine({ x: 100, y: 100 }, { x: 900, y: 300 })).toBeNull();
  });
});

describe('checkFrame', () => {
  const size = { width: POSTURE_W, height: POSTURE_H };
  // Front fixture: anatomical left (LEFT_* labels) at larger x, as MediaPipe labels a camera-facing person.
  const front = () => alignedLandmarks('front');
  // Back view: MediaPipe labels the client's left on image-left.
  const back = () => alignedLandmarks('back', {
    LEFT_SHOULDER: [400, 500], RIGHT_SHOULDER: [600, 500], LEFT_HIP: [440, 1000], RIGHT_HIP: [560, 1000],
  });

  it('accepts a well-framed client facing the right way', () => {
    expect(checkFrame('front', front(), size)).toEqual({ inFrame: true, facing: true });
    expect(checkFrame('back', back(), size)).toEqual({ inFrame: true, facing: true });
  });

  it('rejects front vs back confusion using the left/right label order', () => {
    expect(checkFrame('back', front(), size).facing).toBe(false);
    expect(checkFrame('front', back(), size).facing).toBe(false);
  });

  it('rejects a side-on body in a frontal view', () => {
    const turned = alignedLandmarks('front', { LEFT_SHOULDER: [520, 500], RIGHT_SHOULDER: [490, 500] });
    expect(checkFrame('front', turned, size).facing).toBe(false);
  });

  it('requires the feet and head inside the frame with a margin', () => {
    const cutFeet = front();
    cutFeet[LM.LEFT_HEEL] = { x: 0.56, y: 0.99, visibility: 0.9 };
    expect(checkFrame('front', cutFeet, size).inFrame).toBe(false);
    const hiddenKnee = front();
    hiddenKnee[LM.RIGHT_KNEE].visibility = 0.3;
    expect(checkFrame('front', hiddenKnee, size).inFrame).toBe(false);
    const noHead = front();
    for (const i of [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR]) noHead[i].visibility = 0;
    expect(checkFrame('front', noHead, size).inFrame).toBe(false);
  });

  it('checks the side views face the expected way (right side to camera → facing image-right)', () => {
    const facingRight = alignedLandmarks('left'); // toes point to +x
    expect(checkFrame('right', facingRight, size)).toEqual({ inFrame: true, facing: true });
    expect(checkFrame('left', facingRight, size).facing).toBe(false);
  });

  it('rejects a front-on body in a side view', () => {
    expect(checkFrame('right', front(), size).facing).toBe(false);
  });

  it('reports nothing usable for an empty frame', () => {
    const empty: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    expect(checkFrame('front', empty, size)).toEqual({ inFrame: false, facing: false });
    expect(checkFrame('left', empty, size)).toEqual({ inFrame: false, facing: false });
  });
});

describe('isStill', () => {
  const frame = (dx = 0) => alignedLandmarks('front').map((l) => ({ ...l, x: l.x + dx }));

  it('needs enough frames before it can say the client is still', () => {
    expect(isStill(Array.from({ length: 5 }, () => frame()))).toBe(false);
  });

  it('accepts tiny jitter and rejects movement', () => {
    const steady = Array.from({ length: 15 }, (_, i) => frame((i % 2) * 0.002));
    expect(isStill(steady)).toBe(true);
    const swaying = Array.from({ length: 15 }, (_, i) => frame(i * 0.002));
    expect(isStill(swaying)).toBe(false);
  });
});
