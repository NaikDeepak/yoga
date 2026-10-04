// Posture metrics from MediaPipe Pose landmarks (33 points, normalised 0–1 image coords, y down).
// Pure geometry — no camera or model code here. See
// docs/superpowers/specs/2026-10-04-ai-posture-analysis-design.md for the clinical rationale.

export const POSE_LANDMARK_COUNT = 33;

export const LM = {
  NOSE: 0,
  LEFT_EYE: 2, RIGHT_EYE: 5,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

export type PostureView = 'front' | 'back' | 'left' | 'right';
/** Capture order. */
export const POSTURE_VIEWS: readonly PostureView[] = ['front', 'right', 'back', 'left'];

export interface Landmark { x: number; y: number; visibility: number }
export type Side = 'left' | 'right';
export type Direction = 'forward' | 'backward' | 'valgus' | 'varus';
export type Severity = 'normal' | 'mild' | 'marked';
export type MetricUnit = 'deg' | 'cm' | 'pct';
export type MetricKey =
  | 'headTilt' | 'shoulderLevel' | 'pelvicLevel' | 'trunkShift' | 'headShift'
  | 'kneeAlignment' | 'armHang' | 'hindfoot'
  | 'forwardHead' | 'headForward' | 'shoulderForward' | 'trunkLean' | 'pelvicShift' | 'pelvicTilt' | 'kneeSagittal';

export interface Metric {
  key: MetricKey;
  /** Magnitude rounded to 1 decimal; null = not measurable (landmark hidden). */
  value: number | null;
  unit: MetricUnit;
  /** Frontal views: the lower/shifted side, or the leg/foot measured. Sagittal views: null. */
  side: Side | null;
  direction: Direction | null;
  /** null = no threshold (informational) or not measurable. */
  severity: Severity | null;
  /** 2D estimate of a 3D/bony measure — show an "approx" tag. */
  approx: boolean;
}

export interface ImageInfo { width: number; height: number; heightCm?: number | null }

export const MIN_VISIBILITY = 0.5;
// Eye level sits at ~93.6% of standing height (Drillis & Contini).
export const EYE_LEVEL_STATURE_RATIO = 0.936;

/** Per-leg measures: `side` names the leg (kept even when not measurable), `direction` the deviation. */
export const LIMB_METRICS: ReadonlySet<MetricKey> = new Set<MetricKey>(['kneeAlignment', 'hindfoot']);
export const SEVERITY_RANK: Record<Severity, number> = { normal: 0, mild: 1, marked: 2 };
export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Vertical span from the highest visible eye/ear to the lowest visible heel (ankle as fallback),
 * in normalised image units — the basis for estimating standing height. Null if head or feet are hidden.
 */
export function eyeToHeelSpan(landmarks: Landmark[]): number | null {
  const vis = (i: number) => landmarks[i].visibility >= MIN_VISIBILITY;
  const tops = [LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR].filter(vis).map((i) => landmarks[i].y);
  let bottoms = [LM.LEFT_HEEL, LM.RIGHT_HEEL].filter(vis).map((i) => landmarks[i].y);
  if (!bottoms.length) bottoms = [LM.LEFT_ANKLE, LM.RIGHT_ANKLE].filter(vis).map((i) => landmarks[i].y);
  if (!tops.length || !bottoms.length) return null;
  const span = Math.max(...bottoms) - Math.min(...tops);
  return span > 0 ? span : null;
}

const APPROX = new Set<MetricKey>(['pelvicLevel', 'kneeAlignment', 'hindfoot', 'forwardHead', 'pelvicTilt']);

interface Threshold { mild: number; marked: number }
// Starting limits from photogrammetry literature; see spec "Severity bands".
export const THRESHOLDS: Partial<Record<MetricKey, Threshold>> = {
  headTilt: { mild: 2, marked: 4 },
  shoulderLevel: { mild: 2, marked: 4 },
  pelvicLevel: { mild: 2, marked: 4 },
  trunkShift: { mild: 2, marked: 4 },
  headShift: { mild: 2.5, marked: 5 },
  trunkLean: { mild: 2, marked: 4 },
  kneeAlignment: { mild: 5, marked: 10 },
  kneeSagittal: { mild: 5, marked: 10 },
  forwardHead: { mild: 10, marked: 20 },
};

export function severity(key: MetricKey, value: number | null, _unit?: MetricUnit): Severity | null {
  const t = THRESHOLDS[key];
  if (value === null || !t) return null;
  if (value < t.mild) return 'normal';
  return value <= t.marked ? 'mild' : 'marked';
}

// ── geometry ────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; visible: boolean }

const DEG = 180 / Math.PI;
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visible: a.visible && b.visible });
const visible = (...pts: Pt[]) => pts.every((p) => p.visible);

/** Acute angle of line a–b against the horizontal. */
const angleFromHorizontal = (a: Pt, b: Pt) => Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * DEG;
/** Acute angle of line a–b against the vertical. */
const angleFromVertical = (a: Pt, b: Pt) => Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * DEG;

/** 180° minus the interior angle at `vertex` — 0 for a straight limb. */
function bendAt(a: Pt, vertex: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const v2 = Math.atan2(c.y - vertex.y, c.x - vertex.x);
  let interior = Math.abs(v1 - v2) * DEG;
  if (interior > 180) interior = 360 - interior;
  return 180 - interior;
}

/** x of the a–c line at y (for "is the joint inside/outside the line" checks). */
const lineXAt = (a: Pt, c: Pt, y: number) => (c.y === a.y ? a.x : a.x + ((y - a.y) / (c.y - a.y)) * (c.x - a.x));

function metric(
  key: MetricKey,
  raw: number | null,
  unit: MetricUnit,
  opts: { side?: Side | null; direction?: Direction | null } = {},
): Metric {
  const value = raw === null ? null : round1(raw);
  return {
    key,
    value,
    unit,
    side: value === null && !LIMB_METRICS.has(key) ? null : opts.side ?? null,
    direction: value === null || value === 0 ? null : opts.direction ?? null,
    severity: severity(key, value, unit),
    approx: APPROX.has(key),
  };
}

type Scale = ((px: number) => { value: number; unit: MetricUnit }) | null;

/** Converts pixel distances to cm (with known height) or % of stature. */
function makeScale(landmarks: Landmark[], imageHeight: number, heightCm: number | null | undefined): Scale {
  const span = eyeToHeelSpan(landmarks);
  if (span === null) return null;
  const stature = (span * imageHeight) / EYE_LEVEL_STATURE_RATIO;
  return heightCm && heightCm > 0
    ? (px) => ({ value: (px / stature) * heightCm, unit: 'cm' })
    : (px) => ({ value: (px / stature) * 100, unit: 'pct' });
}

function distance(
  key: MetricKey,
  scale: Scale,
  px: number | null,
  opts: { side?: Side | null; direction?: Direction | null } = {},
): Metric {
  if (px === null || !scale) return metric(key, null, 'cm');
  const { value, unit } = scale(Math.abs(px));
  return metric(key, value, unit, opts);
}

// ── frontal plane (front / back) ────────────────────────────────────────────

function frontalMetrics(view: 'front' | 'back', pts: Pt[], scale: Scale): Metric[] {
  // MediaPipe's left/right labels are unreliable when the client faces away, so assign
  // anatomical sides by image position: facing the camera, the client's left is image-right.
  const pair = (l: number, r: number): { left: Pt; right: Pt } => {
    const [lo, hi] = pts[l].x <= pts[r].x ? [pts[l], pts[r]] : [pts[r], pts[l]];
    return view === 'front' ? { left: hi, right: lo } : { left: lo, right: hi };
  };
  const shiftSide = (dx: number): Side | null => (dx === 0 ? null : (dx > 0) === (view === 'front') ? 'left' : 'right');
  const lowerSide = (p: { left: Pt; right: Pt }): Side | null =>
    p.left.y > p.right.y ? 'left' : p.right.y > p.left.y ? 'right' : null;

  const level = (key: MetricKey, p: { left: Pt; right: Pt }) =>
    visible(p.left, p.right)
      ? metric(key, angleFromHorizontal(p.left, p.right), 'deg', { side: lowerSide(p) })
      : metric(key, null, 'deg');

  const head = view === 'front' ? pair(LM.LEFT_EYE, LM.RIGHT_EYE) : pair(LM.LEFT_EAR, LM.RIGHT_EAR);
  const shoulders = pair(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const hips = pair(LM.LEFT_HIP, LM.RIGHT_HIP);
  const knees = pair(LM.LEFT_KNEE, LM.RIGHT_KNEE);
  const ankles = pair(LM.LEFT_ANKLE, LM.RIGHT_ANKLE);
  const heels = pair(LM.LEFT_HEEL, LM.RIGHT_HEEL);
  const wrists = pair(LM.LEFT_WRIST, LM.RIGHT_WRIST);
  const midline = mid(hips.left, hips.right).x;

  // Lateral lean of the line lower→upper from vertical, in degrees (FlexifyMe-style "shift ~N°"),
  // which unlike a cm offset doesn't depend on knowing the client's height.
  const shiftAngle = (key: MetricKey, upper: Pt, lower: Pt) =>
    visible(upper, lower)
      ? metric(key, angleFromVertical(lower, upper), 'deg', { side: shiftSide(upper.x - lower.x) })
      : metric(key, null, 'deg');

  const out: Metric[] = [
    level('headTilt', head),
    level('shoulderLevel', shoulders),
    level('pelvicLevel', hips),
    shiftAngle('trunkShift', mid(shoulders.left, shoulders.right), mid(hips.left, hips.right)),
    shiftAngle('headShift', mid(head.left, head.right), mid(shoulders.left, shoulders.right)),
  ];

  for (const side of ['left', 'right'] as const) {
    const hip = hips[side], knee = knees[side], ankle = ankles[side];
    if (!visible(hip, knee, ankle, hips.left, hips.right)) {
      out.push(metric('kneeAlignment', null, 'deg', { side }));
      continue;
    }
    const inside = Math.abs(knee.x - midline) < Math.abs(lineXAt(hip, ankle, knee.y) - midline);
    out.push(metric('kneeAlignment', bendAt(hip, knee, ankle), 'deg', { side, direction: inside ? 'valgus' : 'varus' }));
  }

  if (visible(wrists.left, wrists.right, hips.left, hips.right)) {
    const gapL = Math.abs(wrists.left.x - hips.left.x);
    const gapR = Math.abs(wrists.right.x - hips.right.x);
    const side: Side | null = gapL > gapR ? 'left' : gapR > gapL ? 'right' : null;
    out.push(distance('armHang', scale, gapL - gapR, { side }));
  } else {
    out.push(metric('armHang', null, 'cm'));
  }

  if (view === 'back') {
    for (const side of ['left', 'right'] as const) {
      const heel = heels[side], ankle = ankles[side];
      if (!visible(heel, ankle, hips.left, hips.right)) {
        out.push(metric('hindfoot', null, 'deg', { side }));
        continue;
      }
      const medial = Math.abs(ankle.x - midline) < Math.abs(heel.x - midline);
      out.push(metric('hindfoot', angleFromVertical(heel, ankle), 'deg', { side, direction: medial ? 'valgus' : 'varus' }));
    }
  }

  return out;
}

// ── sagittal plane (left / right) ───────────────────────────────────────────

const SAGITTAL_KEYS: [MetricKey, MetricUnit][] = [
  ['forwardHead', 'deg'], ['headForward', 'cm'], ['shoulderForward', 'cm'], ['trunkLean', 'deg'],
  ['pelvicShift', 'cm'], ['pelvicTilt', 'deg'], ['kneeSagittal', 'deg'],
];

const sagittalIdx = (s: 'LEFT' | 'RIGHT') => ({
  ear: LM[`${s}_EAR`], shoulder: LM[`${s}_SHOULDER`], elbow: LM[`${s}_ELBOW`], wrist: LM[`${s}_WRIST`],
  hip: LM[`${s}_HIP`], knee: LM[`${s}_KNEE`], ankle: LM[`${s}_ANKLE`], heel: LM[`${s}_HEEL`], foot: LM[`${s}_FOOT_INDEX`],
});

/** Side of the body facing the camera in a side view (higher total visibility). */
export function sagittalNearSide(landmarks: Landmark[]): 'LEFT' | 'RIGHT' {
  const score = (s: 'LEFT' | 'RIGHT') => {
    const i = sagittalIdx(s);
    return [i.ear, i.shoulder, i.hip, i.knee, i.ankle].reduce((sum, idx) => sum + landmarks[idx].visibility, 0);
  };
  return score('LEFT') >= score('RIGHT') ? 'LEFT' : 'RIGHT';
}

/** Landmark indices of the near side in a side view. */
export const sagittalLandmarks = (landmarks: Landmark[]) => sagittalIdx(sagittalNearSide(landmarks));

function sagittalMetrics(pts: Pt[], raw: Landmark[], scale: Scale): Metric[] {
  const s = sagittalLandmarks(raw);
  const [ear, shoulder, hip, knee, ankle, heel, foot] =
    [s.ear, s.shoulder, s.hip, s.knee, s.ankle, s.heel, s.foot].map((i) => pts[i]);
  const nose = pts[LM.NOSE];

  // +1 when the client faces image-right. Toes point forward; nose-ahead-of-ear is the fallback.
  let facing = 0;
  if (visible(heel, foot) && foot.x !== heel.x) facing = Math.sign(foot.x - heel.x);
  else if (visible(nose, ear) && nose.x !== ear.x) facing = Math.sign(nose.x - ear.x);
  if (facing === 0) return SAGITTAL_KEYS.map(([key, unit]) => metric(key, null, unit));

  const ahead = (a: Pt, b: Pt) => (a.x - b.x) * facing; // + when a is in front of b
  const dir = (d: number): Direction => (d > 0 ? 'forward' : 'backward');

  const vsPlumb = (key: MetricKey, p: Pt) => {
    if (!visible(p, ankle)) return metric(key, null, 'cm');
    const d = ahead(p, ankle);
    return distance(key, scale, d, { direction: dir(d) });
  };
  const leanFromVertical = (key: MetricKey, upper: Pt, lower: Pt) =>
    visible(upper, lower)
      ? metric(key, angleFromVertical(lower, upper), 'deg', { direction: dir(ahead(upper, lower)) })
      : metric(key, null, 'deg');

  let kneeSagittal = metric('kneeSagittal', null, 'deg');
  if (visible(hip, knee, ankle)) {
    const d = ahead(knee, { x: lineXAt(hip, ankle, knee.y), y: knee.y, visible: true });
    kneeSagittal = metric('kneeSagittal', bendAt(hip, knee, ankle), 'deg', { direction: dir(d) });
  }

  return [
    // Forward head: shoulder→ear line from vertical (0° = ear stacked over shoulder). The shoulder
    // landmark stands in for C7, so this is not the clinical craniovertebral angle.
    leanFromVertical('forwardHead', ear, shoulder),
    vsPlumb('headForward', ear),
    vsPlumb('shoulderForward', shoulder),
    leanFromVertical('trunkLean', shoulder, hip),
    vsPlumb('pelvicShift', hip),
    leanFromVertical('pelvicTilt', hip, knee),
    kneeSagittal,
  ];
}

// ── entry point ─────────────────────────────────────────────────────────────

export function computeViewMetrics(view: PostureView, landmarks: Landmark[], image: ImageInfo): Metric[] {
  if (landmarks.length !== POSE_LANDMARK_COUNT) {
    throw new Error(`Expected ${POSE_LANDMARK_COUNT} landmarks, got ${landmarks.length}`);
  }
  // Work in pixels so angles are correct on non-square images.
  const pts: Pt[] = landmarks.map((l) => ({
    x: l.x * image.width,
    y: l.y * image.height,
    visible: l.visibility >= MIN_VISIBILITY,
  }));
  const scale = makeScale(landmarks, image.height, image.heightCm);
  return view === 'front' || view === 'back'
    ? frontalMetrics(view, pts, scale)
    : sagittalMetrics(pts, landmarks, scale);
}
