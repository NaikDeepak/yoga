# Ideal reference photos

The "Ideal / आदर्श" figure beside each posture view and flexibility test is a **model photo with our
ideal skeleton fitted onto it**. The skeleton is the measured ideal (`src/lib/ideal-figures.ts`); the
photo only illustrates it, so the lines may not sit exactly on the model's joints.

- **Photos:** `public/ideal/<shot>.jpg`, 640 px wide.
  - **AI-generated** with Gemini `gemini-3-pro-image` (2026-10-06): one model, outfit and studio across all poses.
  - The front view was generated first and used as the reference for the rest.
  - `left` and `shoulderExtLeft` are mirrored copies of the right-side photos.
- **Free stock was tried first** (Pexels/Unsplash). Only the fold and the butterfly had usable shots, and they showed different people.
- **Fit:** `fit.mts` finds one uniform scale and shift (no rotation, no stretch) per photo.
  - It's chosen by least squares on the trunk and leg points the detector saw clearly (`landmarks.json`).
  - It writes `src/lib/ideal-photos.ts`.
  - Because it's a uniform scale, every measure and score is unchanged, and tests check this on the fitted figures (`tests/lib/ideal-figures.test.ts`).
- **Known gap:** image models wouldn't sweep the arms past about 37° in shoulder extension (target 60°). On that card the ideal arm line sits above the model's arms.

## Regenerate
```bash
python3 scripts/ideal-photos/generate.py                     # → /tmp/ideal-photos/*.png (costs ~$0.13/image)
# python venv with mediapipe==0.10.14 + pose_landmarker_heavy.task in /tmp/ideal-photos
python scripts/ideal-photos/detect.py front right back shoulderExtRight forwardFold butterfly
# resize to 640 px into public/ideal/ (mirror the right-side ones for left / shoulderExtLeft) and copy
# the detected points into scripts/ideal-photos/landmarks.json with the same resize/mirror, then:
npx tsx --tsconfig tsconfig.json scripts/ideal-photos/fit.mts
npm test -- tests/lib/ideal-figures.test.ts                  # must stay green
```
