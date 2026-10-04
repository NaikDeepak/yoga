import { describe, it, expect } from 'vitest';
import {
  computeViewMetrics,
  severity,
  LM,
  POSE_LANDMARK_COUNT,
  type Landmark,
  type Metric,
  type MetricKey,
  type PostureView,
} from '@/lib/posture';

const W = 1000;
const H = 2000;

type PxPoints = Partial<Record<keyof typeof LM, [number, number] | [number, number, number]>>;

// Builds a 33-landmark array from pixel coords (x, y[, visibility]) on a W×H image.
// Unlisted landmarks get visibility 0.
function body(points: PxPoints): Landmark[] {
  const out: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [name, p] of Object.entries(points)) {
    const [x, y, v = 1] = p!;
    out[LM[name as keyof typeof LM]] = { x: x / W, y: y / H, visibility: v };
  }
  return out;
}

// Person facing the camera: anatomical LEFT is on the image's right (larger x).
const FRONT: PxPoints = {
  NOSE: [500, 300],
  LEFT_EYE: [520, 280], RIGHT_EYE: [480, 280],
  LEFT_EAR: [540, 290], RIGHT_EAR: [460, 290],
  LEFT_SHOULDER: [600, 500], RIGHT_SHOULDER: [400, 500],
  LEFT_WRIST: [630, 950], RIGHT_WRIST: [370, 950],
  LEFT_HIP: [560, 1000], RIGHT_HIP: [440, 1000],
  LEFT_KNEE: [560, 1450], RIGHT_KNEE: [440, 1450],
  LEFT_ANKLE: [560, 1850], RIGHT_ANKLE: [440, 1850],
  LEFT_HEEL: [560, 1880], RIGHT_HEEL: [440, 1880],
  LEFT_FOOT_INDEX: [570, 1900], RIGHT_FOOT_INDEX: [430, 1900],
};

// Left side to camera, facing image-right (+x). Far (right) side barely visible.
const SIDE: PxPoints = {
  NOSE: [540, 300],
  LEFT_EYE: [520, 280],
  LEFT_EAR: [500, 290],
  LEFT_SHOULDER: [500, 500],
  LEFT_HIP: [500, 1000],
  LEFT_KNEE: [500, 1450],
  LEFT_ANKLE: [500, 1850],
  LEFT_HEEL: [470, 1880],
  LEFT_FOOT_INDEX: [560, 1900],
  RIGHT_EAR: [500, 290, 0.2],
  RIGHT_SHOULDER: [500, 500, 0.2],
  RIGHT_HIP: [500, 1000, 0.2],
  RIGHT_KNEE: [500, 1450, 0.2],
  RIGHT_ANKLE: [500, 1850, 0.2],
};

// Mirror horizontally (person facing image-left instead).
function mirror(points: PxPoints): PxPoints {
  return Object.fromEntries(
    Object.entries(points).map(([k, p]) => [k, [W - p![0], p![1], p![2] ?? 1]]),
  );
}

function run(view: PostureView, points: PxPoints, heightCm: number | null = 170): Metric[] {
  return computeViewMetrics(view, body(points), { width: W, height: H, heightCm });
}

function get(metrics: Metric[], key: MetricKey, side?: 'left' | 'right'): Metric {
  const found = metrics.filter((m) => m.key === key && (side === undefined || m.side === side));
  expect(found, `metric ${key}${side ? ` (${side})` : ''}`).toHaveLength(1);
  return found[0];
}

describe('computeViewMetrics — input validation', () => {
  it('rejects anything other than 33 landmarks', () => {
    expect(() => computeViewMetrics('front', [], { width: W, height: H })).toThrow(/33/);
  });
});

describe('computeViewMetrics — front view', () => {
  it('reports a perfectly aligned body as all-normal with no side', () => {
    const m = run('front', FRONT);
    for (const key of ['headTilt', 'shoulderLevel', 'pelvicLevel'] as const) {
      expect(get(m, key)).toMatchObject({ value: 0, side: null, severity: 'normal' });
    }
    expect(get(m, 'trunkShift')).toMatchObject({ value: 0, unit: 'deg', side: null, severity: 'normal' });
    expect(get(m, 'headShift')).toMatchObject({ value: 0, unit: 'deg', side: null, severity: 'normal' });
    expect(get(m, 'kneeAlignment', 'left')).toMatchObject({ value: 0, direction: null, severity: 'normal' });
    expect(get(m, 'kneeAlignment', 'right')).toMatchObject({ value: 0, direction: null, severity: 'normal' });
  });

  it('measures a dropped right shoulder in degrees and names the low side', () => {
    // dy 35 over dx 200 → atan(0.175) = 9.93°
    const marked = get(run('front', { ...FRONT, RIGHT_SHOULDER: [400, 535] }), 'shoulderLevel');
    expect(marked).toMatchObject({ value: 9.9, unit: 'deg', side: 'right', severity: 'marked' });
    // dy 10 over dx 200 → 2.86°
    const mild = get(run('front', { ...FRONT, RIGHT_SHOULDER: [400, 510] }), 'shoulderLevel');
    expect(mild).toMatchObject({ value: 2.9, side: 'right', severity: 'mild' });
  });

  it('assigns anatomical sides by image position, not by the model labels', () => {
    // Model swapped the labels; the lower shoulder is still at image-left (x=400) → anatomical right.
    const swapped = { ...FRONT, LEFT_SHOULDER: [400, 535], RIGHT_SHOULDER: [600, 500] } as PxPoints;
    expect(get(run('front', swapped), 'shoulderLevel').side).toBe('right');
  });

  it('uses the eye line for head tilt', () => {
    const m = run('front', { ...FRONT, LEFT_EYE: [520, 280, 0.1] });
    expect(get(m, 'headTilt')).toMatchObject({ value: null, severity: null });
  });

  it('reports pelvic level as approximate', () => {
    const m = get(run('front', { ...FRONT, LEFT_HIP: [560, 1008] }), 'pelvicLevel');
    // dy 8 over dx 120 → 3.81°
    expect(m).toMatchObject({ value: 3.8, side: 'left', severity: 'mild', approx: true });
  });

  it('measures trunk shift as the lean of hips→shoulders from vertical', () => {
    // mid-shoulder 30px right of mid-hip over 500px → atan(30/500) = 3.4°, toward image-right = anatomical left
    const shifted = { ...FRONT, LEFT_SHOULDER: [630, 500], RIGHT_SHOULDER: [430, 500] } as PxPoints;
    expect(get(run('front', shifted), 'trunkShift')).toMatchObject({
      value: 3.4, unit: 'deg', side: 'left', severity: 'mild',
    });
  });

  it('measures head shift as the lean of shoulders→head from vertical', () => {
    const m = run('front', { ...FRONT, LEFT_EYE: [500, 280], RIGHT_EYE: [460, 280] });
    // eye midpoint 480 vs shoulder midpoint 500, 220px above → atan(20/220) = 5.2°, image-left = anatomical right
    expect(get(m, 'headShift')).toMatchObject({ value: 5.2, unit: 'deg', side: 'right', severity: 'marked' });
  });

  it('detects knee valgus and varus per leg', () => {
    // knee 30px toward midline: deviation = atan(30/450) + atan(30/400) = 8.1°
    const valgus = get(run('front', { ...FRONT, LEFT_KNEE: [530, 1450] }), 'kneeAlignment', 'left');
    expect(valgus).toMatchObject({ value: 8.1, direction: 'valgus', severity: 'mild', approx: true });
    const varus = get(run('front', { ...FRONT, RIGHT_KNEE: [400, 1450] }), 'kneeAlignment', 'right');
    expect(varus).toMatchObject({ direction: 'varus', severity: 'marked' });
  });

  it('reports arm-hang asymmetry on the side hanging farther from the body', () => {
    const m = get(run('front', { ...FRONT, LEFT_WRIST: [650, 950] }), 'armHang');
    expect(m).toMatchObject({ value: 2, side: 'left', severity: null });
  });

  it('marks metrics with a low-visibility landmark as not measurable', () => {
    const m = get(run('front', { ...FRONT, RIGHT_SHOULDER: [400, 535, 0.3] }), 'shoulderLevel');
    expect(m).toMatchObject({ value: null, side: null, severity: null });
  });

  it('marks knee and arm metrics as not measurable when knees/wrists are hidden (e.g. under a saree)', () => {
    const m = run('front', { ...FRONT, LEFT_KNEE: [560, 1450, 0.2], RIGHT_WRIST: [370, 950, 0.1] });
    expect(get(m, 'kneeAlignment', 'right').value).toBe(0);
    // the unmeasurable leg keeps its label, so views can still be matched up per leg
    expect(m.filter((x) => x.key === 'kneeAlignment' && x.value === null)).toHaveLength(1);
    expect(m.find((x) => x.key === 'kneeAlignment' && x.value === null)!.side).not.toBeNull();
    expect(get(m, 'armHang')).toMatchObject({ value: null, severity: null });
  });

  it('marks distance metrics as not measurable when stature cannot be estimated', () => {
    const m = run('front', { ...FRONT, LEFT_HEEL: [560, 1880, 0], RIGHT_HEEL: [440, 1880, 0], LEFT_ANKLE: [560, 1850, 0], RIGHT_ANKLE: [440, 1850, 0] });
    expect(get(m, 'armHang').value).toBeNull();
  });

  it('does not report hindfoot alignment from the front', () => {
    expect(run('front', FRONT).some((m) => m.key === 'hindfoot')).toBe(false);
  });
});

describe('computeViewMetrics — back view', () => {
  const BACK = mirror(FRONT); // facing away: anatomical left is image-left

  it('maps the lower image-left shoulder to the anatomical left', () => {
    const m = get(run('back', { ...BACK, LEFT_SHOULDER: [400, 535] }), 'shoulderLevel');
    expect(m.side).toBe('left');
  });

  it('uses the ear line for head tilt (eyes are hidden)', () => {
    const noEyes = { ...BACK, LEFT_EYE: [0, 0, 0], RIGHT_EYE: [0, 0, 0] } as PxPoints;
    expect(get(run('back', noEyes), 'headTilt')).toMatchObject({ value: 0, severity: 'normal' });
  });

  it('reports hindfoot angle with valgus/varus direction', () => {
    // anatomical left heel at image-left x=440; ankle 10px medial (toward midline 500) over 30px
    const m = run('back', { ...BACK, LEFT_ANKLE: [450, 1850] });
    expect(get(m, 'hindfoot', 'left')).toMatchObject({ value: 18.4, direction: 'valgus', approx: true });
    expect(get(m, 'hindfoot', 'right')).toMatchObject({ value: 0, direction: null });
  });

  it('marks hindfoot as not measurable when a heel is hidden', () => {
    const m = run('back', { ...BACK, LEFT_HEEL: [440, 1880, 0.2] });
    expect(m.filter((x) => x.key === 'hindfoot' && x.value === null)).toHaveLength(1);
  });

  it('reports trunk shift to the anatomical side in the back view', () => {
    const shifted = { ...BACK, LEFT_SHOULDER: [370, 500], RIGHT_SHOULDER: [570, 500] } as PxPoints;
    expect(get(run('back', shifted), 'trunkShift').side).toBe('left');
  });
});

describe('computeViewMetrics — side views', () => {
  it('reports an upright body as aligned', () => {
    const m = run('left', SIDE);
    expect(get(m, 'forwardHead')).toMatchObject({ value: 0, direction: null, severity: 'normal', approx: true });
    expect(get(m, 'trunkLean')).toMatchObject({ value: 0, direction: null, severity: 'normal' });
    expect(get(m, 'kneeSagittal')).toMatchObject({ value: 0, severity: 'normal' });
    expect(get(m, 'headForward')).toMatchObject({ value: 0, unit: 'cm' });
  });

  it('measures forward head as the shoulder→ear angle from vertical', () => {
    // ear 50px ahead over 210px → 13.4° (mild); 90px ahead → 23.2° (marked)
    expect(get(run('left', { ...SIDE, LEFT_EAR: [550, 290] }), 'forwardHead'))
      .toMatchObject({ value: 13.4, direction: 'forward', severity: 'mild' });
    const marked = run('left', { ...SIDE, LEFT_EAR: [590, 290] });
    expect(get(marked, 'forwardHead')).toMatchObject({ value: 23.2, severity: 'marked' });
    expect(get(marked, 'headForward')).toMatchObject({ direction: 'forward' });
  });

  it('reports a head held behind the shoulder as backward', () => {
    expect(get(run('left', { ...SIDE, LEFT_EAR: [470, 290] }), 'forwardHead')).toMatchObject({ direction: 'backward' });
  });

  it('works when the client faces the other way', () => {
    const m = run('right', mirror({ ...SIDE, LEFT_EAR: [710, 290] }));
    expect(get(m, 'forwardHead').value).toBe(45);
    expect(get(m, 'headForward').direction).toBe('forward');
  });

  it('falls back to nose vs ear for facing when the feet are hidden', () => {
    const noFeet = { ...SIDE, LEFT_HEEL: [470, 1880, 0], LEFT_FOOT_INDEX: [560, 1900, 0], LEFT_EAR: [710, 290], NOSE: [760, 300] } as PxPoints;
    expect(get(run('left', noFeet), 'forwardHead').value).toBe(45);
  });

  it('reports nothing measurable when facing cannot be determined', () => {
    const blind = { ...SIDE, LEFT_HEEL: [470, 1880, 0], LEFT_FOOT_INDEX: [560, 1900, 0], NOSE: [540, 300, 0] } as PxPoints;
    expect(run('left', blind).every((m) => m.value === null)).toBe(true);
  });

  it('picks the more visible side of the body', () => {
    // Right side is the near side here; left labels are faint and misplaced.
    const flipped: PxPoints = {
      NOSE: [540, 300],
      RIGHT_EAR: [710, 290], RIGHT_SHOULDER: [500, 500], RIGHT_HIP: [500, 1000],
      RIGHT_KNEE: [500, 1450], RIGHT_ANKLE: [500, 1850], RIGHT_HEEL: [470, 1880], RIGHT_FOOT_INDEX: [560, 1900],
      RIGHT_EYE: [520, 280],
      LEFT_EAR: [100, 100, 0.2], LEFT_SHOULDER: [100, 100, 0.2],
    };
    expect(get(run('right', flipped), 'forwardHead').value).toBe(45);
  });

  it('measures trunk lean in degrees with direction', () => {
    // shoulder 35px ahead of hip over 500px → 4.0°
    const m = get(run('left', { ...SIDE, LEFT_SHOULDER: [535, 500] }), 'trunkLean');
    expect(m).toMatchObject({ value: 4, direction: 'forward', severity: 'mild' });
    expect(get(run('left', { ...SIDE, LEFT_SHOULDER: [535, 500] }), 'shoulderForward').direction).toBe('forward');
  });

  it('distinguishes knee hyperextension (backward) from flexion (forward)', () => {
    const hyper = get(run('left', { ...SIDE, LEFT_KNEE: [470, 1450] }), 'kneeSagittal');
    expect(hyper).toMatchObject({ value: 8.1, direction: 'backward', severity: 'mild' });
    const flexed = get(run('left', { ...SIDE, LEFT_KNEE: [540, 1450] }), 'kneeSagittal');
    expect(flexed).toMatchObject({ direction: 'forward', severity: 'marked' });
  });

  it('reports pelvic shift and pelvic tilt proxy', () => {
    const m = run('left', { ...SIDE, LEFT_HIP: [530, 1000] });
    expect(get(m, 'pelvicShift')).toMatchObject({ value: 3, direction: 'forward', severity: null });
    // hip 30px ahead of knee over 450px → 3.8°
    expect(get(m, 'pelvicTilt')).toMatchObject({ value: 3.8, direction: 'forward', approx: true });
  });

  it('does not report frontal metrics from the side', () => {
    expect(run('left', SIDE).some((m) => m.key === 'shoulderLevel')).toBe(false);
  });
});

describe('severity', () => {
  it('bands "larger is worse" metrics at the mild/marked limits', () => {
    expect(severity('shoulderLevel', 1.9, 'deg')).toBe('normal');
    expect(severity('shoulderLevel', 2, 'deg')).toBe('mild');
    expect(severity('shoulderLevel', 4, 'deg')).toBe('mild');
    expect(severity('shoulderLevel', 4.1, 'deg')).toBe('marked');
  });

  it('bands forward head at 10° and 20°', () => {
    expect(severity('forwardHead', 9.9, 'deg')).toBe('normal');
    expect(severity('forwardHead', 10, 'deg')).toBe('mild');
    expect(severity('forwardHead', 20, 'deg')).toBe('mild');
    expect(severity('forwardHead', 20.1, 'deg')).toBe('marked');
  });

  it('returns null for unmeasured values and informational metrics', () => {
    expect(severity('shoulderLevel', null, 'deg')).toBeNull();
    expect(severity('armHang', 5, 'cm')).toBeNull();
    expect(severity('headForward', 5, 'pct')).toBeNull();
  });
});
