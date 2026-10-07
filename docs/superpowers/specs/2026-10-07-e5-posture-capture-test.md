# E5: component test for the posture capture screen

**Assigned to:** Antigravity (agy) · **Lead/reviewer:** Claude · Backlog item E5 (`docs/backlog.md`).

## Goal
`src/components/posture/PostureCapture.tsx` (the camera flow: setup → live → review → summary → save) has no
automated test; its maths is unit-tested in `src/lib`, the screen itself only by hand. Add a component test
that drives the state machine with a **fake pose detector**, so future changes to the screen are safe.

## Files (only these)
- **New:** `tests/components/posture-capture.test.tsx` (`// @vitest-environment jsdom`, like the other component tests).
- **Optional new:** `tests/helpers/fake-camera.ts` if setup code gets long.
- **Do not change anything in `src/`.** Claude is editing `PostureCapture.tsx` at the same time (E4). If the screen
  truly can't be tested without a `src` change, stop and post the question to claude on the notepad.

## How to fake the browser
Mock these modules with `vi.mock` (read each file first for the exact exports):
- `@/components/posture/pose-detector`: `createPoseDetector(kind)` resolves to a fake with
  `detectForVideo()`, `detect()` and `close()`; keep `toLandmarks` real or reimplement it. The fake returns a
  configurable result: `{ landmarks: [] }` (nobody in frame) or one pose built from `alignedLandmarks(view)` in
  `tests/helpers/posture.ts` (normalise px → 0..1 with `POSTURE_W`/`POSTURE_H`, give `visibility: 1`). Make it
  possible to make `createPoseDetector('still')` reject (model download failed).
- `@/components/posture/hooks`: `useCamera` → `{ videoRef, size: { width: 1000, height: 2000 }, error: null }`
  with a `videoRef` pointing at an object whose `readyState` is 4; `useDeviceLevel` → `{ supported: true,
  level: { rollDeg: 0, pitchDeg: 0 } }` (also a case where level is off, e.g. `rollDeg: 10`);
  `requestMotionPermission` → `true`; keep `svgPoint` working if `LandmarkEditor` needs it.
- `@/components/posture/voice`: fake `createVoiceGuide` (no-op `say`, `beep`, `unlock`, `stop`, `setMuted`),
  `loadMuted` → `true`, `saveMuted` no-op.
- `@/actions/posture`: `vi.fn()` for `savePostureAssessmentAction`, `replacePostureViewsAction`,
  `saveFlexibilityTestsAction`.
- jsdom gaps: stub `HTMLCanvasElement.prototype.getContext` (with `drawImage`) and `toBlob` (calls back with a small
  JPEG Blob), `URL.createObjectURL` / `revokeObjectURL`, and drive `requestAnimationFrame` + `performance.now`
  with fake timers so the 3-second auto-capture countdown can be advanced.
- Wrap in `LocaleProvider` from `@/lib/i18n/context` (or rely on its `en` default) and assert on text from
  `@/lib/i18n/en`, never hard-coded English.

## Cases (at least these)
1. **Consent:** new assessment: Start is disabled until the consent box is ticked. Retake mode: no consent box.
2. **Live checks:** nobody in frame: the "in frame" chip is off and Capture is disabled. With a pose: chips turn on.
3. **Auto-capture:** pose in frame, still and level: after the countdown the screen moves to review (the
   `reviewHelp` text shows).
4. **Camera not level:** with `rollDeg: 10`, no auto-capture happens.
5. **No person in the still photo:** the still detector finds nobody → the `noPerson` error shows, stays on live.
6. **Model failed:** the still detector rejects → the `modelError` message shows.
7. **Full run:** accept all 4 views → summary → Save calls `savePostureAssessmentAction(patientId, formData)`;
   the payload has `consent: true` and 4 views, and the form has 4 `photo_<view>` files.
8. **Flexibility mode** (`flexibility={{ assessmentId, shots }}`): Save calls `saveFlexibilityTestsAction`.
9. **Retake from summary:** tapping a thumbnail goes back to live for that view.

## Done when
- `npx vitest run tests/components/posture-capture.test.tsx` passes, and it passes 3 runs in a row (no flakiness).
- The full `npm test` passes; `npm run typecheck` is clean.
- Commit on this branch (`test/posture-capture`), do not push. Hand off to claude on the notepad.
