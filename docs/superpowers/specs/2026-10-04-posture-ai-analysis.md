# Posture AI Analysis — Design Spec
Date: 2026-10-04 · Builds on `2026-10-04-ai-posture-analysis-design.md`

## Goal
After the measured posture report, give the physio an AI-written clinical analysis (FlexifyMe-style narrative): what the findings mean, how they relate to the client's complaint and lifestyle, likely causes, risks, and recommendations — reviewed by the physio before it reaches the client.

## Decisions (2026-10-04)
- **Inputs: measurements + profile only.** No photos and no name/mobile are sent. Sent: age, gender, height, weight, BMI, ailments, posture-relevant lifestyle answers, posture score + region scores, detected patterns, every combined measure (value, side/direction, severity, approx, low-confidence), camera-level method, and the exercise library (name + category).
- **Trigger: button** on the report ("Generate AI analysis"); "Regenerate" replaces the draft.
- **Model:** Gemini 2.5 Flash via the existing `src/lib/gemini.ts` client (same key as treatment drafts), JSON response schema. Local mock mode without a key returns a canned analysis.
- **Review:** saved as a **draft**; physio can **Edit & approve** (sets `ai_approved_at`). Drafts print with an "AI draft — not reviewed" label. Clinical AI text is English (same rule as pattern text).

## Output (validated with zod before saving)
`summary` · `keyFindings[] {title, explanation}` · `lifestyleLinks[]` · `likelyCauses[]` · `risks[]` · `recommendations {exercises[], ergonomics[], yogaAndBreathing[]}` · `followUp`.
Recommended exercises are filtered to names present in our library.

## Schema
`posture_assessments`: `ai_report jsonb`, `ai_generated_at timestamp`, `ai_approved_at timestamp` (all nullable).

## Guardrails (prompt)
Screening aid, not a diagnosis · only use the measurements given; say when a reading is low-confidence or approximate · don't add medications · respect doctor restrictions/contraindications · plain English for a yoga-therapy clinic in India.
