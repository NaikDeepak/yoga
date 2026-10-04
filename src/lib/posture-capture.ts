// Pure checks used by the live posture capture screen: camera level (phone gravity sensor or a
// door-frame reference line), framing, facing direction and stillness. No camera/DOM access here.
import { LM, MIN_VISIBILITY, sagittalLandmarks, type Landmark, type PostureView } from './posture';

/** Shoulder level is flagged from 2°, so the camera itself must be within 1.5° of roll. */
export const LEVEL_TOLERANCE = { rollDeg: 1.5, pitchDeg: 3 } as const;

export interface Level { rollDeg: number; pitchDeg: number | null }

/** How the camera's level was verified for a photo; stored with each view. */
export interface CameraCheck extends Level { method: 'sensor' | 'reference' }

const DEG = 180 / Math.PI;
const round2 = (n: number) => Math.round(n * 100) / 100 + 0; // + 0 turns -0 into 0

/**
 * Camera tilt from DeviceMotion `accelerationIncludingGravity`. Uses the gravity vector rather than
 * DeviceOrientation angles, which become unstable exactly when a phone stands upright (gimbal lock).
 * Roll is measured against the nearest device axis, so portrait, landscape and upside-down all work.
 */
export function levelFromGravity(g: { x: number | null; y: number | null; z: number | null }): Level | null {
  const { x, y, z } = g;
  if (x === null || y === null || z === null) return null;
  if (Math.hypot(x, y, z) < 5) return null; // no real gravity reading (desktops often report zeros)
  const inPlane = Math.atan2(x, y) * DEG;
  let roll = ((inPlane % 90) + 90) % 90;
  if (roll > 45) roll -= 90;
  const pitch = Math.atan2(z, Math.hypot(x, y)) * DEG;
  return { rollDeg: round2(roll), pitchDeg: round2(pitch) };
}

export function isLevel(level: Level, tol: { rollDeg: number; pitchDeg: number } = LEVEL_TOLERANCE): boolean {
  return Math.abs(level.rollDeg) <= tol.rollDeg && (level.pitchDeg === null || Math.abs(level.pitchDeg) <= tol.pitchDeg);
}

const MIN_REFERENCE_PX = 100;
const MAX_REFERENCE_DEG = 30;

/**
 * Camera roll from a line the therapist drew along a true vertical (door frame, wall corner),
 * in image pixels. Signed degrees from vertical; null if the line is too short or clearly not vertical.
 */
export function rollFromReferenceLine(a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  if (Math.hypot(dx, dy) < MIN_REFERENCE_PX) return null;
  const angle = Math.atan2(dx, dy) * DEG;
  return Math.abs(angle) > MAX_REFERENCE_DEG ? null : angle;
}

export interface FrameChecks { inFrame: boolean; facing: boolean }

const EDGE = 0.02; // normalised margin the body must keep from the frame edges
const FRONTAL_MIN_WIDTH_RATIO = 0.3;  // shoulder width ÷ torso height when square to the camera
const SAGITTAL_MAX_WIDTH_RATIO = 0.2; // ... and when side-on

const FRONTAL_REQUIRED = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE,
  LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL,
];
const HEAD = [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR];

export function checkFrame(view: PostureView, lms: Landmark[], size: { width: number; height: number }): FrameChecks {
  const vis = (i: number) => lms[i].visibility >= MIN_VISIBILITY;
  const inside = (i: number) => lms[i].x >= EDGE && lms[i].x <= 1 - EDGE && lms[i].y >= EDGE && lms[i].y <= 1 - EDGE;
  const px = (i: number) => ({ x: lms[i].x * size.width, y: lms[i].y * size.height });

  /** Apparent shoulder width ÷ torso height: large when square to the camera, small when side-on. */
  const shoulderRatio = (near: number, far: number, nearHip: number) => {
    if (!vis(near) || !vis(nearHip)) return null;
    const width = vis(far) ? Math.abs(px(near).x - px(far).x) : 0; // hidden far shoulder ⇒ fully side-on
    const torso = Math.abs(px(nearHip).y - px(near).y);
    return torso > 0 ? width / torso : null;
  };
  const headOk = HEAD.some((i) => vis(i) && inside(i));

  if (view === 'front' || view === 'back') {
    const inFrame = headOk && FRONTAL_REQUIRED.every((i) => vis(i) && inside(i));
    const ratio = vis(LM.RIGHT_SHOULDER) ? shoulderRatio(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP) : null;
    // MediaPipe labels a camera-facing person's left on image-right, and a back-facing person's on image-left.
    const labelsMatch = view === 'front'
      ? lms[LM.LEFT_SHOULDER].x > lms[LM.RIGHT_SHOULDER].x
      : lms[LM.LEFT_SHOULDER].x < lms[LM.RIGHT_SHOULDER].x;
    return { inFrame, facing: ratio !== null && ratio >= FRONTAL_MIN_WIDTH_RATIO && labelsMatch };
  }

  const s = sagittalLandmarks(lms);
  const required = [s.ear, s.shoulder, s.hip, s.knee, s.ankle, s.heel, s.foot];
  const inFrame = headOk && required.every((i) => vis(i) && inside(i));
  // Client's right side to the camera means they face image-right (+x); left side → image-left.
  let facingDir = 0;
  if (vis(s.foot) && vis(s.heel)) facingDir = Math.sign(lms[s.foot].x - lms[s.heel].x);
  else if (vis(LM.NOSE) && vis(s.ear)) facingDir = Math.sign(lms[LM.NOSE].x - lms[s.ear].x);
  // Measure from the near side: the far side is occluded and its visibility flickers around the threshold.
  const farShoulder = s.shoulder === LM.LEFT_SHOULDER ? LM.RIGHT_SHOULDER : LM.LEFT_SHOULDER;
  const ratio = shoulderRatio(s.shoulder, farShoulder, s.hip);
  const expected = view === 'right' ? 1 : -1;
  return { inFrame, facing: facingDir === expected && ratio !== null && ratio <= SAGITTAL_MAX_WIDTH_RATIO };
}

const FRONTAL_STILL_KEYPOINTS = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
export const STILL_MIN_FRAMES = 15; // ≈0.5–1 s of video
const STILL_MAX_SHIFT = 0.006;      // normalised image units

/** Points to watch for stillness — side views use only the near side (the far side jitters while occluded). */
export function stillKeypoints(view: PostureView, lms: Landmark[]): number[] {
  if (view === 'front' || view === 'back') return FRONTAL_STILL_KEYPOINTS;
  const s = sagittalLandmarks(lms);
  return [LM.NOSE, s.ear, s.shoulder, s.hip, s.knee, s.ankle];
}

/** True when the given points have stayed within a small radius across the recent frames (oldest first). */
export function isStill(
  frames: Landmark[][],
  keypoints: number[],
  minFrames = STILL_MIN_FRAMES,
  maxShift = STILL_MAX_SHIFT,
): boolean {
  if (frames.length < minFrames) return false;
  const recent = frames.slice(-minFrames);
  const first = recent[0];
  return recent.every((f) => keypoints.every((i) =>
    Math.hypot(f[i].x - first[i].x, f[i].y - first[i].y) <= maxShift));
}

export interface CountdownState { okSince: number | null; lastOk: number | null }
export const COUNTDOWN_SECONDS = 3;
const COUNTDOWN_GRACE_MS = 500; // single bad frames (detector noise) don't restart the countdown

/**
 * Auto-capture countdown, advanced once per video frame. Counts from when all checks started
 * passing; brief failures (≤ 500 ms) are ignored, longer ones reset it. `fire` = take the photo now.
 */
export function advanceCountdown(
  state: CountdownState,
  ok: boolean,
  now: number,
): { state: CountdownState; remaining: number | null; fire: boolean } {
  const idle: CountdownState = { okSince: null, lastOk: null };
  let next: CountdownState;
  if (ok) next = { okSince: state.okSince ?? now, lastOk: now };
  else if (state.lastOk !== null && now - state.lastOk <= COUNTDOWN_GRACE_MS) next = state;
  else next = idle;

  if (next.okSince === null) return { state: next, remaining: null, fire: false };
  const elapsed = now - next.okSince;
  if (elapsed >= COUNTDOWN_SECONDS * 1000) return { state: idle, remaining: null, fire: true };
  return { state: next, remaining: COUNTDOWN_SECONDS - Math.floor(elapsed / 1000), fire: false };
}
