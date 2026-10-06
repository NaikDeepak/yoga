# Ideal Reference Figure — Design

Date: 2026-10-06 · Branch: `feat/ideal-figure` · Status: Approved (Deepak, 2026-10-06)
Roadmap: posture follow-up plan **C4** (FlexifyMe shows an "ideal posture" picture beside each view).

## Decisions (Deepak)
- **A separate figure beside each photo**, the same for every client (not a ghost over their own skeleton).
- **Shown on:**
  - the physio's posture report (beside each of the 4 views);
  - the client's shared posture report;
  - each flexibility card (the target pose).

## Design
- `src/lib/ideal-figures.ts` holds one landmark set per shot (4 posture views and 4 flexibility shots):
  - **standing posture views:** ear, shoulder, hip, knee and ankle on one plumb line, with shoulders and hips level and symmetric;
  - **shoulder extension:** arms 60° behind the trunk;
  - **forward fold:** trunk 40° from the thigh, knees straight, palms on the floor;
  - **butterfly:** knees on the floor, heels close in.
- The sets are drawn with the **same overlay code** as a real capture, and coloured by the same metrics, so measure lines on the posture views show green.
- **Tests guarantee the ideal never contradicts the report:**
  - every ideal posture view measures `normal` on every rated measure;
  - every ideal flexibility pose scores 100 with no flags;
  - every ideal passes the live capture checks for its shot.
- `IdealFigure` is a labelled ("Ideal / आदर्श") figure on the same dark backdrop as a figure without a photo.
- **Layout:**
  - the physio report's view grid goes from 4 to 2 columns, each cell a photo + ideal pair;
  - the client page shows one pair per row on phones;
  - flexibility cards show the shot(s) then the ideal.

## Update: real-person reference photos (Deepak, 2026-10-06)
- **Source:** Deepak asked for a real person behind the skeleton. Free stock was tried first and covered only 2 of the 6 poses, with different people, so all six were AI-generated (Gemini `gemini-3-pro-image`): one model, outfit and studio.
- **Approach:** "photo + our ideal skeleton".
  - Measured with our own rules, the photos weren't ideal (2° head tilt, shoulder extension 32°, …), so the skeleton drawn is still **our ideal**, fitted onto each photo with one uniform scale and shift (`scripts/ideal-photos/fit.mts` → `src/lib/ideal-photos.ts`).
  - Uniform scaling keeps every angle and proportion, and tests prove the fitted figures still measure normal / score 100 and land inside the photo.
- **Known gap:** shoulder extension. The model's arms reach about 32° while the ideal line shows 60°.
- **Pipeline and regeneration:** `scripts/ideal-photos/README.md`.

## Out
- A ghost "ideal" over the client's own skeleton (the option not chosen).
- Ideals in the progress report link (it is numbers only).
