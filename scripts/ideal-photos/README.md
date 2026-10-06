# Ideal reference photos

The "Ideal / आदर्श" picture beside each posture view and flexibility test (physio report, client's
shared report, flexibility cards) is a **plain model photo**, with no lines drawn on it.

- **Files:** `public/ideal/<shot>.jpg`, 640 px wide, listed in `src/lib/ideal-photos.ts` (a test checks that each file exists and its size matches).
- **Source:** AI-generated with Gemini `gemini-3-pro-image` (2026-10-06): one model, outfit and studio across all poses.
  - The front view was generated first and used as the reference for the rest.
  - `left` is a mirrored copy of `right`.
- **Free stock was tried first** (Pexels/Unsplash). Only the fold and the butterfly had usable shots, and they showed different people.
- **Illustration only:** the photos are not measured, and no test checks their pose. Checked once with our own rules (MediaPipe + `src/lib/posture.ts` / `flexibility.ts`), they are close to ideal but not exact.
- **No shoulder-extension photo:** in seven tries the model never swept the arms past about 37° (target 60°), so that photo would score about 53. A reference that scores lower than the client contradicts the report, so the shoulder card shows none. A clinic photo of that pose would fill the gap: add it to `public/ideal/` and `src/lib/ideal-photos.ts`.

## Regenerate
```bash
python3 scripts/ideal-photos/generate.py     # → /tmp/ideal-photos/*.png (~$0.13/image; GEMINI_API_KEY from env or .env)
# 'front' is the reference for every other pose: it's generated first, and other poses refuse to run without it
# pick the good ones, resize to 640 px wide into public/ideal/ (mirror right → left), update sizes in
# src/lib/ideal-photos.ts if the aspect ratio changed, then: npm test -- tests/lib/ideal-photos.test.ts
```
