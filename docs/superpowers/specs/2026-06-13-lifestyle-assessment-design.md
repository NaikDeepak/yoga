# Pawar Yoga Therapy — Lifestyle Assessment Form

**Date:** 2026-06-13
**Status:** Approved
**Scope:** Per-patient lifestyle assessment — 5-section intake form, incrementally fillable across multiple visits

## Goal

Give the therapist a structured place to record the whole-person intake picture that isn't captured in the existing problems list, treatment plan, or visit notes: primary complaint context, medications, lifestyle habits, exercise history, goals, and safety contraindications. All fields optional; saved incrementally as the patient provides information over multiple visits.

## What is already captured (do not duplicate)

- Basic demographics: name, age, gender, occupation, height/weight, emergency contact, mobile/email/address — in `patients` table
- Health problems: ailment list with optional notes — in `patient_problems` table
- Documents: MRI, X-ray, prescriptions — in `documents` table
- Treatment plan: yoga program, pranayam, massage, yoga therapy, diet plan, medicines, panchkarma — in `treatment_plans` table
- Visit notes: date, progress note, weight, pain scale — in `visits` table

## New Tab

**"Assessment / मूल्यांकन"** — 6th tab on the patient detail page, after the existing Progress tab. Single scrollable page with 5 grouped Card sections. One **"Save Assessment / सेव्ह करा"** button at the bottom saves all sections at once (same pattern as Treatment Plan tab). On first save: insert. Every subsequent save: upsert (one assessment record per patient, not versioned — the assessment is a living document, not a log).

## Database Schema

New table `lifestyle_assessments` in `src/db/schema.ts`. One row per patient (`patientId` unique FK → patients, cascade delete). All content columns nullable.

```typescript
export const lifestyleAssessments = pgTable('lifestyle_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  // Section 1: Primary Concern
  chiefComplaint: text('chief_complaint'),
  duration: text('duration'),
  aggravatingFactors: text('aggravating_factors'),
  relievingFactors: text('relieving_factors'),
  previousTreatment: text('previous_treatment'),
  // Section 2: Medications & Restrictions
  currentMedications: text('current_medications'),
  doctorDiagnosis: text('doctor_diagnosis'),
  doctorRestrictions: text('doctor_restrictions'),
  // Section 3: Lifestyle
  workType: text('work_type'),           // 'desk' | 'standing' | 'physical'
  dailySitting: text('daily_sitting'),   // '<2h' | '2-4h' | '4-8h' | '8+h'
  activityLevel: text('activity_level'), // 'sedentary' | 'light' | 'active'
  sleepHours: text('sleep_hours'),
  sleepQuality: integer('sleep_quality'), // 1–10
  stressLevel: integer('stress_level'),   // 1–10
  screenTime: text('screen_time'),
  // Section 4: Exercise History
  previousExercise: text('previous_exercise'),
  fitnessLevel: text('fitness_level'),    // 'beginner' | 'intermediate' | 'active'
  fearOfMovement: boolean('fear_of_movement'),
  // Section 5: Goals & Safety
  primaryGoal: text('primary_goal'),
  activityStruggle: text('activity_struggle'),
  hasContraindications: boolean('has_contraindications'),
  contraindicationDetails: text('contraindication_details'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export type LifestyleAssessment = typeof lifestyleAssessments.$inferSelect;
```

After schema change: `npm run db:generate` → `npm run db:migrate`.

**RLS:** `.enableRLS()` is sufficient — the migration will emit `ALTER TABLE "lifestyle_assessments" ENABLE ROW LEVEL SECURITY;`. No explicit policy is needed. The app connects via the Supabase transaction pooler using the `postgres` superuser, which bypasses RLS (same as all existing tables — no per-table policies exist in the migration files).

## Data Layer

### `src/data/lifestyle.ts`

```typescript
getLifestyleAssessment(db, patientId): Promise<LifestyleAssessment | undefined>
upsertLifestyleAssessment(db, patientId, input: LifestyleInput): Promise<void>
```

`upsertLifestyleAssessment` uses Drizzle's `.insert(...).onConflictDoUpdate({ target: lifestyleAssessments.patientId, set: { ...input, updatedAt: new Date() } })`. Returns `void` — the action does not use the return value (same as `upsertTreatmentPlan`).

### `src/lib/validation.ts`

New `lifestyleSchema` (all fields optional):
Use the existing `opt()` helper from `src/lib/validation.ts` for all fields — it wraps `blankToUndef` preprocessing so empty form strings become `undefined` (stored as `null`), not `""`. This is essential for "fill incrementally" semantics.

- Long text fields (`chiefComplaint`, `aggravatingFactors`, `relievingFactors`, `previousTreatment`, `primaryGoal`, `contraindicationDetails`): `opt(z.string().trim().max(1000))`
- Short text fields (`duration`, `currentMedications`, `doctorDiagnosis`, `doctorRestrictions`, `sleepHours`, `previousExercise`, `activityStruggle`, `screenTime`): `opt(z.string().trim().max(500))`
- `workType`: `opt(z.enum(['desk', 'standing', 'physical']))`
- `dailySitting`: `opt(z.enum(['<2h', '2-4h', '4-8h', '8+h']))`
- `activityLevel`: `opt(z.enum(['sedentary', 'light', 'active']))`
- `fitnessLevel`: `opt(z.enum(['beginner', 'intermediate', 'active']))`
- `sleepQuality`, `stressLevel`: `opt(z.coerce.number().int().min(1).max(10))`
- `fearOfMovement`, `hasContraindications`: `z.preprocess(v => v === 'true' || v === true, z.boolean()).optional()` (checkbox sends 'on'/'off', not blank, so `opt()` is not appropriate here)
- `contraindicationDetails` only meaningful when `hasContraindications` is true — no cross-field validation needed (therapist manages this)

### `src/actions/lifestyle.ts`

```typescript
saveLifestyleAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult>
```

Pattern: `requireUser` → parse formData → `lifestyleSchema.safeParse` → `upsertLifestyleAssessment` → `revalidatePath(/patients/${patientId})`.

## UI

### No separate `LifestyleForm` component

The Assessment tab follows the **same pattern as the Treatment Plan tab**: an async server component renders fields directly inside `<InlineForm action={saveLifestyleAssessmentAction.bind(null, patientId)}>`. No separate client component is needed — `InlineForm` (already `'use client'`) handles error display and form state. Do not create a `LifestyleForm.tsx` file.

**Section 1 — Primary Concern / मुख्य तक्रार**
Four `Textarea` + one `Input`:
- What brings you here / कशासाठी आलात (`chiefComplaint`) — `Textarea`
- Since when / केव्हापासून (`duration`) — `Input` (single-line, e.g. "2 months")
- What makes it worse / काय त्रास वाढवते (`aggravatingFactors`) — `Textarea`
- What makes it better / काय आराम देते (`relievingFactors`) — `Textarea`
- Previous treatments tried / आधी कोणते उपचार केले (`previousTreatment`) — `Textarea`

**Section 2 — Medications & Restrictions / औषधे**
Three `Textarea` fields:
- Current medications / सध्याची औषधे (`currentMedications`)
- Doctor's diagnosis / डॉक्टरांचे निदान (`doctorDiagnosis`)
- Doctor's restrictions / डॉक्टरांनी काय टाळायला सांगितले (`doctorRestrictions`)

**Section 3 — Lifestyle / जीवनशैली**
- Work type / कामाचा प्रकार (`workType`) — shadcn `Select`: value `desk`/`standing`/`physical`, labels "Desk job / Standing / Physical labour"
- Daily sitting / दररोज बसणे (`dailySitting`) — `Select`: values `<2h`/`2-4h`/`4-8h`/`8+h`
- Activity level / सक्रियता (`activityLevel`) — `Select`: values `sedentary`/`light`/`active`
- Sleep hours / झोपेचे तास (`sleepHours`) — `Input` text (e.g. "7")
- Sleep quality / झोपेचा दर्जा (`sleepQuality`) — `<Input type="number" min="1" max="10" name="sleepQuality" defaultValue={...}>` (matches painScale pattern in visits form)
- Stress level / ताण पातळी (`stressLevel`) — same `Input type="number" min="1" max="10"`
- Screen time / स्क्रीन वेळ (`screenTime`) — `Input` text (e.g. "6 hrs")

**Section 4 — Exercise History / व्यायामाचा इतिहास**
- Previous exercise / आधीचा व्यायाम (`previousExercise`) — `Input` text (e.g. "yoga, walking")
- Fitness level / तंदुरुस्ती पातळी (`fitnessLevel`) — `Select`: values `beginner`/`intermediate`/`active`
- Afraid movement worsens pain? / हालचालीची भीती (`fearOfMovement`) — `Checkbox` (shadcn); value `"true"` when checked, omitted when unchecked — Zod preprocessor handles both

**Section 5 — Goals & Safety / उद्दिष्टे आणि सुरक्षितता**
- Primary goal / मुख्य उद्दिष्ट (`primaryGoal`) — `Textarea`
- Activity currently struggling with / अडचणीचे काम (`activityStruggle`) — `Input` text
- Any contraindications? / काही धोके? (`hasContraindications`) — `Checkbox`; `contraindicationDetails` `Textarea` always rendered but shown/hidden via `hidden` class — this is a server-rendered form so no JS toggle needed; therapist can see both

**Save button**: full-width on mobile, right-aligned on desktop. No pending state indicator needed (same as Treatment Plan tab).

### Tab integration (`src/app/(app)/patients/[id]/page.tsx`)

- Add `['assessment', 'Assessment / मूल्यांकन']` as 6th entry in `TABS`
- Import `getLifestyleAssessment` from `@/data/lifestyle`
- Import `InlineForm` from `@/components/InlineForm`
- Import `saveLifestyleAssessmentAction` from `@/actions/lifestyle`
- Add async `Assessment({ patientId })` server function: fetches existing row, renders 5-section form inside `<InlineForm action={saveLifestyleAssessmentAction.bind(null, patientId)}>` with each field using `defaultValue={existing?.fieldName ?? ''}` (or `defaultChecked` for checkboxes)
- Add `{tab === 'assessment' && <Assessment patientId={id} />}` in tab content

## Tests

`tests/data/lifestyle.test.ts` — PGlite integration tests (new file, follows `clinical.test.ts` pattern):
- `getLifestyleAssessment` returns `undefined` for new patient
- `upsertLifestyleAssessment` inserts on first call (row exists after)
- Second call with different values updates the same row — confirm only one row per patient
- Partial fields: only filled fields are stored; unfilled remain `null`

`tests/actions/actions.test.ts` — add lifestyle cases to the **existing** file (do not create `tests/actions/lifestyle.test.ts`):
- Happy path: valid formData → `saveLifestyleAssessmentAction` returns `{ ok: true }`
- Auth guard: `requireUser` throws → returns `{ ok: false, error: ... }`

## Out of Scope

- Versioning / history of assessment changes (not a log — single living document per patient)
- Patient-facing form (therapist fills it in during consultation)
- Mental wellbeing questionnaire (section 9 from reference) — deferred
- Daily habits detail (section 10) — partially covered by lifestyle section; full version deferred
- Commitment & preferences (section 13) — deferred
- Contraindication auto-flagging or alerts — therapist reviews manually
