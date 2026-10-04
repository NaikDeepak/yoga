// Copies MediaPipe's WASM runtime (JS glue + .wasm) from node_modules into public/mediapipe so the
// posture capture page loads it from our own origin — no third-party code runs on pages with client
// data. Runs on `npm install` (postinstall); public/mediapipe is gitignored.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/mediapipe';
if (!existsSync(src)) {
  // Fail the install loudly: without these files the posture capture page can't load the pose model.
  console.error(`[copy-mediapipe] ${src} not found — is @mediapipe/tasks-vision installed?`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-mediapipe] copied ${src} → ${dest}`);
