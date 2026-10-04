// Browser-only MediaPipe Pose Landmarker loader. Models and WASM are fetched from CDNs (the heavy
// model is ~30 MB — too big for the repo) and cached by the browser; images never leave the device.
import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from '@/lib/posture';

// Keep in step with the @mediapipe/tasks-vision version in package.json.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
} as const;

let fileset: ReturnType<typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks> | undefined;

/**
 * `live`: fast lite model on video frames (framing/stillness guide).
 * `still`: accurate heavy model on the captured photo (the landmarks we measure).
 */
export async function createPoseDetector(kind: 'live' | 'still'): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  fileset ??= FilesetResolver.forVisionTasks(WASM_BASE);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_URL[kind === 'live' ? 'lite' : 'heavy'], delegate },
    runningMode: kind === 'live' ? ('VIDEO' as const) : ('IMAGE' as const),
    numPoses: 1,
  });
  try {
    return await PoseLandmarker.createFromOptions(await fileset, options('GPU'));
  } catch {
    return PoseLandmarker.createFromOptions(await fileset, options('CPU')); // some phones lack WebGL2
  }
}

/** First detected pose as our Landmark[] (33 points), or null when nobody is in frame. */
export function toLandmarks(result: PoseLandmarkerResult): Landmark[] | null {
  const pose = result.landmarks[0];
  if (!pose) return null;
  return pose.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0 }));
}
