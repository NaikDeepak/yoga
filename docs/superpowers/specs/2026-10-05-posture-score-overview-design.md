# Posture Score on Overview + FlexifyMe Report Gaps — Design

Date: 2026-10-05 · Branch: `feat/posture-overview-score` · Status: Approved 2026-10-05 (steady band ±3, stress bands 1–4/5–7/8–10, client-list chip: all confirmed)
Roadmap item: **P1** (physio features) = follow-up plan item **C3**, plus the small report gaps found by comparing our posture report with the FlexifyMe report (`scratch/FlexifyMe.pdf`, 4 Oct 2026).

## Goal

1. The physio sees a client's posture score and its trend **without opening the report**: on the Overview tab and in the client list.
2. The posture report gets the client context FlexifyMe shows up front (body metrics, BMI, goal, pain, stress) using data we **already collect**. No new tables.

## FlexifyMe vs our posture report

| FlexifyMe report section | Ours today | Action |
|---|---|---|
| Profile strip: name, city, height, weight | Name, code, date, height | **This spec**: add age/gender, weight, BMI |
| "Your main goal" + pain-face scale (No hurt … Hurts worst) | Not on report (goal is in the lifestyle form; pain on visits) | **This spec**: goal + current pain |
| Overall score dial | Score ring /100 + region bars | Have it |
| BMI gauge + stress gauge | Not on report (BMI on Overview, stress in lifestyle) | **This spec**: "Wellbeing" gauges |
| Anterior/posterior/lateral photos with skeleton | Per-view `PostureFigure` with overlay + measurements | Have it (ours also has measured degrees) |
| Ideal-posture figure next to each view | — | Backlog **C4** (already listed) |
| Findings per view, likely causes, long-term effects, disclaimer | Patterns + causes/effects + AI analysis + physio review | Have it |
| Thoracic kyphosis / lumbar lordosis read | — | Backlog **C6** (already listed) |
| Flexibility tests (shoulder extension, forward fold, butterfly), each /100, your pose vs ideal | — | Backlog **D1** (already listed, separate spec) |
| Overall score /300 (posture + flexibility) | — | New backlog **C8**, after D1 |
| Phased programme (Weeks 1–6 Initiation → 7–10 Adoption → 11–16 Alleviation → 17–18 Retention), self-assessment at each phase end | AI recommendations + prescription, no timeline | New backlog **C9** |
| "Copy link to share" | Print only | Backlog **C2**, built with client share links (roadmap C1) |
| Testimonials, contact, apps, policies | Clinic letterhead | Skip: marketing, not clinical |

## Scope (this spec)

### 1. Overview tab: posture card
- New card on the Overview tab (full width, after the visits summary), shown only when `isPostureEnabled()`.
- **Has assessments:** latest score number in `scoreColor`, grade label, assessed date; trend vs the previous assessment: `▲ +8 since 12 Aug` (green) / `▼ −5` (red) / `● steady` (grey); links "View report" and, when there's a previous one, "Compare". Mild/marked counts as on the Assessment tab.
- **None yet:** "No posture assessment yet / अद्याप पोश्चर मूल्यांकन नाही" with an "Add posture assessment" link.
- **Assessment with no measurable score** (`score === null`): show "Not measured" and still link the report.

### 2. Client list: score chip
- `PatientCard` gets an optional `posture?: { score: number; trend: Trend }` and shows a small chip `Posture 72 ▲` coloured with `scoreColor`. No chip when the client has no scored assessment or the feature is off.

### 3. Posture report: client profile strip
Extend the existing `<dl>` under the letterhead:
- Name · Code · Assessed on · Height (unchanged)
- **Age / gender** from the patient record
- **Weight**: from the latest visit on or before `assessedOn` that has a weight; else `patients.weight_kg`; else "—"
- **BMI**: `computeBmi(weight, assessment.heightCm)` + `bmiCategory` (never stored; invariant holds)
- **Main goal**: `lifestyle_assessments.primary_goal` (hidden if empty)
- **Pain**: latest visit `pain_scale` on or before `assessedOn`, shown as `6/10` + band label (none 0 / mild 1–3 / moderate 4–6 / severe 7–10), hidden if none

### 4. Posture report: "Wellbeing" section
Placed after the score section, print-safe (`print:break-inside-avoid`), hidden entirely when neither value exists.
- **BMI gauge**: semicircle with bands <18.5 / 18.5–24.9 / 25–29.9 / ≥30, needle at the value.
- **Stress gauge**: semicircle 1–10 with bands low 1–4 / moderate 5–7 / high 8–10. These are the bands the Overview already colours by (≥8 red, ≥5 yellow); extract them so both use one function.
- Footnote: "Stress and goal are from the lifestyle assessment; weight and pain from the nearest visit."

## Design

### Pure logic (`src/lib`, TDD)
- `src/lib/posture-compare.ts`: `scoreTrend(latest: number | null, previous: number | null): { change: number | null; trend: 'up' | 'down' | 'steady' | null }`. `|change| < SCORE_STEADY_BAND` (3 points) → `steady`; either null → `{ change: null, trend: null }`.
- `src/lib/wellbeing.ts` (new): `stressBand(level)` → `'low' | 'moderate' | 'high' | null`; `painBand(scale)` → `'none' | 'mild' | 'moderate' | 'severe' | null`; `bmiBand(bmi)` → `'under' | 'normal' | 'over' | 'obese' | null`; `gaugeFraction(value, min, max)` clamped 0–1 for the needle. `bmiCategory` stays as is; `bmiBand` returns keys for i18n and gauge colours.

### Data (`src/data`, PGlite tests)
- `src/data/posture.ts`:
  - Extract the per-assessment scoring in `listPostureAssessments` into a private helper so both readers share it.
  - `latestPostureScores(db, patientIds): Promise<Map<string, { assessmentId; assessedOn; score; grade; previousScore; previousOn }>>`: two queries total (assessments for all ids, then views of the latest two per patient), never N+1. Empty ids → empty map.
- `src/data/visits.ts`: `visitVitalsOn(db, patientId, onDate): Promise<{ weightKg: number | null; painScale: number | null }>`, taking the latest non-null weight and the latest non-null pain from visits with `visit_date <= onDate`, each independently.
- Lifestyle: reuse `getLifestyleAssessmentSnapshot` (has `stressLevel`, `primaryGoal`).

### UI (`src/app`, `src/components`)
- `src/components/posture/PostureScoreCard.tsx`: Overview card (server component; uses `ScoreRing` small variant or a plain number, whichever reads better at card size).
- `src/components/posture/WellbeingGauges.tsx`: two SVG semicircle gauges (no chart library; BRAND colours; same in print).
- `src/components/PatientCard.tsx`: optional posture chip.
- `src/app/(app)/patients/page.tsx`: call `latestPostureScores` alongside `problemsForPatients` when the feature is on.
- Overview: refactor the inline stress/sleep colouring to use `stressBand`.
- i18n: new keys in `en.ts` / `mr.ts`, every label "English / मराठी".

### Not changing
- AI posture prompt context. The new report fields are display-only, and the AI stays de-identified.
- Schema. No migration.

## Tests
- `tests/lib/posture-compare.test.ts`: `scoreTrend` up/down/steady at the ±3 boundary, nulls.
- `tests/lib/wellbeing.test.ts`: every band boundary (stress 4/5, 7/8; pain 0/1, 3/4, 6/7; BMI 18.5/25/30), out-of-range, null; `gaugeFraction` clamping.
- `tests/data/posture.test.ts`: `latestPostureScores` with 0, 1 and 3 assessments per patient, multiple patients, assessment with no measurable views (score null), empty id list.
- `tests/data/visits.test.ts`: `visitVitalsOn` picks the latest on/before the date, ignores later visits, takes weight and pain independently when one is null, no visits → nulls.
- Coverage gate stays ≥ 80% on `src/lib`, `src/data`, `src/actions`.

## Manual QA
- Overview with 0, 1, 2+ assessments; feature flag off hides the card and chip.
- Client list shows chips without slowing the page (25 per page).
- Report prints on A4 with the profile strip and gauges, in both English and Marathi.
- Client with no lifestyle form and no visits: report shows no empty Wellbeing section.

## Decisions for Deepak
1. **Steady band ±3 points.** A retake of the same person usually moves the score by a few points, so smaller changes shouldn't show as progress. OK?
2. **Stress bands 1–4 / 5–7 / 8–10.** These match the Overview's current colours. FlexifyMe uses a 0–40 PSS-style scale; ours is the 1–10 from the lifestyle form.
3. **Client list chip.** Useful, or too much on the card?

## Docs
Update `docs/architecture.md` (module map: `wellbeing.ts`, `latestPostureScores`, `visitVitalsOn`, new components) and mark C3 done in `docs/superpowers/plans/2026-10-04-posture-followups.md` in the same commit as the code.
