// Reference ("ideal") photos shown beside the client's photos: one per posture view and flexibility
// shot. AI-generated, one model/outfit/studio; left views are mirrored right ones. See
// scripts/ideal-photos/README.md to regenerate.
import { POSTURE_VIEWS } from './posture';
import { FLEX_SHOTS } from './flexibility';
import type { CaptureShot } from './capture-shots';

export interface IdealPhoto { src: string; width: number; height: number }

const STANDING = { width: 640, height: 1147 };

export const IDEAL_PHOTOS: Record<CaptureShot, IdealPhoto> = {
  front: { src: '/ideal/front.jpg', ...STANDING },
  back: { src: '/ideal/back.jpg', ...STANDING },
  right: { src: '/ideal/right.jpg', ...STANDING },
  left: { src: '/ideal/left.jpg', ...STANDING },
  shoulderExtRight: { src: '/ideal/shoulderExtRight.jpg', ...STANDING },
  shoulderExtLeft: { src: '/ideal/shoulderExtLeft.jpg', ...STANDING },
  forwardFold: { src: '/ideal/forwardFold.jpg', ...STANDING },
  butterfly: { src: '/ideal/butterfly.jpg', width: 640, height: 794 },
};

export const IDEAL_SHOTS: readonly CaptureShot[] = [...POSTURE_VIEWS, ...FLEX_SHOTS];
