import { alignedLandmarks, jpeg, POSTURE_W, POSTURE_H } from './posture';
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
