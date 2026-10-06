// Ideal reference figures shown beside the client's photos (posture views and flexibility shots).
// They are plain landmark sets run through the same measuring and drawing code as a real capture, so
// tests can prove each ideal posture view measures "normal" and each ideal flexibility pose scores 100:
// the ideal can never contradict the report.
import { computeViewMetrics, LM, POSE_LANDMARK_COUNT, POSTURE_VIEWS, type Landmark, type Metric } from './posture';
import { FLEX_FINGER, FLEX_SHOTS } from './flexibility';
import { isFlexShot, shotOverlay, type CaptureShot } from './capture-shots';
import type { Overlay } from './posture-overlay';

export const IDEAL_SHOTS: readonly CaptureShot[] = [...POSTURE_VIEWS, ...FLEX_SHOTS];

type Size = { width: number; height: number };
const STANDING: Size = { width: 1000, height: 2000 };
const SEATED: Size = { width: 1000, height: 1400 };
export const idealSize = (shot: CaptureShot): Size => (shot === 'butterfly' ? SEATED : STANDING);

type Px = Record<number, [number, number]>;

// Facing the camera (front/back views): symmetric, level, stacked over the midline. The client's
// left side is on image-right, as MediaPipe labels a person facing the camera.
const FRONTAL: Px = {
  [LM.NOSE]: [500, 300], [LM.LEFT_EYE]: [520, 280], [LM.RIGHT_EYE]: [480, 280], [LM.LEFT_EAR]: [545, 295], [LM.RIGHT_EAR]: [455, 295],
  [LM.LEFT_SHOULDER]: [610, 500], [LM.RIGHT_SHOULDER]: [390, 500], [LM.LEFT_ELBOW]: [640, 740], [LM.RIGHT_ELBOW]: [360, 740],
  [LM.LEFT_WRIST]: [650, 960], [LM.RIGHT_WRIST]: [350, 960],
  [LM.LEFT_HIP]: [560, 1000], [LM.RIGHT_HIP]: [440, 1000], [LM.LEFT_KNEE]: [560, 1450], [LM.RIGHT_KNEE]: [440, 1450],
  [LM.LEFT_ANKLE]: [560, 1850], [LM.RIGHT_ANKLE]: [440, 1850], [LM.LEFT_HEEL]: [560, 1880], [LM.RIGHT_HEEL]: [440, 1880],
  [LM.LEFT_FOOT_INDEX]: [575, 1900], [LM.RIGHT_FOOT_INDEX]: [425, 1900],
};

// Side view facing image-right (right side to the camera): ear, shoulder, hip, knee and ankle on one plumb line.
const SIDE: Px = {
  [LM.NOSE]: [545, 300], [LM.LEFT_EYE]: [525, 280], [LM.LEFT_EAR]: [500, 290],
  [LM.LEFT_SHOULDER]: [500, 500], [LM.LEFT_ELBOW]: [500, 740], [LM.LEFT_WRIST]: [500, 960],
  [LM.LEFT_HIP]: [500, 1000], [LM.LEFT_KNEE]: [500, 1450], [LM.LEFT_ANKLE]: [500, 1850],
  [LM.LEFT_HEEL]: [470, 1880], [LM.LEFT_FOOT_INDEX]: [560, 1900],
};

// Shoulder extension: the side figure with straight arms swept 65° behind the trunk (target ≥ 60°).
const SHOULDER_EXT: Px = { ...SIDE, [LM.LEFT_ELBOW]: [273, 606], [LM.LEFT_WRIST]: [92, 690] };

// Forward fold: knees straight, trunk folded to 40° from the thigh (target ≤ 45°), palms on the floor.
const FOLD: Px = {
  [LM.NOSE]: [850, 1480], [LM.LEFT_EAR]: [836, 1460],
  [LM.LEFT_SHOULDER]: [739, 1345], [LM.LEFT_ELBOW]: [739, 1600], [LM.LEFT_WRIST]: [735, 1840], [FLEX_FINGER.LEFT]: [735, 1895],
  [LM.LEFT_HIP]: [450, 1000], [LM.LEFT_KNEE]: [450, 1450], [LM.LEFT_ANKLE]: [450, 1850],
  [LM.LEFT_HEEL]: [420, 1880], [LM.LEFT_FOOT_INDEX]: [510, 1900],
};

// Butterfly: seated tall facing the camera, soles together close to the pelvis, knees on the floor.
const BUTTERFLY: Px = {
  [LM.NOSE]: [500, 200], [LM.LEFT_EYE]: [520, 185], [LM.RIGHT_EYE]: [480, 185], [LM.LEFT_EAR]: [545, 195], [LM.RIGHT_EAR]: [455, 195],
  [LM.LEFT_SHOULDER]: [600, 400], [LM.RIGHT_SHOULDER]: [400, 400], [LM.LEFT_ELBOW]: [640, 600], [LM.RIGHT_ELBOW]: [360, 600],
  [LM.LEFT_WRIST]: [560, 800], [LM.RIGHT_WRIST]: [440, 800],
  [LM.LEFT_HIP]: [560, 850], [LM.RIGHT_HIP]: [440, 850], [LM.LEFT_KNEE]: [800, 1000], [LM.RIGHT_KNEE]: [200, 1000],
  [LM.LEFT_ANKLE]: [530, 990], [LM.RIGHT_ANKLE]: [470, 990], [LM.LEFT_HEEL]: [515, 1010], [LM.RIGHT_HEEL]: [485, 1010],
  [LM.LEFT_FOOT_INDEX]: [520, 1000], [LM.RIGHT_FOOT_INDEX]: [480, 1000],
};

const mirror = (px: Px, width: number): Px =>
  Object.fromEntries(Object.entries(px).map(([i, [x, y]]) => [i, [width - x, y]])) as Px;

/** Left side to the camera faces image-left: the right-facing figure mirrored. */
const POINTS: Record<CaptureShot, Px> = {
  front: FRONTAL,
  back: FRONTAL,
  right: SIDE,
  left: mirror(SIDE, STANDING.width),
  shoulderExtRight: SHOULDER_EXT,
  shoulderExtLeft: mirror(SHOULDER_EXT, STANDING.width),
  forwardFold: FOLD,
  butterfly: BUTTERFLY,
};

export function idealLandmarks(shot: CaptureShot): Landmark[] {
  const { width, height } = idealSize(shot);
  const out: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [i, [x, y]] of Object.entries(POINTS[shot])) out[Number(i)] = { x: x / width, y: y / height, visibility: 1 };
  return out;
}

/** What to draw: the same overlay as a capture; posture lines coloured by their (normal) metrics. */
export function idealFigure(shot: CaptureShot): { overlay: Overlay; metrics: Metric[] } {
  const lms = idealLandmarks(shot);
  const size = idealSize(shot);
  return {
    overlay: shotOverlay(shot, lms, size.width, size.height),
    metrics: isFlexShot(shot) ? [] : computeViewMetrics(shot, lms, size),
  };
}
