// One entry point for everything the capture screen and the landmark editor need per shot, whether
// it's a posture view (delegated unchanged to posture-capture / posture-overlay / posture) or a
// flexibility shot (spec 2026-10-06-flexibility-tests). Pure — no camera or DOM access.
import { LM, MIN_VISIBILITY, computeViewMetrics, sagittalLandmarks, type Landmark, type Metric, type PostureView } from './posture';
import { checkFrame, EDGE, FRONTAL_MIN_WIDTH_RATIO, stillKeypoints, type FrameChecks } from './posture-capture';
import { buildOverlay, editablePoints, editablePointsFor, type EditablePoint, type Overlay, type OverlayLine } from './posture-overlay';
import { FLEX_FINGER, FLEX_SHOTS, type FlexShot } from './flexibility';

export type CaptureShot = PostureView | FlexShot;

export const isFlexShot = (shot: CaptureShot): shot is FlexShot => (FLEX_SHOTS as readonly string[]).includes(shot);

type Size = { width: number; height: number };

function helpers(lms: Landmark[], size: Size) {
  const vis = (i: number) => lms[i].visibility >= MIN_VISIBILITY;
  const inside = (i: number) => lms[i].x >= EDGE && lms[i].x <= 1 - EDGE && lms[i].y >= EDGE && lms[i].y <= 1 - EDGE;
  const ok = (i: number) => vis(i) && inside(i);
  const px = (i: number) => ({ x: lms[i].x * size.width, y: lms[i].y * size.height });
  return { vis, ok, px };
}

/** Indices for a side shot: near side, plus the fingertip for the fold. */
function sidePoints(shot: FlexShot, lms: Landmark[]): number[] {
  const s = sagittalLandmarks(lms);
  const finger = FLEX_FINGER[s.shoulder === LM.LEFT_SHOULDER ? 'LEFT' : 'RIGHT'];
  return [LM.NOSE, s.ear, s.shoulder, s.elbow, s.wrist, ...(shot === 'forwardFold' ? [finger] : []), s.hip, s.knee, s.ankle, s.heel, s.foot];
}

const BUTTERFLY_POINTS = [
  LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST,
  LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL,
];

// ── framing ────────────────────────────────────────────────────────────────

function flexFrame(shot: FlexShot, lms: Landmark[], size: Size): FrameChecks {
  const { vis, ok, px } = helpers(lms, size);

  if (shot === 'butterfly') {
    const required = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE];
    const feet = [LM.LEFT_HEEL, LM.RIGHT_HEEL].every(ok) || [LM.LEFT_ANKLE, LM.RIGHT_ANKLE].every(ok);
    const head = [LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR].some(ok); // "sit tall" needs the head in view
    const inFrame = head && required.every(ok) && feet;
    if (!vis(LM.LEFT_SHOULDER) || !vis(LM.RIGHT_SHOULDER) || !vis(LM.LEFT_HIP) || !vis(LM.RIGHT_HIP)) return { inFrame, facing: false };
    const ls = px(LM.LEFT_SHOULDER), rs = px(LM.RIGHT_SHOULDER);
    const torso = Math.abs((px(LM.LEFT_HIP).y + px(LM.RIGHT_HIP).y) / 2 - (ls.y + rs.y) / 2);
    // Facing the camera puts the client's left shoulder on image-right (as for the front posture view).
    const facing = torso > 0 && Math.abs(ls.x - rs.x) / torso >= FRONTAL_MIN_WIDTH_RATIO && ls.x > rs.x;
    return { inFrame, facing };
  }

  const s = sagittalLandmarks(lms);
  const hand = ok(s.wrist) || ok(s.elbow);
  if (shot === 'forwardFold') {
    const finger = FLEX_FINGER[s.shoulder === LM.LEFT_SHOULDER ? 'LEFT' : 'RIGHT'];
    // The head hangs down in a fold, so it isn't required.
    const inFrame = [s.shoulder, s.hip, s.knee, s.ankle].every(ok) && (ok(finger) || ok(s.wrist));
    // Side-on: the far hip is hidden or close to the near one (lenient: either direction is fine).
    const farHip = s.hip === LM.LEFT_HIP ? LM.RIGHT_HIP : LM.LEFT_HIP;
    let facing = false;
    if (vis(s.hip) && vis(s.knee)) {
      const thigh = Math.hypot(px(s.knee).x - px(s.hip).x, px(s.knee).y - px(s.hip).y);
      facing = !vis(farHip) || (thigh > 0 && Math.abs(px(farHip).x - px(s.hip).x) / thigh <= 0.35);
    }
    return { inFrame, facing };
  }

  // Shoulder extension: standing side-on like the posture side views, with the arm in frame.
  const head = [LM.NOSE, s.ear].some(ok);
  const inFrame = head && hand && [s.shoulder, s.hip, s.knee, s.ankle].every(ok);
  // Facing direction and side-on: the posture side-view rules (toes first, then nose vs ear).
  const { facing } = checkFrame(shot === 'shoulderExtRight' ? 'right' : 'left', lms, size);
  return { inFrame, facing };
}

export function shotFrameChecks(shot: CaptureShot, lms: Landmark[], size: Size): FrameChecks {
  return isFlexShot(shot) ? flexFrame(shot, lms, size) : checkFrame(shot, lms, size);
}

export function shotStillKeypoints(shot: CaptureShot, lms: Landmark[]): number[] {
  if (!isFlexShot(shot)) return stillKeypoints(shot, lms);
  if (shot === 'butterfly') return [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE];
  const s = sagittalLandmarks(lms);
  return shot === 'forwardFold' ? [s.shoulder, s.hip, s.knee, s.wrist] : [s.shoulder, s.elbow, s.wrist, s.hip, s.ankle];
}

// ── drawing ────────────────────────────────────────────────────────────────

function flexOverlay(shot: FlexShot, lms: Landmark[], width: number, height: number): Overlay {
  const { vis, px } = helpers(lms, { width, height });
  const line = (a: number, b: number, kind: OverlayLine['kind']): OverlayLine => {
    const p = px(a), q = px(b);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, kind };
  };
  const lines: OverlayLine[] = [];
  const bones = (pairs: [number, number][]) => pairs.forEach(([a, b]) => { if (vis(a) && vis(b)) lines.push(line(a, b, 'bone')); });

  let points: number[];
  if (shot === 'butterfly') {
    points = BUTTERFLY_POINTS;
    bones((['LEFT', 'RIGHT'] as const).flatMap((s) => [
      [LM[`${s}_SHOULDER`], LM[`${s}_HIP`]], [LM[`${s}_SHOULDER`], LM[`${s}_ELBOW`]], [LM[`${s}_ELBOW`], LM[`${s}_WRIST`]],
      [LM[`${s}_HIP`], LM[`${s}_KNEE`]], [LM[`${s}_KNEE`], LM[`${s}_ANKLE`]], [LM[`${s}_ANKLE`], LM[`${s}_HEEL`]],
    ] as [number, number][]));
    const ground = [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_ANKLE, LM.RIGHT_ANKLE].filter(vis).map((i) => px(i).y);
    if (ground.length) {
      const floor = Math.max(...ground);
      lines.push({ x1: 0, y1: floor, x2: width, y2: floor, kind: 'reference' });
      for (const k of [LM.LEFT_KNEE, LM.RIGHT_KNEE].filter(vis)) {
        const p = px(k);
        lines.push({ x1: p.x, y1: p.y, x2: p.x, y2: floor, kind: 'measure' }); // knee height above the floor
      }
    }
  } else {
    points = sidePoints(shot, lms);
    const s = sagittalLandmarks(lms);
    const finger = FLEX_FINGER[s.shoulder === LM.LEFT_SHOULDER ? 'LEFT' : 'RIGHT'];
    bones([[s.shoulder, s.elbow], [s.elbow, s.wrist], [s.hip, s.knee], [s.knee, s.ankle], [s.ankle, s.heel], [s.heel, s.foot], [s.ankle, s.foot], [s.ear, s.shoulder]]);
    if (shot === 'forwardFold') {
      if (vis(s.wrist) && vis(finger)) lines.push(line(s.wrist, finger, 'bone'));
      if (vis(s.hip) && vis(s.shoulder)) lines.push(line(s.hip, s.shoulder, 'measure'));
      if (vis(s.hip) && vis(s.knee)) lines.push(line(s.hip, s.knee, 'measure'));
    } else if (vis(s.shoulder) && vis(s.hip)) {
      // Trunk line continued down from the shoulder (0° reference) and the measured arm line.
      lines.push(line(s.shoulder, s.hip, 'reference'));
      const arm = vis(s.wrist) ? s.wrist : vis(s.elbow) ? s.elbow : null;
      if (arm !== null) lines.push(line(s.shoulder, arm, 'measure'));
    }
  }
  const shown = points.filter(vis).map((i) => ({ ...px(i), index: i }));
  return { width, height, points: shown, lines };
}

export function shotOverlay(shot: CaptureShot, lms: Landmark[], width: number, height: number): Overlay {
  return isFlexShot(shot) ? flexOverlay(shot, lms, width, height) : buildOverlay(shot, lms, width, height);
}

export function shotEditablePoints(shot: CaptureShot, lms: Landmark[], width: number, height: number): EditablePoint[] {
  if (!isFlexShot(shot)) return editablePoints(shot, lms, width, height);
  return editablePointsFor(shot === 'butterfly' ? BUTTERFLY_POINTS : sidePoints(shot, lms), lms, width, height);
}

/** Posture metrics colour the measure lines; flexibility lines stay neutral (scored on the report). */
export function shotPreviewMetrics(shot: CaptureShot, lms: Landmark[], size: Size): Metric[] {
  return isFlexShot(shot) ? [] : computeViewMetrics(shot, lms, size);
}
