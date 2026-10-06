// Flexibility tests (spec 2026-10-06-flexibility-tests-design): pure geometry on MediaPipe landmarks
// (normalised 0–1, y down), measured in pixels so non-square photos don't skew angles. Scores are
// recomputed from stored landmarks on every read, so tuning FLEX_SCORING re-scores history.
import { LM, MIN_VISIBILITY, round1, sagittalLandmarks, type Landmark, type Side } from './posture';

export type FlexShot = 'shoulderExtLeft' | 'shoulderExtRight' | 'forwardFold' | 'butterfly';
/** Capture order: standing side views first, then the seated test. */
export const FLEX_SHOTS: readonly FlexShot[] = ['shoulderExtLeft', 'shoulderExtRight', 'forwardFold', 'butterfly'];
export type FlexTest = 'shoulderExtension' | 'forwardFold' | 'butterfly';
export const FLEX_TESTS: readonly FlexTest[] = ['shoulderExtension', 'forwardFold', 'butterfly'];

/** Index-finger tips (MediaPipe 19/20); not in LM because posture never uses them. */
export const FLEX_FINGER = { LEFT: 19, RIGHT: 20 } as const;

export type Reach = 'aboveKnee' | 'knee' | 'shin' | 'ankle' | 'floor';
export const REACH_LEVELS: readonly Reach[] = ['aboveKnee', 'knee', 'shin', 'ankle', 'floor'];
export type FlexFlag = 'kneesBent' | 'heelsFar' | 'sideGap';
export type FlexBand = 'veryInflexible' | 'moderate' | 'flexible';

export interface ShotMeasure {
  /** Shoulder shots: arm angle behind the trunk line (negative = arm in front). */
  shoulderExtensionDeg?: number | null;
  /** Forward fold: trunk vs thigh at the hip (180 = upright). */
  hipAngleDeg?: number | null;
  kneeAngleDeg?: number | null;
  reach?: Reach | null;
  /** Butterfly: knee height above the floor ÷ shoulder width, per side (0 = knee on the floor). */
  kneeDrop?: { left: number | null; right: number | null };
  flags: FlexFlag[];
}
export type FlexMeasures = Partial<Record<FlexShot, ShotMeasure>>;

/**
 * Proposed cut-offs (linear, clamped 0–100), from standard range-of-motion norms; to be tuned by the
 * physio after the first clients. `zero` scores 0, `full` scores 100.
 */
export const FLEX_SCORING = {
  shoulderExtension: { zero: 0, full: 60 },      // degrees behind the trunk; normal ≈ 50–60°
  forwardFold: { zero: 150, full: 45 },          // hip angle in degrees (smaller = deeper)
  butterfly: { zero: 0.9, full: 0.15 },          // knee height ÷ shoulder width
  kneeStraightDeg: 165,                          // fold: knee angle below this = "knees bent"
  heelsFarRatio: 0.9,                            // butterfly: heel–hip distance ÷ shoulder width
  sideGapDeg: 15,                                // shoulder: left/right difference flagged
  reachTolerance: 0.03,                          // fold: within 3% of leg length counts as reaching a level
} as const;

export function flexBand(score: number | null): FlexBand | null {
  if (score === null) return null;
  return score <= 35 ? 'veryInflexible' : score <= 70 ? 'moderate' : 'flexible';
}

// ── geometry (pixels) ──────────────────────────────────────────────────────

interface Pt { x: number; y: number }
const DEG = 180 / Math.PI;

function pointsOf(landmarks: Landmark[], size: { width: number; height: number }) {
  const vis = (i: number) => landmarks[i]?.visibility >= MIN_VISIBILITY;
  const pt = (i: number): Pt | null => (vis(i) ? { x: landmarks[i].x * size.width, y: landmarks[i].y * size.height } : null);
  return { vis, pt };
}

/** Unsigned angle between vectors a and b, 0–180°. */
function angleBetween(a: Pt, b: Pt): number {
  const dot = a.x * b.x + a.y * b.y;
  const len = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return len ? Math.acos(Math.max(-1, Math.min(1, dot / len))) * DEG : 0;
}
const vec = (from: Pt, to: Pt): Pt => ({ x: to.x - from.x, y: to.y - from.y });
/** Interior angle at `vertex` (180 = straight line). */
const interiorAt = (a: Pt, vertex: Pt, c: Pt) => angleBetween(vec(vertex, a), vec(vertex, c));

/** +1 when the client faces image-right in a side shot (toes, then nose); `fallback` otherwise. */
function facingOf(landmarks: Landmark[], size: { width: number; height: number }, fallback: 1 | -1): 1 | -1 {
  const { pt } = pointsOf(landmarks, size);
  const s = sagittalLandmarks(landmarks);
  const heel = pt(s.heel), foot = pt(s.foot), nose = pt(LM.NOSE), ear = pt(s.ear);
  if (heel && foot && foot.x !== heel.x) return foot.x > heel.x ? 1 : -1;
  if (nose && ear && nose.x !== ear.x) return nose.x > ear.x ? 1 : -1;
  return fallback;
}

// ── measures ───────────────────────────────────────────────────────────────

function shoulderExtension(shot: 'shoulderExtLeft' | 'shoulderExtRight', landmarks: Landmark[], size: { width: number; height: number }): ShotMeasure {
  const { pt } = pointsOf(landmarks, size);
  const s = sagittalLandmarks(landmarks);
  const shoulder = pt(s.shoulder), hip = pt(s.hip), wrist = pt(s.wrist) ?? pt(s.elbow);
  if (!shoulder || !hip || !wrist) return { shoulderExtensionDeg: null, flags: [] };
  // Left side to the camera means the client faces image-left (same convention as the posture side views).
  const facing = facingOf(landmarks, size, shot === 'shoulderExtRight' ? 1 : -1);
  const angle = angleBetween(vec(shoulder, wrist), vec(shoulder, hip));
  const behind = (wrist.x - shoulder.x) * facing < 0;
  return { shoulderExtensionDeg: round1(behind || angle === 0 ? angle : -angle), flags: [] };
}

function forwardFold(landmarks: Landmark[], size: { width: number; height: number }): ShotMeasure {
  const { pt } = pointsOf(landmarks, size);
  const s = sagittalLandmarks(landmarks);
  const near = s.shoulder === LM.LEFT_SHOULDER ? 'LEFT' : 'RIGHT';
  const shoulder = pt(s.shoulder), hip = pt(s.hip), knee = pt(s.knee), ankle = pt(s.ankle);
  const heel = pt(s.heel), foot = pt(s.foot);
  const hand = pt(FLEX_FINGER[near]) ?? pt(s.wrist);

  const hipAngleDeg = shoulder && hip && knee ? round1(interiorAt(shoulder, hip, knee)) : null;
  const kneeAngleDeg = hip && knee && ankle ? round1(interiorAt(hip, knee, ankle)) : null;

  let reach: Reach | null = null;
  if (hand && hip && knee && ankle) {
    const floor = Math.max(ankle.y, heel?.y ?? ankle.y, foot?.y ?? ankle.y);
    const tol = FLEX_SCORING.reachTolerance * Math.hypot(ankle.x - hip.x, ankle.y - hip.y);
    const lines: [Reach, number][] = [['floor', floor], ['ankle', ankle.y], ['shin', (knee.y + ankle.y) / 2], ['knee', knee.y]];
    reach = lines.find(([, y]) => hand.y >= y - tol)?.[0] ?? 'aboveKnee';
  }
  const flags: FlexFlag[] = kneeAngleDeg !== null && kneeAngleDeg < FLEX_SCORING.kneeStraightDeg ? ['kneesBent'] : [];
  return { hipAngleDeg, kneeAngleDeg, reach, flags };
}

function butterfly(landmarks: Landmark[], size: { width: number; height: number }): ShotMeasure {
  const { pt } = pointsOf(landmarks, size);
  const ls = pt(LM.LEFT_SHOULDER), rs = pt(LM.RIGHT_SHOULDER);
  const width = ls && rs ? Math.abs(ls.x - rs.x) : 0;
  const ground = [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, LM.LEFT_ANKLE, LM.RIGHT_ANKLE]
    .map(pt).filter((p): p is Pt => p !== null);
  if (!width || !ground.length) return { kneeDrop: { left: null, right: null }, flags: [] };
  const floor = Math.max(...ground.map((p) => p.y));
  const drop = (i: number) => {
    const k = pt(i);
    return k ? Math.round((Math.max(0, floor - k.y) / width) * 100) / 100 : null;
  };

  const flags: FlexFlag[] = [];
  const lh = pt(LM.LEFT_HIP), rh = pt(LM.RIGHT_HIP), lhe = pt(LM.LEFT_HEEL), rhe = pt(LM.RIGHT_HEEL);
  if (lh && rh && lhe && rhe) {
    const hips = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const heels = { x: (lhe.x + rhe.x) / 2, y: (lhe.y + rhe.y) / 2 };
    if (Math.hypot(heels.x - hips.x, heels.y - hips.y) / width > FLEX_SCORING.heelsFarRatio) flags.push('heelsFar');
  }
  return { kneeDrop: { left: drop(LM.LEFT_KNEE), right: drop(LM.RIGHT_KNEE) }, flags };
}

export function measureShot(shot: FlexShot, landmarks: Landmark[], size: { width: number; height: number }): ShotMeasure {
  if (shot === 'forwardFold') return forwardFold(landmarks, size);
  if (shot === 'butterfly') return butterfly(landmarks, size);
  return shoulderExtension(shot, landmarks, size);
}

// ── scores ─────────────────────────────────────────────────────────────────

export interface FlexResult {
  score: number | null;
  band: FlexBand | null;
  /** Shoulder: per-side score; butterfly: per-knee score. */
  sides?: Record<Side, number | null>;
  flags: FlexFlag[];
}

const linear = (value: number | null | undefined, { zero, full }: { zero: number; full: number }) =>
  value == null ? null : Math.round(Math.max(0, Math.min(1, (value - zero) / (full - zero))) * 100);
const mean = (xs: (number | null)[]) => {
  const ok = xs.filter((x): x is number => x !== null);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
};
const result = (score: number | null, flags: FlexFlag[], sides?: Record<Side, number | null>): FlexResult =>
  ({ score, band: flexBand(score), ...(sides && { sides }), flags });

export function scoreFlexibility(m: FlexMeasures): Record<FlexTest, FlexResult | null> {
  let shoulderExtension: FlexResult | null = null;
  if (m.shoulderExtLeft || m.shoulderExtRight) {
    const l = m.shoulderExtLeft?.shoulderExtensionDeg ?? null, r = m.shoulderExtRight?.shoulderExtensionDeg ?? null;
    const sides = { left: linear(l, FLEX_SCORING.shoulderExtension), right: linear(r, FLEX_SCORING.shoulderExtension) };
    const gap = l !== null && r !== null && Math.abs(l - r) >= FLEX_SCORING.sideGapDeg;
    shoulderExtension = result(mean([sides.left, sides.right]), gap ? ['sideGap'] : [], sides);
  }

  const forwardFold = m.forwardFold
    ? result(linear(m.forwardFold.hipAngleDeg, FLEX_SCORING.forwardFold), m.forwardFold.flags)
    : null;

  let butterfly: FlexResult | null = null;
  if (m.butterfly) {
    const sides = {
      left: linear(m.butterfly.kneeDrop?.left, FLEX_SCORING.butterfly),
      right: linear(m.butterfly.kneeDrop?.right, FLEX_SCORING.butterfly),
    };
    butterfly = result(mean([sides.left, sides.right]), m.butterfly.flags, sides);
  }
  return { shoulderExtension, forwardFold, butterfly };
}
