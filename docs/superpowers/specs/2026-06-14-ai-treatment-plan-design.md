# AI Treatment Plan Draft — Design Spec
Date: 2026-06-14

## Overview

Add a "Generate with AI" button to the Treatment Plan card that calls Gemini to produce a draft across all 7 treatment fields. The therapist reviews, edits in-place, and saves using the existing Save button. Uses `GEMINI_API_KEY` (Gemini free credits).

## Architecture

### New files

| Path | Responsibility |
|---|---|
| `src/app/api/ai/treatment-plan/[patientId]/route.ts` | GET route handler: auth-guard → fetch all patient data → call Gemini → return 7-field JSON |
| `src/lib/gemini.ts` | Thin Gemini wrapper: `generateTreatmentDraft(context)` → calls `gemini-2.0-flash` via REST, returns parsed `TreatmentDraftFields` |
| `src/components/TreatmentPlanForm.tsx` | Client component extracted from `Treatment()` in `page.tsx`; owns textarea state + generate button |

### Modified files

| Path | Change |
|---|---|
| `src/app/(app)/patients/[id]/page.tsx` | `Treatment()` fetches initial plan server-side, passes `{ patientId, initialPlan }` to `TreatmentPlanForm`. Page stays server-rendered; only the card is a client island. |

### Data flow

```
Treatment tab loads (server)
  → fetches initialPlan → passes as props to TreatmentPlanForm

Therapist clicks "Generate with AI"
  → fetch GET /api/ai/treatment-plan/[patientId]
  → route handler: requireUser → load patient + problems + lifestyle + visits
  → build prompt → call gemini.ts → return { yogaProgram, pranayam, ... }
  → TreatmentPlanForm fills controlled textarea state

Therapist edits → clicks Save → existing saveTreatmentPlanAction (unchanged)
```

## Gemini Integration (`src/lib/gemini.ts`)

- Model: `gemini-2.0-flash` (fast, free-tier friendly)
- Auth: `GEMINI_API_KEY` env var; throws clear error if missing
- Timeout: 15 seconds
- Output: instructs Gemini to return **only valid JSON** with exactly 7 keys; parses and validates before returning
- On malformed JSON or HTTP error: throws descriptive error (caught by route handler → 500)

### Context assembled by route handler

```
Patient: {name}, {age}y, {gender}, BMI {bmi}
Ailments: [{problem list}]
Chief complaint: {chiefComplaint}, since {duration}
Aggravating: {aggravatingFactors} | Relieving: {relievingFactors}
Previous treatment: {previousTreatment}
Medications: {currentMedications} | Doctor diagnosis: {doctorDiagnosis}
Doctor restrictions: {doctorRestrictions}
Lifestyle: {workType} work, sitting {dailySitting}/day, activity {activityLevel}
Sleep: {sleepHours}h, quality {sleepQuality}/10, stress {stressLevel}/10
Screen time: {screenTime}
Exercise history: {previousExercise}, fitness {fitnessLevel}, fear of movement: {fearOfMovement}
Goal: {primaryGoal} | Struggles with: {activityStruggle}
Contraindications: {hasContraindications} — {contraindicationDetails}
Recent visits ({count}): latest pain {painScale}/10, weight trend {first→last kg}
```

System prompt: act as a yoga therapy clinical assistant; return only valid JSON with keys `yogaProgram`, `pranayam`, `massage`, `yogaTherapy`, `dietPlan`, `medicines`, `panchkarma`; each value is a short English text (2–5 sentences); return empty string if field is not applicable.

If the patient has no lifestyle assessment, generate from whatever is available (ailments, patient basics, visit history). No blocking or warning.

## UI — TreatmentPlanForm Component

**State:** Controlled `Record<fieldName, string>` initialized from `initialPlan` props. 7 textareas bind to this state.

**Generate button** — sits above the textareas in the card header area:
- Icon: `Sparkles` (lucide-react)
- Label: "Generate with AI / AI ने तयार करा"
- Variant: outline, size sm

**During generation:**
- Button shows spinner, disabled
- Label: "Generating… / तयार होत आहे"
- Textareas remain editable

**On success:**
- All 7 textareas fill with AI draft values
- Button returns to normal

**On error:**
- Button returns to normal
- Small red error line below button: "AI generation failed — please try again / पुन्हा प्रयत्न करा"
- No toast

**No confirmation dialog** — overwriting existing plan content is reversible (therapist edits in-place; DB only changes on Save).

## Testing

### `tests/lib/gemini.test.ts`
- Mocks `fetch` → valid JSON: verifies all 7 fields returned and typed correctly
- Mocks `fetch` → malformed JSON: verifies function throws descriptive error
- Mocks `fetch` → HTTP 500 / timeout: verifies error propagation
- Missing `GEMINI_API_KEY`: verifies clear thrown error

### `tests/app/api/ai/treatment-plan.test.ts`
- Mocks `requireUser`, all data fetchers, `generateTreatmentDraft`
- Happy path: returns 200 with 7-field JSON
- Unauthenticated: `requireUser` throws → 401
- Patient not found → 404
- Gemini fails → 500 with `{ error: "..." }`

### No component test for TreatmentPlanForm
Client component with interactive state; covered by manual QA (consistent with project convention).

## Invariants preserved
- All data fetching in the route handler goes through `src/data/*` functions (no direct DB queries)
- `requireUser()` called before any data access
- `GEMINI_API_KEY` never exposed to client (server-only route handler)
- Save path unchanged — `saveTreatmentPlanAction` is not modified
