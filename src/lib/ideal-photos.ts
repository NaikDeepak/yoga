// Reference ("ideal") photos shown beside the client's photos. AI-generated, one model/outfit/studio;
// left views are mirrored right ones. Illustration only — not measured (see scripts/ideal-photos/README.md).
// Shoulder extension has none: the model never reached the 60° target, and a reference that scores
// lower than the client would contradict the report.
import type { CaptureShot } from './capture-shots';

export interface IdealPhoto { src: string; width: number; height: number }

const STANDING = { width: 640, height: 1147 };

export const IDEAL_PHOTOS: Partial<Record<CaptureShot, IdealPhoto>> = {
  front: { src: '/ideal/front.jpg', ...STANDING },
  back: { src: '/ideal/back.jpg', ...STANDING },
  right: { src: '/ideal/right.jpg', ...STANDING },
  left: { src: '/ideal/left.jpg', ...STANDING },
  forwardFold: { src: '/ideal/forwardFold.jpg', ...STANDING },
  butterfly: { src: '/ideal/butterfly.jpg', width: 640, height: 794 },
};
