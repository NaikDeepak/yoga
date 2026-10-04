import { describe, it, expect } from 'vitest';
import {
  levelFromGravity,
  isLevel,
  rollFromReferenceLine,
  checkFrame,
  isStill,
  stillKeypoints,
  advanceCountdown,
  medianLandmarks,
  bodyCropRect,
  remapToCrop,
  bodyFill,
  LEVEL_TOLERANCE,
  type CountdownState,
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

  it('rejects a back-labelled pose in the front view', () => {
    expect(checkFrame('front', back(), size).facing).toBe(false);
  });

  it('accepts the back view whichever way MediaPipe labels left/right (it cannot see the face)', () => {
    expect(checkFrame('back', front(), size)).toEqual({ inFrame: true, facing: true });
  });

  it('accepts the back view when face points are only weakly detected', () => {
    const weakHead = back();
    for (const i of [LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE]) weakHead[i].visibility = 0.1;
    for (const i of [LM.LEFT_EAR, LM.RIGHT_EAR]) weakHead[i].visibility = 0.35;
    expect(checkFrame('back', weakHead, size).inFrame).toBe(true);
    const noHead = back();
    for (const i of [LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR]) noHead[i].visibility = 0;
    expect(checkFrame('back', noHead, size).inFrame).toBe(true); // shoulders at 25% height leave room for the head
    const headCut = back();
    for (const i of [LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR]) headCut[i].visibility = 0;
    headCut[LM.LEFT_SHOULDER] = { ...headCut[LM.LEFT_SHOULDER], y: 0.05 };
    headCut[LM.RIGHT_SHOULDER] = { ...headCut[LM.RIGHT_SHOULDER], y: 0.05 };
    expect(checkFrame('back', headCut, size).inFrame).toBe(false);
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

  it('measures side views from the near side even when the far side is hidden', () => {
    // Right side to camera: only RIGHT_* landmarks are visible; the hidden left side flickers below threshold.
    const rightSide = alignedLandmarks('left').map((l) => ({ ...l }));
    const near: [keyof typeof LM, keyof typeof LM][] = [
      ['LEFT_EAR', 'RIGHT_EAR'], ['LEFT_SHOULDER', 'RIGHT_SHOULDER'], ['LEFT_HIP', 'RIGHT_HIP'], ['LEFT_KNEE', 'RIGHT_KNEE'],
      ['LEFT_ANKLE', 'RIGHT_ANKLE'], ['LEFT_HEEL', 'RIGHT_HEEL'], ['LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'], ['LEFT_EYE', 'RIGHT_EYE'],
    ];
    for (const [l, r] of near) {
      rightSide[LM[r]] = rightSide[LM[l]];
      rightSide[LM[l]] = { ...rightSide[LM[l]], visibility: 0.45 };
    }
    expect(checkFrame('right', rightSide, size)).toEqual({ inFrame: true, facing: true });
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
    expect(isStill(Array.from({ length: 5 }, () => frame()), stillKeypoints('front', frame()))).toBe(false);
  });

  it('accepts tiny jitter and rejects movement', () => {
    const keys = stillKeypoints('front', frame());
    const steady = Array.from({ length: 15 }, (_, i) => frame((i % 2) * 0.002));
    expect(isStill(steady, keys)).toBe(true);
    const swaying = Array.from({ length: 15 }, (_, i) => frame(i * 0.002));
    expect(isStill(swaying, keys)).toBe(false);
  });

  it('tolerates a couple of glitchy frames in the window', () => {
    const keys = stillKeypoints('front', frame());
    const glitchy = Array.from({ length: 15 }, (_, i) => frame(i === 4 || i === 9 ? 0.03 : 0));
    expect(isStill(glitchy, keys)).toBe(true);
    const shaky = Array.from({ length: 15 }, (_, i) => frame(i % 3 === 0 ? 0.03 : 0)); // 5 of 15 off
    expect(isStill(shaky, keys)).toBe(false);
  });
});

describe('stillKeypoints', () => {
  it('ignores head points from behind, where the face is hidden and hair moves', () => {
    expect(stillKeypoints('front', alignedLandmarks('front'))).toContain(LM.NOSE);
    const back = stillKeypoints('back', alignedLandmarks('back'));
    expect(back).not.toContain(LM.NOSE);
    expect(back).toEqual(expect.arrayContaining([LM.LEFT_SHOULDER, LM.RIGHT_HIP, LM.LEFT_ANKLE]));
    // head jitter from behind doesn't break stillness
    const frames = Array.from({ length: 15 }, (_, i) => {
      const f = alignedLandmarks('back');
      f[LM.NOSE] = { ...f[LM.NOSE], x: f[LM.NOSE].x + (i % 2) * 0.03 };
      return f;
    });
    expect(isStill(frames, back)).toBe(true);
  });

  it('uses both sides from the front/back and only the near side from the side', () => {
    expect(stillKeypoints('front', alignedLandmarks('front'))).toContain(LM.RIGHT_SHOULDER);
    const side = stillKeypoints('left', alignedLandmarks('left'));
    expect(side).toContain(LM.LEFT_SHOULDER);
    expect(side).not.toContain(LM.RIGHT_SHOULDER);
  });

  it('ignores jitter on hidden far-side points in a side view', () => {
    const frames = Array.from({ length: 15 }, (_, i) => {
      const f = alignedLandmarks('left');
      f[LM.RIGHT_SHOULDER] = { x: 0.3 + (i % 2) * 0.1, y: 0.25, visibility: 0.3 };
      return f;
    });
    expect(isStill(frames, stillKeypoints('left', frames[0]))).toBe(true);
  });
});

describe('advanceCountdown', () => {
  const start: CountdownState = { okSince: null, lastOk: null };
  const run = (steps: [number, boolean][]) => {
    let state = start;
    let last = { remaining: null as number | null, fire: false };
    for (const [now, ok] of steps) {
      const r = advanceCountdown(state, ok, now);
      state = r.state;
      last = { remaining: r.remaining, fire: r.fire };
    }
    return last;
  };

  it('counts down 3-2-1 and fires after 3 s of all checks passing', () => {
    expect(run([[0, true]])).toEqual({ remaining: 3, fire: false });
    expect(run([[0, true], [1100, true]])).toEqual({ remaining: 2, fire: false });
    expect(run([[0, true], [2100, true]])).toEqual({ remaining: 1, fire: false });
    expect(run([[0, true], [3000, true]])).toEqual({ remaining: null, fire: true });
  });

  it('rides out brief dropouts (single bad frames) without restarting', () => {
    expect(run([[0, true], [900, true], [1000, false], [1300, true], [3000, true]])).toEqual({ remaining: null, fire: true });
  });

  it('restarts after a sustained failure', () => {
    expect(run([[0, true], [900, true], [1000, false], [1500, false]])).toEqual({ remaining: null, fire: false });
    expect(run([[0, true], [900, true], [1000, false], [1500, false], [1600, true]])).toEqual({ remaining: 3, fire: false });
  });

  it('stays idle while checks fail', () => {
    expect(run([[0, false], [500, false]])).toEqual({ remaining: null, fire: false });
  });
});

describe('medianLandmarks', () => {
  it('takes the per-point median, rejecting a single outlier detection', () => {
    const a = alignedLandmarks('front');
    const b = alignedLandmarks('front', { RIGHT_SHOULDER: [404, 500] });
    const outlier = alignedLandmarks('front', { RIGHT_SHOULDER: [480, 560] });
    const m = medianLandmarks([a, outlier, b]);
    expect(m[LM.RIGHT_SHOULDER].x * POSTURE_W).toBeCloseTo(404, 5);
    expect(m[LM.RIGHT_SHOULDER].y * POSTURE_H).toBeCloseTo(500, 5);
    expect(m).toHaveLength(33);
  });
});

describe('bodyCropRect / remapToCrop', () => {
  // Small figure in a wide frame, like a laptop camera.
  const W = 2000;
  const H = 2000;
  const lms = alignedLandmarks('front'); // body spans x 370–630, y 280–1900 on a 1000×2000 layout

  it('crops around the body with margins, staying inside the frame', () => {
    const r = bodyCropRect(lms, W, H);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(W);
    expect(r.y + r.h).toBeLessThanOrEqual(H);
    expect(r.w).toBeLessThan(W); // narrower than the frame
    // contains every visible landmark
    for (const l of lms.filter((p) => p.visibility >= 0.5)) {
      expect(l.x * W).toBeGreaterThanOrEqual(r.x);
      expect(l.x * W).toBeLessThanOrEqual(r.x + r.w);
      expect(l.y * H).toBeGreaterThanOrEqual(r.y);
      expect(l.y * H).toBeLessThanOrEqual(r.y + r.h);
    }
  });

  it('remaps landmarks into the crop so pixel positions are unchanged', () => {
    const r = bodyCropRect(lms, W, H);
    const mapped = remapToCrop(lms, W, H, r);
    const i = LM.LEFT_SHOULDER;
    expect(mapped[i].x * r.w + r.x).toBeCloseTo(lms[i].x * W, 6);
    expect(mapped[i].y * r.h + r.y).toBeCloseTo(lms[i].y * H, 6);
    expect(mapped[i].visibility).toBe(lms[i].visibility);
  });

  it('clamps far out-of-frame points so they stay within the accepted range', () => {
    const withStray = lms.map((l) => ({ ...l }));
    withStray[LM.LEFT_WRIST] = { x: -0.1, y: 0.5, visibility: 0.1 }; // hidden wrist guessed off-frame
    const r = bodyCropRect(withStray, W, H);
    const mapped = remapToCrop(withStray, W, H, r);
    for (const p of mapped) {
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.x).toBeLessThanOrEqual(1.5);
      expect(p.y).toBeGreaterThanOrEqual(-0.5);
      expect(p.y).toBeLessThanOrEqual(1.5);
    }
  });

  it('falls back to the full frame when too little of the body is visible', () => {
    const empty = lms.map((l) => ({ ...l, visibility: 0 }));
    expect(bodyCropRect(empty, W, H)).toEqual({ x: 0, y: 0, w: W, h: H });
  });
});

describe('bodyFill', () => {
  it('estimates standing height as a fraction of the frame height', () => {
    // eyes at 280, heels at 1880 → (1600 / 0.936) / 2000 = 0.855
    expect(bodyFill(alignedLandmarks('front'))).toBeCloseTo(0.855, 3);
  });

  it('returns null when the head or feet are not visible', () => {
    const noFeet = alignedLandmarks('front');
    for (const i of [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_ANKLE, LM.RIGHT_ANKLE]) noFeet[i].visibility = 0;
    expect(bodyFill(noFeet)).toBeNull();
  });
});
