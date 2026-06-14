# AI Treatment Plan Draft — Design Spec
Date: 2026-06-14 (revised after spec review)

## Overview

Add a "Generate with AI" button to the Treatment Plan card that calls Gemini to produce a draft across all 7 treatment fields. The therapist reviews, edits in-place, and saves using the existing Save button. Uses `GEMINI_API_KEY` (Gemini free credits).

## Architecture

### New files

| Path | Responsibility |
|---|---|
| `src/app/api/ai/treatment-plan/[patientId]/route.ts` | GET route handler: auth-guard (Supabase direct) → fetch all patient data → call Gemini → return 7-field JSON |
| `src/lib/gemini.ts` | Thin Gemini wrapper: `generateTreatmentDraft(context)` → calls `gemini-2.0-flash` via REST with structured output config, returns typed `TreatmentDraftFields` |
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
  → (overwrite-protection check — see UI section)
  → fetch GET /api/ai/treatment-plan/[patientId]
  → route handler: Supabase auth check → 401 JSON if not logged in
  → load patient + problems + lifestyle + visits
  → build prompt → call gemini.ts → return { yogaProgram, pranayam, ... }
  → TreatmentPlanForm fills controlled textarea state (textareas disabled during generation)

Therapist edits → clicks Save → existing saveTreatmentPlanAction (unchanged)
```

## Authentication in Route Handler

`requireUser()` must NOT be used in API route handlers — it calls Next.js `redirect()`, which the browser follows to `/login`, returning HTML instead of JSON and causing `res.json()` to throw a syntax error on the client.

Instead, the route handler authenticates directly via Supabase:

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
}
```

This returns a clean JSON 401, which the client can handle explicitly.

## Gemini Integration (`src/lib/gemini.ts`)

- Model: `gemini-2.0-flash` via REST (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=...`)
- No external SDK dependency — plain `fetch`
- Auth: `GEMINI_API_KEY` env var; throws clear error if missing (never exposed to client)
- Timeout: 15 seconds
- **Structured output:** `generationConfig.responseMimeType = "application/json"` + `responseSchema` — guarantees valid JSON without markdown wrapping or missing keys

### Structured output schema

```json
{
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "OBJECT",
      "properties": {
        "yogaProgram":  { "type": "STRING", "description": "Recommended yoga postures, sequence, or frequency." },
        "pranayam":     { "type": "STRING", "description": "Recommended breathing exercises." },
        "massage":      { "type": "STRING", "description": "Specific areas to massage, oils, or therapy recommendations." },
        "yogaTherapy":  { "type": "STRING", "description": "Therapeutic yoga techniques or modifications." },
        "dietPlan":     { "type": "STRING", "description": "Foods to eat, avoid, or timing instructions." },
        "medicines":    { "type": "STRING", "description": "Ayurvedic medicines or supplements." },
        "panchkarma":   { "type": "STRING", "description": "Panchkarma procedures recommended." }
      },
      "required": ["yogaProgram", "pranayam", "massage", "yogaTherapy", "dietPlan", "medicines", "panchkarma"]
    }
  }
}
```

- On HTTP error: throws descriptive error (caught by route handler → 500)

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

System prompt instructs Gemini to: act as a yoga therapy clinical assistant; generate a personalised treatment plan using the patient profile above; if lifestyle assessment data is absent, use available data (age, gender, BMI, ailments, visit history) and produce a best-effort plan; use clear, simple English suitable for a clinical record; return empty string for fields that are not applicable.

## UI — TreatmentPlanForm Component

**State:** Controlled `Record<fieldName, string>` initialized from `initialPlan` props. 7 textareas bind to this state. Boolean `generating` state controls disabled/loading behaviour.

**Generate button** — sits above the textareas in the card header area:
- Icon: `Sparkles` (lucide-react)
- Label: "Generate with AI / AI ने तयार करा"
- Variant: outline, size sm

**Overwrite protection:** Before calling the API, check if any of the 7 fields contains non-empty text. If so, show a shadcn `AlertDialog` confirmation:
> "This will replace your current plan with an AI draft. Unsaved edits will be lost. Continue? / यामुळे तुमचे न जतन केलेले बदल मिटवले जातील. पुढे जायचे?"

**During generation:**
- Button shows spinner, is disabled
- Label: "Generating… / तयार होत आहे"
- **All 7 textareas are disabled** — prevents therapist typing being silently overwritten when the response arrives

**On success:**
- All 7 textareas fill with AI draft values, re-enabled
- Button returns to normal

**On error:**
- Textareas re-enabled, button returns to normal
- Small red error line below button: "AI generation failed — please try again / पुन्हा प्रयत्न करा"

## Testing

### `tests/lib/gemini.test.ts`
- Mocks `fetch` → valid structured JSON: verifies all 7 fields returned and typed correctly
- Mocks `fetch` → HTTP 500: verifies error propagation
- Missing `GEMINI_API_KEY`: verifies clear thrown error

### `tests/app/api/ai/treatment-plan.test.ts`
- Mocks Supabase auth, all data fetchers (`getPatient`, `listProblems`, `getLifestyleAssessment`, `listVisits`), `generateTreatmentDraft`
- Happy path: returns 200 with 7-field JSON
- Unauthenticated (no Supabase user): returns 200 JSON `{ error: 'Unauthorized' }` with status 401
- Patient not found: returns 404
- Gemini fails: returns 500 with `{ error: "..." }`

### No component test for TreatmentPlanForm
Client component with interactive state; covered by manual QA (consistent with project convention).

## Invariants preserved
- All data fetching in the route handler goes through `src/data/*` functions (no direct DB queries)
- Auth check before any data access; returns clean JSON 401 (not a redirect)
- `GEMINI_API_KEY` server-only — never referenced in client code
- Save path unchanged — `saveTreatmentPlanAction` is not modified
