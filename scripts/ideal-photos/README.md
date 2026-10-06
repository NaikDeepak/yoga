# Ideal reference photos

The "Ideal / आदर्श" picture beside each posture view and flexibility test (physio report, client's
shared report, flexibility cards) is a **plain model photo**, with no lines drawn on it.

- **Files:** `public/ideal/<shot>.jpg`, 640 px wide, listed in `src/lib/ideal-photos.ts` (a test checks that each file exists and its size matches).
- **Source:** AI-generated with Gemini `gemini-3-pro-image` (2026-10-06): one model, outfit and studio across all poses.
  - The front view was generated first and used as the reference for the rest.
  - `left` and `shoulderExtLeft` are mirrored copies of the right-side photos.
- **Free stock was tried first** (Pexels/Unsplash). Only the fold and the butterfly had usable shots, and they showed different people.
- **Illustration only:** the photos are not measured. Checked with our own rules they are close to ideal but not exact (e.g. shoulder extension reaches about 32°, not the 60° target), so treat them as reference pictures, not as the standard the scores come from.

## Regenerate
```bash
python3 scripts/ideal-photos/generate.py     # → /tmp/ideal-photos/*.png (~$0.13/image on GEMINI_API_KEY)
# pick the good ones, resize to 640 px wide into public/ideal/ (mirror right → left), update sizes in
# src/lib/ideal-photos.ts if the aspect ratio changed, then: npm test -- tests/lib/ideal-photos.test.ts
```
