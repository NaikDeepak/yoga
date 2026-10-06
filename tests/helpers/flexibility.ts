import { alignedLandmarks, jpeg, POSTURE_W, POSTURE_H } from './posture';
import { FLEX_FINGER } from '@/lib/flexibility';
import type { Landmark } from '@/lib/posture';
import type { FlexShot } from '@/lib/flexibility';
import type { FlexShotInput } from '@/data/flexibility';

/** A plausible saved shot: side shots on the side-view body (shoulder extension arms swept back ~45°), butterfly on the front body. */
export function flexShot(shot: FlexShot, overrides: Parameters<typeof alignedLandmarks>[1] = {}): FlexShotInput {
  const base = shot === 'butterfly'
    ? alignedLandmarks('front', overrides)
    : alignedLandmarks('left', { LEFT_ELBOW: [323, 677], LEFT_WRIST: [182, 818], ...overrides });
  return {
    shot, photo: jpeg(`${shot}.jpg`), imageWidth: POSTURE_W, imageHeight: POSTURE_H,
    landmarks: base, landmarksEdited: false, cameraCheck: { method: 'sensor', rollDeg: 0.2, pitchDeg: 0.4 },
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
export const at = (from: [number, number], len: number, degFromDown: number, forward: 1 | -1 = 1): [number, number] =>
  [Math.round(from[0] + forward * len * Math.sin(rad(degFromDown))), Math.round(from[1] + len * Math.cos(rad(degFromDown)))];

// Side shot base (alignedLandmarks 'left'): near side LEFT, facing image-right (+x). Shoulder (500,500), hip (500,1000).
export const shoulderShot = (extensionDeg: number) => alignedLandmarks('left', {
  LEFT_ELBOW: at([500, 500], 250, extensionDeg, -1),
  LEFT_WRIST: at([500, 500], 450, extensionDeg, -1), // behind the body = image-left
});

function withFinger(lms: Landmark[], side: 'LEFT' | 'RIGHT', [x, y]: [number, number]): Landmark[] {
  const out = lms.map((l) => ({ ...l }));
  out[FLEX_FINGER[side]] = { x: x / POSTURE_W, y: y / POSTURE_H, visibility: 1 };
  return out;
}

// Forward fold: hip (500,1000), knee (500,1450), ankle (500,1850), heel line 1880–1900.
export const fold = (hipAngle: number, finger: [number, number], knee: [number, number] = [500, 1450]) => withFinger(alignedLandmarks('left', {
  LEFT_KNEE: knee,
  LEFT_SHOULDER: at([500, 1000], 450, hipAngle), // hip angle = trunk vs thigh (pointing down)
  LEFT_EAR: at([500, 1000], 600, hipAngle),
  LEFT_WRIST: [finger[0], finger[1] - 60],
}), 'LEFT', finger);

// Butterfly (front shot, seated): shoulders 400–600 (width 200), hips at y 1500; heels (floor line) at `heels`.
export const butterfly = (kneeHeightLeft: number, kneeHeightRight: number, heels: [number, number] = [500, 1600]) => alignedLandmarks('front', {
  LEFT_SHOULDER: [600, 1100], RIGHT_SHOULDER: [400, 1100],
  LEFT_HIP: [560, 1500], RIGHT_HIP: [440, 1500],
  LEFT_KNEE: [780, heels[1] - kneeHeightLeft], RIGHT_KNEE: [220, heels[1] - kneeHeightRight],
  LEFT_ANKLE: [heels[0] + 20, heels[1] - 20], RIGHT_ANKLE: [heels[0] - 20, heels[1] - 20],
  LEFT_HEEL: [heels[0] + 15, heels[1]], RIGHT_HEEL: [heels[0] - 15, heels[1]],
  LEFT_FOOT_INDEX: [heels[0] + 10, heels[1] - 10], RIGHT_FOOT_INDEX: [heels[0] - 10, heels[1] - 10],
});

