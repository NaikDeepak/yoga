# AI Posture Analysis — Design Spec
Date: 2026-10-04
Branch: `feat/ai-posture-analysis`

## Overview

Modelled on FlexifyMe's first-visit AI posture scan: the therapist captures the client standing in four views (front, back, left, right) with the phone/tablet camera, the app detects body landmarks (ears, eyes, shoulders, elbows, wrists, hips, knees, ankles, heels, toes), and reports where the body is out of balance and by how many degrees — e.g. "Right shoulder 3.2° lower", "Forward head: CVA 44°", "Pelvis shifted 1.8 cm left".

The result is a **baseline** saved against the client. Later assessments are compared side-by-side to show progress.

This is a screening aid, not a diagnostic device. Every report carries that disclaimer (bilingual).

### Decisions (agreed 2026-10-04)
- **Views:** all four — front, back, left, right.
- **Capture:** live camera with on-screen guide and auto-capture (no file upload path in v1).
- **Entry point:** an "Add posture assessment / पोश्चर मूल्यांकन जोडा" button on the client page (Assessment tab). No forced prompt on registration.

### Out of scope (v1)
- Gait / movement / range-of-motion video analysis.
- Auto-suggesting exercises from findings (natural Phase 2: map findings → exercise library categories).
- AI-written narrative summary (could reuse `src/lib/gemini.ts` later).
- Upload-from-gallery capture.

## Technology

**MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`), running entirely in the browser.

- 33 landmarks (incl. heels + foot index, which 17-point COCO models lack) with per-point `visibility`.
- Runs on-device: **no client photo is sent to any third-party AI service**. Only the final JPEGs + landmark JSON go to our own storage/DB.
- Two models:
  - `pose_landmarker_lite` in `VIDEO` mode for the live guide (fast, ~30 fps on mid-range Android).
  - `pose_landmarker_heavy` in `IMAGE` mode on the captured still for the measured landmarks (accuracy over speed).
- WASM + model files: self-host under `public/mediapipe/` (avoids CDN/CSP issues and works on the clinic's flaky Wi-Fi after first load via PWA cache). Lazy-loaded only on the capture page.

## Capture Flow — `/patients/[id]/posture/new`

Full-screen client component `PostureCapture`. Steps:

1. **Consent** — checkbox "Client consents to posture photos / ग्राहकाची फोटोसाठी संमती" (required). Setup tips: phone upright at waist height (tripod ideal), 2–3 m away, plain wall, fitted clothing, barefoot, hair off neck/ears.
2. **For each view in order Front → Right → Back → Left:**
   - Live camera (`getUserMedia`, rear camera default, switch button) with a translucent body-outline overlay and a centre plumb line.
   - Live checks (lite model), each shown as a ✓/✗ chip:
     - Whole body in frame (nose…heels all visibility > 0.6, with margin from edges).
     - Correct facing for the view (front: nose visible & shoulder width wide; back: nose/eyes low visibility & shoulder width wide; side: shoulder width narrow, nose toward expected side).
     - Standing still (landmark jitter below threshold for ~1 s).
     - Device upright — `DeviceOrientationEvent` beta ≈ 90° ±3°, gamma ≈ 0 ±3° when available (camera tilt directly corrupts every angle); skipped silently if the sensor is unavailable.
   - When all checks pass → 3-2-1 countdown (audible beep + bilingual voice-free text) → auto-capture. Manual shutter button as fallback.
   - Heavy model runs on the still. Show the skeleton overlay; therapist can **drag any landmark** to correct it, then "Retake" or "Next".
3. **Review** — 2×2 grid of annotated views + computed findings. Optional therapist note. **Save**.

Captured frames are downscaled to max 1280 px long edge, JPEG q≈0.85 (~150–300 KB each), so all four fit comfortably under the existing upload limit (`MAX_FILE_BYTES` / Vercel body cap).

## Metrics — `src/lib/posture.ts` (pure, fully unit-tested)

All computed from 2D image coordinates (pixels, y down). Angles in degrees, 1 decimal. Distances normalised to body height (top of head ≈ ear-y minus a fixed head offset → heel-y) and converted to cm using the client's recorded height when present; otherwise shown as % of height.

The server **recomputes metrics from the saved landmarks** — client-side numbers are display-only and never trusted.

Back-view note: MediaPipe labels left/right as if the subject faces the camera. In the back view we re-label by image position (subject's left = image left) before computing.

### Front & Back views (frontal plane)

| Metric | Landmarks | Calculation | Back view |
|---|---|---|---|
| Head tilt | eyes (front) / ears (back) | angle of line vs horizontal; + = right side lower | ears |
| Shoulder level | shoulders 11/12 | angle vs horizontal + height difference | ✓ |
| Trunk lateral shift | shoulder midpoint vs hip midpoint | horizontal offset | ✓ |
| Pelvic level | hips 23/24 | angle vs horizontal + height difference (approx — hip landmark ≈ joint centre, not iliac crest) | ✓ |
| Body midline deviation | nose / mid-ears, mid-shoulder, mid-hip vs vertical through mid-ankles | horizontal offsets | ✓ |
| Knee alignment (valgus/varus) | hip–knee–ankle per leg | frontal knee angle; Q-angle tagged *approx* | ✓ |
| Arm hang asymmetry | wrist ↔ hip horizontal gap L vs R | difference | ✓ |
| Hindfoot alignment | ankle–heel line per foot | angle vs vertical (*approx*) | back only |

### Left & Right views (sagittal plane)

Plumb reference line: vertical through the ankle landmark (≈ lateral malleolus). Ideal: ear, shoulder, hip, knee roughly on the line.

| Metric | Landmarks | Calculation |
|---|---|---|
| Forward head — craniovertebral angle (CVA) | ear, shoulder (C7 proxy) | angle between horizontal and shoulder→ear line (*approx*, C7 not visible to the model) |
| Head forward of plumb | ear vs plumb | horizontal offset |
| Rounded shoulders | shoulder vs plumb / vs hip | horizontal offset |
| Trunk lean | shoulder–hip line vs vertical | angle |
| Pelvic shift | hip vs plumb | horizontal offset |
| Pelvic tilt (proxy) | hip–knee vs vertical | angle (*approx*) |
| Knee hyperextension / flexion | hip–knee–ankle | knee angle; >180° = recurvatum |

Left and right side findings are shown separately and compared (e.g. FHP worse on left view suggests head rotation).

### Severity bands

Each metric maps to `normal | mild | marked` (green / amber / red) via a thresholds table in `src/lib/posture.ts`. Starting values (from photogrammetry literature; tweakable constants, not user settings in v1):

| Metric | Normal | Mild | Marked |
|---|---|---|---|
| Head tilt | < 2° | 2–4° | > 4° |
| Shoulder level | < 2° | 2–4° | > 4° |
| Pelvic level | < 2° | 2–4° | > 4° |
| CVA | ≥ 50° | 45–50° | < 45° |
| Trunk lean / lateral shift | < 2° (/ 1 cm) | 2–4° (/ 1–2.5 cm) | > 4° (/ > 2.5 cm) |
| Knee frontal angle (from 180°) | < 5° | 5–10° | > 10° |
| Knee sagittal | 175–185° | 185–190° | > 190° |

Any metric whose input landmarks have visibility < 0.5 is reported as "Not measurable / मोजता आले नाही" rather than a wrong number.

## Schema

Add `jsonb` to the `drizzle-orm/pg-core` import.

```typescript
export const postureAssessments = pgTable('posture_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  assessedOn: date('assessed_on').notNull(),
  heightCm: real('height_cm'),          // snapshot of client height used for cm conversion
  note: text('note'),
  consentAt: timestamp('consent_at').notNull(), // set when the consent checkbox is ticked
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('posture_assessments_patient_idx').on(table.patientId, table.assessedOn),
]).enableRLS();

export const postureViews = pgTable('posture_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').notNull()
    .references(() => postureAssessments.id, { onDelete: 'cascade' }),
  view: text('view').notNull(),          // 'front' | 'back' | 'left' | 'right'
  filePath: text('file_path').notNull(), // storage key, private bucket
  imageWidth: integer('image_width').notNull(),
  imageHeight: integer('image_height').notNull(),
  landmarks: jsonb('landmarks').notNull(),   // [{x,y,visibility}] ×33, normalised 0–1
  landmarksEdited: boolean('landmarks_edited').default(false).notNull(),
  metrics: jsonb('metrics').notNull(),       // computed server-side from landmarks
}, (table) => [
  uniqueIndex('posture_views_assessment_view_idx').on(table.assessmentId, table.view),
  check('posture_views_view_check', sql`${table.view} in ('front','back','left','right')`),
]).enableRLS();
```

Storage keys: `patients/{patientId}/posture/{assessmentId}/{view}.jpg` in the existing private `patient-files` bucket via `getStorage()` — signed URLs only, same as documents.

Migration: `npm run db:generate` → `npm run db:migrate`.

## New Files

| Path | Responsibility |
|---|---|
| `src/lib/posture.ts` | landmark indices, geometry helpers, `computeViewMetrics(view, landmarks, w, h, heightCm)`, thresholds, `severity()` |
| `src/lib/posture-capture.ts` | pure live-check logic (in-frame, facing, stillness, upright) — unit-testable without a camera |
| `src/data/posture.ts` | `addPostureAssessment` (upload 4 files → insert rows; clean up uploads on failure), `listPostureAssessments`, `getPostureAssessment`, `deletePostureAssessment` (removes files) |
| `src/actions/posture.ts` | `savePostureAssessmentAction`, `deletePostureAssessmentAction` — auth + zod + recompute metrics + revalidate |
| `src/components/posture/PostureCapture.tsx` | client: camera, MediaPipe, guide overlay, countdown, per-view step machine |
| `src/components/posture/LandmarkEditor.tsx` | client: draggable landmark overlay on a still |
| `src/components/posture/PostureFigure.tsx` | SVG overlay (skeleton, plumb/horizontal reference lines, angle labels) on an `<img>` — server-renderable, prints cleanly |
| `src/components/posture/PostureFindings.tsx` | findings table with severity chips |
| `src/app/(app)/patients/[id]/posture/new/page.tsx` | capture page |
| `src/app/(app)/patients/[id]/posture/[assessmentId]/page.tsx` | report page (+ print stylesheet, letterhead like existing print pages) |
| `public/mediapipe/*` | self-hosted WASM + `.task` model files |

## Modified Files

| Path | Change |
|---|---|
| `src/db/schema.ts` | two tables above |
| `src/lib/validation.ts` | `postureAssessmentSchema` (4 views, 33 landmarks each, values 0–1, consent = true) |
| `src/app/(app)/patients/[id]/page.tsx` | Assessment tab: "Posture" section — list of past assessments (date, # marked findings) + **Add posture assessment** button; compare picker when ≥ 2 |
| `src/lib/i18n/en.ts`, `mr.ts` | `posture.*` strings (view names, metric names, severities, setup tips, checks, disclaimer) |
| `next.config` / middleware | ensure camera permission (`Permissions-Policy: camera=(self)`) and that `/mediapipe/*` is not auth-gated or is served statically |
| `docs/architecture.md` | add posture module to the index |

## Comparison

Report page accepts `?compare=<otherAssessmentId>`: per view, two `PostureFigure`s side by side; findings table gains a "Change / बदल" column (Δ degrees, arrow coloured by improvement toward normal).

## Testing

- `tests/lib/posture.test.ts` — synthetic landmark fixtures (perfectly aligned body, known shoulder drop, known FHP, back-view relabel, low-visibility → not measurable, cm conversion with/without height). This is where the coverage gate matters most.
- `tests/lib/posture-capture.test.ts` — each live check true/false.
- `tests/data/posture.test.ts` — PGlite + fake storage: insert, list, cascade delete, upload-failure cleanup.
- `tests/actions/posture.test.ts` — auth required, invalid payload rejected, metrics recomputed server-side (client-sent metrics ignored).
- Manual QA (add to `docs/setup.md`): real phone, 4 views, landmark drag, print, compare.

## Privacy / PHI

- Photos are PHI: private bucket, signed URLs, deleted with the assessment and on client cascade delete.
- No photo leaves the device except to our own storage. MediaPipe runs locally; no telemetry.
- Consent is a required checkbox; its timestamp is stored in `posture_assessments.consent_at`.
- Run `phi-security-reviewer` and `migration-reviewer` before PR.

## Risks

- **Camera tilt / distance** skews all angles → upright check + setup tips; "approx" tags.
- **Loose clothing / saree / dupatta** hides hips/knees → visibility gating + therapist landmark correction.
- **Low-end Android performance** → lite model for live, heavy only on the still; show a spinner while the heavy model loads (~25 MB, cached after first use).
- **Back-view mislabelling** → explicit relabel step with tests.

## Implementation Order

1. `src/lib/posture.ts` + tests (geometry, metrics, thresholds).
2. Schema + migration; `src/data/posture.ts` + tests.
3. Validation + actions + tests.
4. `PostureFigure` + `PostureFindings` + report page (works from seeded landmark data before the camera exists).
5. `posture-capture.ts` + `PostureCapture` + `LandmarkEditor` + new page.
6. Assessment-tab section + button; compare view; print.
7. i18n, architecture.md, setup.md QA checklist.

## Changes during implementation (2026-10-04)

- **Camera level is enforced and recorded per view** (`posture_views.camera_check` jsonb: `{ method, rollDeg, pitchDeg }`).
  - Phones: gravity vector from `DeviceMotionEvent.accelerationIncludingGravity` (not DeviceOrientation β/γ, which gimbal-lock when the phone is upright). Tolerance: roll ±1.5°, pitch ±3° — roll is tighter because shoulder/pelvic level is flagged from 2°.
  - Laptops (no sensor): **door-frame calibration** — therapist drags a line onto a true vertical; roll must be within ±1.5° to continue; pitch is recorded as `null` and the report says "roll only".
  - Server rejects any view whose camera check is outside tolerance.
  - Residual roll is **recorded only**, not auto-corrected; revisit after verifying sensor sign conventions on real devices.
- **Models load from CDN**, not `public/mediapipe/`: the heavy model is ~30 MB, too large for the repo. WASM from jsdelivr (pinned to the npm version), models from `storage.googleapis.com`. Only model files are downloaded; images stay on the device until saved to our storage.
- Side views: "right" = client's right side to the camera, i.e. facing image-right; checked via toe direction (fallback nose vs ear).
- Front view checks MediaPipe's left/right label order; the back view does not (it failed on a real MacBook capture) — it only requires the client square to the camera, and accepts weak face points or room above the shoulders for the head.
- `npm run dev:phone` (`scripts/dev-phone.sh`) serves HTTPS on the LAN with a self-signed cert for phone testing.
- The "Add posture assessment" button landed in step 5 (needed for phone testing); the assessment history list remains step 6.

## Report v2: score, patterns, FlexifyMe comparison (2026-10-04)

Benchmarked against a FlexifyMe report for the same person (same day, different camera/room):

| Finding | FlexifyMe | Ours (MacBook, landscape, body ≈70% of frame) |
|---|---|---|
| Head lateral (front) | ~5° right | 3.4–3.5° right |
| Head lateral (back) | ~3° right | 1.4° right |
| Shoulders | left elevated ~2° (front) / level (back) | right lower 1.0° (front) / 3.3° (back) |
| Trunk shift (back) | ~1° right | 2.3° right |
| Pelvis | level (front) / right elevated ~1° (back) | 0.1° (front) / **4.1° right lower (back)** |
| Forward head (side) | ~19° from plumb | 11–13.6° from vertical |
| Knees (side) | hyperextended −5° | 1.5–1.8° backward (hyperextension) |

Direction agrees on head, shoulders, trunk, forward head and knees. The back-view pelvis disagrees: hip baseline was ~60 px, so 1 px ≈ 1°. Changes made:

- **Metrics moved to FlexifyMe-comparable angles**: `headShift` (shoulders→head from vertical, mild 2.5° / marked 5°), `trunkShift` (hips→shoulders from vertical, 2° / 4°), `forwardHead` replaces `cva` (shoulder→ear from vertical, 10° / 20°). Clinician to confirm thresholds.
- **Capture precision**: analysis at full camera resolution; 3 detections combined by per-point median; photo saved as a crop around the body (≤1600 px); advisory "body fills frame" chip (target ≥75% of frame height). Door-frame calibration now requires the line to be moved.
- **Reads recompute metrics** from landmarks with current formulas.
- **Report v2**: posture score (5 body regions), overall pattern headline, per-pattern cards (evidence, likely causes, long-term effects — rule-based text in i18n, needs therapist review), focus areas with exercises from our library, 4-view photo grid with per-view findings, collapsible detailed table. Clinic palette (#1B3A2E / #C8962E / #E5D5B5).

Open question: when front and back disagree on a frontal-plane measure (e.g. pelvis 0.1° vs 4.1°), should the report average them or flag low confidence?

### Decisions (2026-10-04, after v2 review)
- **Clinical pattern text is English-only**, also in the Marathi UI (the physio explains it in the client's language — avoids translation errors in clinical wording). Section labels stay bilingual.
- **Front/back and left/right readings are averaged** (signed: opposite sides cancel) for the score and patterns; per-view values stay under each photo. A measure is flagged **low confidence** only when the two views would rate it differently *and* differ by > 2.5° (2 cm). The report lists these and offers **Retake** for the views involved; every photo also has a "Retake this photo" link. Retakes update the existing assessment (`replacePostureViews`).
