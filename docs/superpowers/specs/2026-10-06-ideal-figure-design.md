# Ideal Reference Figure — Design

Date: 2026-10-06 · Branch: `feat/ideal-figure` · Status: Approved (Deepak, 2026-10-06)
Roadmap: posture follow-up plan **C4** (FlexifyMe shows an "ideal posture" picture beside each view).

## Decisions (Deepak)
- **A separate figure beside each photo**, the same for every client (not a ghost over their own skeleton).
- **Shown on** (shoulder extension excepted, see Update):
  - the physio's posture report (beside each of the 4 views);
  - the client's shared posture report;
  - each flexibility card (the target pose).

## Design (superseded the same day; see Update)
The first version drew a generic ideal stick figure from landmark sets. It was replaced by reference photos
and removed; see git history of `src/lib/ideal-figures.ts` (deleted).

## Update: real-person reference photos (Deepak, 2026-10-06)
- **What changed:** at Deepak's request, the ideal is now a **plain photo of a real-looking model**, with no stick figure on top. That replaces the stick figure described above.
- **Source:** free stock covered only 2 of the 6 poses, with different people, so all six were AI-generated (Gemini `gemini-3-pro-image`): one model, outfit and studio. Left views are mirrored.
- **Illustration only:** the photos are not measured. With our own rules they're close but not exact (shoulder extension about 32° vs the 60° target), so they illustrate the pose rather than define the score.
- **Code:** `src/lib/ideal-photos.ts` (list + sizes) and `IdealFigure`, with the view/test name in the alt text and eager loading so printed / PDF reports include the photos. Regeneration: `scripts/ideal-photos/README.md`.
- **No shoulder-extension photo** (from the review): the model's arms reached only about 32° (score about 53), so a client could out-score the "ideal". That card shows no reference until there's a correct (e.g. clinic) photo.
- **Removed:** the stick-figure landmark sets and the photo-fitting step. They're in git history if lines are wanted again.

## Out
- A ghost "ideal" over the client's own skeleton (the option not chosen).
- Ideals in the progress report link (it is numbers only).
