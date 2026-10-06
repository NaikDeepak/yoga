import { describe, it, expect } from 'vitest';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { butterfly, fold, shoulderShot } from '../helpers/flexibility';
import { isFlexShot, shotEditablePoints, shotFrameChecks, shotOverlay, shotStillKeypoints } from '@/lib/capture-shots';
import { checkFrame, stillKeypoints } from '@/lib/posture-capture';
import { buildOverlay } from '@/lib/posture-overlay';
import { FLEX_FINGER } from '@/lib/flexibility';
import { LM, type Landmark } from '@/lib/posture';

const size = { width: POSTURE_W, height: POSTURE_H };
const hide = (lms: Landmark[], ...idx: number[]) => lms.map((l, i) => (idx.includes(i) ? { ...l, visibility: 0 } : l));
// Mirror a side shot so the client faces image-left (left side to the camera).
const mirror = (lms: Landmark[]) => lms.map((l) => ({ ...l, x: l.visibility ? 1 - l.x : l.x }));

describe('isFlexShot', () => {
  it('tells flexibility shots from posture views', () => {
    expect(isFlexShot('butterfly')).toBe(true);
    expect(isFlexShot('front')).toBe(false);
  });
});

describe('posture views pass straight through', () => {
  it('uses the posture checks and overlay unchanged', () => {
    const lms = alignedLandmarks('front');
    expect(shotFrameChecks('front', lms, size)).toEqual(checkFrame('front', lms, size));
    expect(shotStillKeypoints('front', lms)).toEqual(stillKeypoints('front', lms));
    expect(shotOverlay('front', lms, 1000, 2000)).toEqual(buildOverlay('front', lms, 1000, 2000));
  });
});

describe('shoulder extension shots', () => {
  it('right side to the camera (facing image-right) passes for the right shot, not the left', () => {
    const lms = shoulderShot(45);
    expect(shotFrameChecks('shoulderExtRight', lms, size)).toEqual({ inFrame: true, facing: true });
    expect(shotFrameChecks('shoulderExtLeft', lms, size).facing).toBe(false);
    expect(shotFrameChecks('shoulderExtLeft', mirror(lms), size).facing).toBe(true);
  });

  it('needs the arm in frame', () => {
    const s = hide(shoulderShot(45), LM.LEFT_WRIST, LM.LEFT_ELBOW);
    expect(shotFrameChecks('shoulderExtRight', s, size).inFrame).toBe(false);
  });

  it('draws the trunk reference and the measured arm line', () => {
    const o = shotOverlay('shoulderExtRight', shoulderShot(45), 1000, 2000);
    expect(o.lines.filter((l) => l.kind === 'measure')).toHaveLength(1);
    expect(o.lines.some((l) => l.kind === 'reference')).toBe(true);
    expect(shotStillKeypoints('shoulderExtRight', shoulderShot(45))).toContain(LM.LEFT_WRIST);
  });
});

describe('forward fold shot', () => {
  it('passes side-on in either direction; the head may hang out of view', () => {
    const lms = hide(fold(60, [700, 1700]), LM.NOSE, LM.LEFT_EAR, LM.LEFT_EYE);
    expect(shotFrameChecks('forwardFold', lms, size)).toEqual({ inFrame: true, facing: true });
    expect(shotFrameChecks('forwardFold', mirror(lms), size).facing).toBe(true);
  });

  it('fails square to the camera (both hips wide apart)', () => {
    const lms = fold(60, [700, 1700]);
    lms[LM.RIGHT_HIP] = { x: 0.8, y: 0.5, visibility: 1 };
    expect(shotFrameChecks('forwardFold', lms, size).facing).toBe(false);
  });

  it('lets the therapist place the fingertip', () => {
    expect(shotEditablePoints('forwardFold', fold(60, [700, 1700]), 1000, 2000).map((p) => p.index)).toContain(FLEX_FINGER.LEFT);
  });
});

describe('butterfly shot', () => {
  it('passes seated square to the camera without needing a standing frame', () => {
    expect(shotFrameChecks('butterfly', butterfly(30, 30), size)).toEqual({ inFrame: true, facing: true });
  });

  it('fails turned away (shoulders crossed over)', () => {
    const lms = butterfly(30, 30);
    [lms[LM.LEFT_SHOULDER], lms[LM.RIGHT_SHOULDER]] = [lms[LM.RIGHT_SHOULDER], lms[LM.LEFT_SHOULDER]];
    expect(shotFrameChecks('butterfly', lms, size).facing).toBe(false);
  });

  it('needs both knees', () => {
    expect(shotFrameChecks('butterfly', hide(butterfly(30, 30), LM.RIGHT_KNEE), size).inFrame).toBe(false);
  });

  it('draws the floor line and a drop line per knee', () => {
    const o = shotOverlay('butterfly', butterfly(30, 90), 1000, 2000);
    expect(o.lines.filter((l) => l.kind === 'measure')).toHaveLength(2);
    expect(o.lines.filter((l) => l.kind === 'reference')).toHaveLength(1);
  });
});
