// What to draw over a posture photo: skeleton, reference lines (plumb + true horizontals)
// and the measured lines, in image-pixel coordinates. Pure — rendered by PostureFigure.
import { LM, MIN_VISIBILITY, sagittalLandmarks, type Landmark, type MetricKey, type PostureView } from './posture';

/** `index` is the MediaPipe landmark index (for editing). */
export interface OverlayPoint { x: number; y: number; index: number }
export interface OverlayLine {
  x1: number; y1: number; x2: number; y2: number;
  kind: 'bone' | 'reference' | 'measure';
  /** For 'measure' lines: the metric whose severity colours the line. */
  metric?: MetricKey;
}
export interface Overlay { width: number; height: number; points: OverlayPoint[]; lines: OverlayLine[] }

const LEVEL_REF_PAD = 40;     // px a level reference extends past the measured points
const CVA_REF_LENGTH = 160;   // px of the horizontal drawn at shoulder height

const FRONTAL_POINTS = [
  LM.NOSE, LM.LEFT_EYE, LM.RIGHT_EYE, LM.LEFT_EAR, LM.RIGHT_EAR,
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST,
  LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX,
];

// Shoulder and hip cross-lines are drawn as measures, not bones.
const FRONTAL_BONES: [number, number][] = (['LEFT', 'RIGHT'] as const).flatMap((s) => [
  [LM[`${s}_SHOULDER`], LM[`${s}_ELBOW`]], [LM[`${s}_ELBOW`], LM[`${s}_WRIST`]],
  [LM[`${s}_SHOULDER`], LM[`${s}_HIP`]], [LM[`${s}_HIP`], LM[`${s}_KNEE`]], [LM[`${s}_KNEE`], LM[`${s}_ANKLE`]],
  [LM[`${s}_ANKLE`], LM[`${s}_HEEL`]], [LM[`${s}_HEEL`], LM[`${s}_FOOT_INDEX`]], [LM[`${s}_ANKLE`], LM[`${s}_FOOT_INDEX`]],
] as [number, number][]);

export function buildOverlay(view: PostureView, landmarks: Landmark[], width: number, height: number): Overlay {
  const px = (i: number) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
  const shown = (...idx: number[]) => idx.every((i) => landmarks[i].visibility >= MIN_VISIBILITY);
  const line = (a: number, b: number, kind: OverlayLine['kind'], metric?: MetricKey): OverlayLine => {
    const p = px(a), q = px(b);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, kind, ...(metric && { metric }) };
  };
  const plumbAt = (x: number): OverlayLine => ({ x1: x, y1: 0, x2: x, y2: height, kind: 'reference' });

  const lines: OverlayLine[] = [];
  let pointIdx: number[];
  const bones: [number, number][] = [];

  if (view === 'front' || view === 'back') {
    pointIdx = FRONTAL_POINTS;
    bones.push(...FRONTAL_BONES);
    if (shown(LM.LEFT_ANKLE, LM.RIGHT_ANKLE)) {
      lines.push(plumbAt((px(LM.LEFT_ANKLE).x + px(LM.RIGHT_ANKLE).x) / 2));
    }
    const head: [number, number] = view === 'front' ? [LM.LEFT_EYE, LM.RIGHT_EYE] : [LM.LEFT_EAR, LM.RIGHT_EAR];
    const levels: [MetricKey, number, number][] = [
      ['headTilt', ...head], ['shoulderLevel', LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], ['pelvicLevel', LM.LEFT_HIP, LM.RIGHT_HIP],
    ];
    for (const [metric, a, b] of levels) {
      if (!shown(a, b)) continue;
      const p = px(a), q = px(b);
      const y = Math.min(p.y, q.y);
      lines.push({ x1: Math.min(p.x, q.x) - LEVEL_REF_PAD, y1: y, x2: Math.max(p.x, q.x) + LEVEL_REF_PAD, y2: y, kind: 'reference' });
      lines.push(line(a, b, 'measure', metric));
    }
  } else {
    const s = sagittalLandmarks(landmarks);
    pointIdx = [LM.NOSE, s.ear, s.shoulder, s.elbow, s.wrist, s.hip, s.knee, s.ankle, s.heel, s.foot];
    bones.push(
      [s.shoulder, s.elbow], [s.elbow, s.wrist], [s.hip, s.knee], [s.knee, s.ankle],
      [s.ankle, s.heel], [s.heel, s.foot], [s.ankle, s.foot],
    );
    if (shown(s.ankle)) lines.push(plumbAt(px(s.ankle).x));
    if (shown(s.shoulder)) {
      const p = px(s.shoulder);
      lines.push({ x1: p.x - CVA_REF_LENGTH / 2, y1: p.y, x2: p.x + CVA_REF_LENGTH / 2, y2: p.y, kind: 'reference' });
    }
    if (shown(s.shoulder, s.ear)) lines.push(line(s.shoulder, s.ear, 'measure', 'forwardHead'));
    if (shown(s.hip, s.shoulder)) lines.push(line(s.hip, s.shoulder, 'measure', 'trunkLean'));
  }

  for (const [a, b] of bones) if (shown(a, b)) lines.push(line(a, b, 'bone'));
  const points = pointIdx.filter((i) => shown(i)).map((i) => ({ ...px(i), index: i }));
  return { width, height, points, lines };
}
