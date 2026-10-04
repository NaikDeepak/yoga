import { LM, POSE_LANDMARK_COUNT, type Landmark, type PostureView } from '@/lib/posture';

export const POSTURE_W = 1000;
export const POSTURE_H = 2000;

type PxPoints = Partial<Record<keyof typeof LM, [number, number]>>;

const FRONT: PxPoints = {
  NOSE: [500, 300], LEFT_EYE: [520, 280], RIGHT_EYE: [480, 280], LEFT_EAR: [540, 290], RIGHT_EAR: [460, 290],
  LEFT_SHOULDER: [600, 500], RIGHT_SHOULDER: [400, 500], LEFT_WRIST: [630, 950], RIGHT_WRIST: [370, 950],
  LEFT_HIP: [560, 1000], RIGHT_HIP: [440, 1000], LEFT_KNEE: [560, 1450], RIGHT_KNEE: [440, 1450],
  LEFT_ANKLE: [560, 1850], RIGHT_ANKLE: [440, 1850], LEFT_HEEL: [560, 1880], RIGHT_HEEL: [440, 1880],
  LEFT_FOOT_INDEX: [570, 1900], RIGHT_FOOT_INDEX: [430, 1900],
};

const SIDE: PxPoints = {
  NOSE: [540, 300], LEFT_EYE: [520, 280], LEFT_EAR: [500, 290], LEFT_SHOULDER: [500, 500], LEFT_HIP: [500, 1000],
  LEFT_KNEE: [500, 1450], LEFT_ANKLE: [500, 1850], LEFT_HEEL: [470, 1880], LEFT_FOOT_INDEX: [560, 1900],
};

/** 33 landmarks (normalised) for an upright, well-aligned body on a 1000×2000 image. */
export function alignedLandmarks(view: PostureView, overrides: PxPoints = {}): Landmark[] {
  const base = view === 'front' || view === 'back' ? FRONT : SIDE;
  const out: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [name, [x, y]] of Object.entries({ ...base, ...overrides }) as [keyof typeof LM, [number, number]][]) {
    out[LM[name]] = { x: x / POSTURE_W, y: y / POSTURE_H, visibility: 1 };
  }
  return out;
}

export const jpeg = (name = 'view.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });
