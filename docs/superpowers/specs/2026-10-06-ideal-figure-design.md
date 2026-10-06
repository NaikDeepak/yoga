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
- **What changed:** at Deepak's request, the ideal is now a **plain photo of a real-looking model**, with no stick figure on top. That replaces the stick figure described above.
- **Source:** free stock covered only 2 of the 6 poses, with different people, so all six were AI-generated (Gemini `gemini-3-pro-image`): one model, outfit and studio. Left views are mirrored.
- **Illustration only:** the photos are not measured. With our own rules they're close but not exact (shoulder extension about 32° vs the 60° target), so they illustrate the pose rather than define the score.
- **Code:** `src/lib/ideal-photos.ts` (list + sizes) and `IdealFigure`; regeneration in `scripts/ideal-photos/README.md`.
- **Removed:** the stick-figure landmark sets and the photo-fitting step. They're in git history if lines are wanted again.

## Out
- A ghost "ideal" over the client's own skeleton (the option not chosen).
- Ideals in the progress report link (it is numbers only).
