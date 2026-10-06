# Flexibility Tests — Design

Date: 2026-10-06 · Branch: `feat/flexibility-tests` · Status: Approved decisions (Deepak, 2026-10-06), formulas to be tuned by the physio
Roadmap: posture follow-up plan **D1** (FlexifyMe parity; reference `scratch/FlexifyMe.pdf` pages 7–10). Unlocks **C8** (combined score), which is not part of this spec.

## Goal

Alongside a posture assessment, the physio captures three flexibility tests with the same camera flow. Each test gets a **0–100 score** in FlexifyMe's bands: **0–35 very inflexible · 36–70 moderately flexible · 71–100 flexible**. The scores appear on the posture report and the before/after compare page.

## Decisions (Deepak, 2026-10-06)

1. **Part of the posture assessment.** The posture report shows an optional "Add flexibility tests" step, and later "Retake flexibility tests". This gives one date and one report per session.
2. **Shoulder extension on both sides**, as two captures. The test score is the mean of the two sides. A gap of 15° or more between sides is flagged as an imbalance.
3. **Score cut-offs:** I propose them from standard range-of-motion norms in one table (`FLEX_SCORING`). Dr Pawar tunes them after trying a few clients. Lenient first: quality flags warn but never block.
4. **Photos are kept under the same rules as posture:**
   - same consent;
   - stored under `patients/<id>/posture/<assessmentId>/flex-…`;
   - included in Withdraw photo consent and Delete client.

## The four shots

| Shot | Camera | Client does | Measured (server-side, from landmarks) |
|---|---|---|---|
| `shoulderExtLeft` / `shoulderExtRight` | side view, that side nearest the camera | stands tall, straight arms swept back as far as possible, holds | **Extension angle**: angle between the arm (shoulder → wrist) and the trunk line pointing down (shoulder → hip), positive when the wrist is behind the body. The body's facing direction comes from foot/heel or nose/ear, as in the sagittal posture checks. |
| `forwardFold` | side view (either side) | knees straight, folds forward from the hips, hands toward the floor, holds | **Hip flexion angle** (trunk hip → shoulder vs thigh hip → knee: 180° upright, smaller = deeper fold). **Reach level**: the fingertip compared with the knee, mid-shin, ankle and floor (heel/foot) lines. **Knee angle**: flag if < 165°. |
| `butterfly` | front view, seated on the floor | soles together, heels in, knees dropped outward, sits tall, holds | **Knee drop** per side: knee height above the floor (heel line), as a fraction of shoulder width (scale-free). **Heel distance**: mid-heels to mid-hips, as a fraction of shoulder width (flag if far). |

### Proposed scoring (`FLEX_SCORING`, linear and clamped to 0–100)

| Test | 0 points | 100 points | Note |
|---|---|---|---|
| Shoulder extension (per side) | 0° | ≥ 60° | normal shoulder extension is about 50–60° |
| Forward fold | hip angle ≥ 150° (barely bending) | ≤ 45° | flag "knees bent" (knee angle < 165°): the score stays, marked approx |
| Butterfly (per side, then mean) | knee ≥ 0.9 × shoulder width above floor | ≤ 0.15 × shoulder width | flag "heels far from pelvis" when heel distance > 0.9 × shoulder width |

The bands, flags and thresholds live in one table, like `THRESHOLDS` for posture, so tuning them is a one-line change. Changing them re-scores history automatically, because reads always recompute from the stored landmarks (the existing posture invariant).

## Capture (reuse `PostureCapture`)

- Generalise "view" into a **shot** with one config per shot:
  - which landmarks must be in frame;
  - the facing rule: side-on, like left/right, or square to the camera, like front;
  - stillness keypoints;
  - the overlay (skeleton plus the measured angle drawn);
  - the editor points;
  - the instruction text and voice prompt (en/mr).
- Camera level, countdown, voice, median-of-3 still detection, crop and the review editor all stay as they are.
- New route `posture/[assessmentId]/flexibility` (optional `?shots=` for retakes). It captures the four shots and saves, then goes back to the report.
- **Seated butterfly framing:** the "head to heels" margins don't apply. The in-frame check uses head, shoulders, hips, knees and heels.

## Data model (migration 0022)

- New table `flexibility_tests`:
  - `id`;
  - `assessment_id` (FK to `posture_assessments`, cascade);
  - `shot` (CHECK in the 4 shots; unique per assessment);
  - `file_path` (nullable: consent withdrawn);
  - `image_width`, `image_height`;
  - `landmarks` (jsonb);
  - `landmarks_edited`;
  - `camera_check` (jsonb);
  - `created_at`.
- Measures and scores are **never stored**. They're recomputed on read from the landmarks.
- **Withdraw photo consent** (`deletePosturePhotos`) also deletes flexibility photos. **Delete client** is already covered by the folder wipe.

## Code layout

- `src/lib/flexibility.ts` (pure):
  - `FLEX_SHOTS`;
  - `measureShot(shot, landmarks, size)`, giving angles, reach level and flags;
  - `scoreFlexibility(shots)`, giving per test `{ score, band, sides?, flags }`;
  - `FLEX_SCORING`;
  - `flexBand(score)`.
- `src/lib/capture-shots.ts`: one dispatcher per shot. Posture views go to the unchanged posture functions; flexibility shots get their own frame checks, stillness keypoints, overlay and editor points.
- `src/data/flexibility.ts`: `saveFlexibilityTests` (upload, then one transaction upserting the shots; old files removed after commit), `getFlexibility(db, assessmentId)`, and its use in `listPostureAssessments`/compare.
- `src/actions/posture.ts`: `saveFlexibilityTestsAction(patientId, assessmentId, formData)` (next to the posture actions, to reuse their payload and photo parsing). It requires auth, validates with zod, and checks that the assessment belongs to this client.
- UI:
  - a **Flexibility** section on the posture report: three score cards (photo + figure with the measured angle, score, band, plain-language line, flags), and per-side detail for the shoulder;
  - a flexibility row on the compare page (before → after scores);
  - "Add / Retake flexibility tests" buttons.
- i18n: test names, instructions, voice prompts, band labels, flag text (en/mr).

## Tests

- **Pure:** each measure on synthetic landmark sets:
  - arms hanging down = 0°, arms back about 45° = 45°, arms forward = negative or clamped to 0;
  - fold at hip angles 170/90/45;
  - reach levels;
  - knee-bent flag;
  - butterfly knees on floor, knees high, heels far;
  - scoring clamps and bands (0, 35, 36, 70, 71, 100);
  - the shoulder side-gap flag.
- **Data:**
  - save, then read, recomputes scores;
  - a retake of one shot replaces only that file;
  - withdraw consent deletes flexibility photos and keeps the scores;
  - another client's assessment is refused;
  - delete assessment cascades.
- **Actions:** auth, validation (shot names, 33 landmarks), and ownership.
- **Capture logic:** shot-aware `checkFrame`/`stillKeypoints` (unit-tested in lib; the UI is verified manually on a phone).

## Out (later)

- **C8** combined overall score.
- Flexibility in the client share links, the progress report and the AI analysis.
- Strength tests.
- Tuning the cut-offs: Dr Pawar does this after the first clients.
