// Pure checks used by the live posture capture screen: camera level (phone gravity sensor or a
// door-frame reference line), framing, facing direction and stillness. No camera/DOM access here.
import {
  EYE_LEVEL_STATURE_RATIO, eyeToHeelSpan, LM, MIN_VISIBILITY, sagittalLandmarks, type Landmark, type PostureView,
} from './posture';

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

export const EDGE = 0.02; // normalised margin the body must keep from the frame edges
export const FRONTAL_MIN_WIDTH_RATIO = 0.3;  // shoulder width ÷ torso height when square to the camera
const SAGITTAL_MAX_WIDTH_RATIO = 0.2; // ... and when side-on

const FRONTAL_REQUIRED = [
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE,
  LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL,
];
const HEAD = [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR];
const BACK_HEAD = [LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR];
const BACK_HEAD_VISIBILITY = 0.3;
const HEAD_ROOM = 0.1; // shoulders at least 10% down the frame leave room for the head

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
    // From behind the face is hidden, so head points come back weak or missing: accept a weaker
    // detection, or failing that, enough room above the shoulders for the head.
    const backHeadOk = () =>
      BACK_HEAD.some((i) => lms[i].visibility >= BACK_HEAD_VISIBILITY && inside(i))
      || (vis(LM.LEFT_SHOULDER) && vis(LM.RIGHT_SHOULDER)
        && (lms[LM.LEFT_SHOULDER].y + lms[LM.RIGHT_SHOULDER].y) / 2 >= HEAD_ROOM);
    const inFrame = (view === 'front' ? headOk : backHeadOk()) && FRONTAL_REQUIRED.every((i) => vis(i) && inside(i));
    const ratio = vis(LM.RIGHT_SHOULDER) ? shoulderRatio(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP) : null;
    const square = ratio !== null && ratio >= FRONTAL_MIN_WIDTH_RATIO;
    // Facing the camera, MediaPipe puts the LEFT labels on image-right. From behind its labelling is
    // unreliable (the back view failed on a real device), so it only needs the client square to the camera —
    // metrics assign sides by image position, not by these labels.
    if (view === 'back') return { inFrame, facing: square };
    return { inFrame, facing: square && lms[LM.LEFT_SHOULDER].x > lms[LM.RIGHT_SHOULDER].x };
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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const FRONTAL_STILL_KEYPOINTS = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
export const STILL_MIN_FRAMES = 15;  // ≈0.5–1 s of video
const STILL_MAX_SHIFT = 0.008;       // normalised image units from the window's median position
const STILL_MIN_FRACTION = 0.8;      // share of frames that must be within tolerance

/**
 * Points to watch for stillness. From behind, head points are skipped (the face is hidden, so the
 * detector guesses and hair movement makes them jump); side views use only the near side.
 */
export function stillKeypoints(view: PostureView, lms: Landmark[]): number[] {
  if (view === 'front') return FRONTAL_STILL_KEYPOINTS;
  if (view === 'back') return FRONTAL_STILL_KEYPOINTS.filter((i) => i !== LM.NOSE);
  const s = sagittalLandmarks(lms);
  return [LM.NOSE, s.ear, s.shoulder, s.hip, s.knee, s.ankle];
}

/**
 * True when, over the recent frames (oldest first), at least 80% keep every watched point within
 * a small radius of its median position. Robust to a few glitchy detections; real swaying fails.
 */
export function isStill(
  frames: Landmark[][],
  keypoints: number[],
  minFrames = STILL_MIN_FRAMES,
  maxShift = STILL_MAX_SHIFT,
): boolean {
  if (frames.length < minFrames) return false;
  const recent = frames.slice(-minFrames);
  const centre = keypoints.map((i) => ({
    x: median(recent.map((f) => f[i].x)),
    y: median(recent.map((f) => f[i].y)),
  }));
  const steady = recent.filter((f) => keypoints.every((i, k) =>
    Math.hypot(f[i].x - centre[k].x, f[i].y - centre[k].y) <= maxShift)).length;
  return steady / recent.length >= STILL_MIN_FRACTION;
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

// ── still-photo processing ──────────────────────────────────────────────────

/** Per-point median of several detections of the same still pose; damps single-frame jitter/outliers. */
export function medianLandmarks(frames: Landmark[][]): Landmark[] {
  return frames[0].map((_, i) => ({
    x: median(frames.map((f) => f[i].x)),
    y: median(frames.map((f) => f[i].y)),
    visibility: median(frames.map((f) => f[i].visibility)),
  }));
}

export interface CropRect { x: number; y: number; w: number; h: number }

const HEAD_ABOVE_EYES = 0.08; // of eye-to-heel span: crown of the head sits above the eye/ear landmarks
const CROP_PAD_Y = 0.05;
const CROP_PAD_X = 0.15;
const MIN_ASPECT = 0.5;       // crop at least half as wide as tall, so arms and stance fit

/**
 * Crop rectangle (image pixels) around the body with margins, clamped to the frame. Keeps the photo
 * at full camera resolution where it matters while dropping empty background (laptop cameras are wide).
 */
export function bodyCropRect(lms: Landmark[], width: number, height: number): CropRect {
  const pts = lms.filter((l) => l.visibility >= MIN_VISIBILITY).map((l) => ({ x: l.x * width, y: l.y * height }));
  if (pts.length < 3) return { x: 0, y: 0, w: width, h: height };
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  const span = maxY - minY;
  const top = minY - span * (HEAD_ABOVE_EYES + CROP_PAD_Y);
  const bottom = maxY + span * CROP_PAD_Y;
  const h = bottom - top;
  const w = Math.max((maxX - minX) * (1 + 2 * CROP_PAD_X), h * MIN_ASPECT);
  const cx = (minX + maxX) / 2;
  const x0 = Math.max(0, Math.round(cx - w / 2));
  const y0 = Math.max(0, Math.round(top));
  const x1 = Math.min(width, Math.round(cx + w / 2));
  const y1 = Math.min(height, Math.round(bottom));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Re-expresses normalised landmarks relative to a crop of the original frame. */
// Hidden points MediaPipe guesses far off-frame would otherwise land outside the range the server
// accepts and fail the whole save. They're low-visibility, so clamping doesn't affect any metric.
const CROP_CLAMP = { min: -0.5, max: 1.5 };
const clampCrop = (v: number) => Math.min(CROP_CLAMP.max, Math.max(CROP_CLAMP.min, v));

export function remapToCrop(lms: Landmark[], width: number, height: number, r: CropRect): Landmark[] {
  return lms.map((l) => ({
    x: clampCrop((l.x * width - r.x) / r.w),
    y: clampCrop((l.y * height - r.y) / r.h),
    visibility: l.visibility,
  }));
}

/** Recommended minimum: body should fill this much of the frame height for precise angles. */
export const BODY_FILL_TARGET = 0.75;

/** Estimated standing height as a fraction of the frame height, or null if head/feet aren't visible. */
export function bodyFill(lms: Landmark[]): number | null {
  const span = eyeToHeelSpan(lms);
  return span === null ? null : span / EYE_LEVEL_STATURE_RATIO;
}
