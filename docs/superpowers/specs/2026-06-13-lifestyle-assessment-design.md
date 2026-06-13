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

## Data Layer

### `src/data/lifestyle.ts`

```typescript
getLifestyleAssessment(db, patientId): Promise<LifestyleAssessment | undefined>
upsertLifestyleAssessment(db, patientId, input: LifestyleInput): Promise<LifestyleAssessment>
```

`upsertLifestyleAssessment` uses Drizzle's `.insert(...).onConflictDoUpdate({ target: lifestyleAssessments.patientId, set: { ...input, updatedAt: new Date() } })`.

### `src/lib/validation.ts`

New `lifestyleSchema` (all fields optional):
- Long text fields (`chiefComplaint`, `aggravatingFactors`, `relievingFactors`, `previousTreatment`, `primaryGoal`, `contraindicationDetails`): `z.string().trim().max(1000).optional()`
- Short text fields (`duration`, `currentMedications`, `doctorDiagnosis`, `doctorRestrictions`, `sleepHours`, `previousExercise`, `activityStruggle`, `screenTime`): `z.string().trim().max(500).optional()`
- `workType`: `z.enum(['desk', 'standing', 'physical']).optional()`
- `dailySitting`: `z.enum(['<2h', '2-4h', '4-8h', '8+h']).optional()`
- `activityLevel`: `z.enum(['sedentary', 'light', 'active']).optional()`
- `fitnessLevel`: `z.enum(['beginner', 'intermediate', 'active']).optional()`
- `sleepQuality`, `stressLevel`: `z.coerce.number().int().min(1).max(10).optional()`
- `fearOfMovement`, `hasContraindications`: `z.preprocess(v => v === 'true' || v === true, z.boolean()).optional()`
- `contraindicationDetails` only meaningful when `hasContraindications` is true — no cross-field validation needed (therapist manages this)

### `src/actions/lifestyle.ts`

```typescript
saveLifestyleAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult>
```

Pattern: `requireUser` → parse formData → `lifestyleSchema.safeParse` → `upsertLifestyleAssessment` → `revalidatePath(/patients/${patientId})`.

## UI

### `src/components/LifestyleForm.tsx`

`'use client'` component. Props: `patientId: string`, `defaultValues: Partial<LifestyleAssessment>`. Uses `useTransition` + `startTransition` to call `saveLifestyleAssessmentAction`. Error displayed with the existing inline error pattern (`bg-destructive/10 text-destructive`). Success: error clears (no toast needed — save button returns to idle state).

**Section 1 — Primary Concern / मुख्य तक्रार**
Five `Textarea` fields:
- What brings you here / कशासाठी आलात (`chiefComplaint`)
- Since when / केव्हापासून (`duration`)
- What makes it worse / काय त्रास वाढवते (`aggravatingFactors`)
- What makes it better / काय आराम देते (`relievingFactors`)
- Previous treatments tried / आधी कोणते उपचार केले (`previousTreatment`)

**Section 2 — Medications & Restrictions / औषधे**
Three `Textarea` fields:
- Current medications / सध्याची औषधे (`currentMedications`)
- Doctor's diagnosis / डॉक्टरांचे निदान (`doctorDiagnosis`)
- Doctor's restrictions / डॉक्टरांनी काय टाळायला सांगितले (`doctorRestrictions`)

**Section 3 — Lifestyle / जीवनशैली**
- Work type / कामाचा प्रकार (`workType`) — shadcn `Select`: Desk job | Standing | Physical labour
- Daily sitting / दररोज बसणे (`dailySitting`) — `Select`: <2 hrs | 2–4 hrs | 4–8 hrs | 8+ hrs
- Activity level / सक्रियता (`activityLevel`) — `Select`: Sedentary | Light | Active
- Sleep hours / झोपेचे तास (`sleepHours`) — `Input` text
- Sleep quality / झोपेचा दर्जा (`sleepQuality`) — `Select` 1–10
- Stress level / ताण पातळी (`stressLevel`) — `Select` 1–10
- Screen time / स्क्रीन वेळ (`screenTime`) — `Input` text

**Section 4 — Exercise History / व्यायामाचा इतिहास**
- Previous exercise / आधीचा व्यायाम (`previousExercise`) — `Input` text (free text: "yoga, walking")
- Fitness level / तंदुरुस्ती पातळी (`fitnessLevel`) — `Select`: Beginner | Intermediate | Active
- Afraid movement worsens pain? / हालचालीची भीती (`fearOfMovement`) — `Checkbox` (shadcn)

**Section 5 — Goals & Safety / उद्दिष्टे आणि सुरक्षितता**
- Primary goal / मुख्य उद्दिष्ट (`primaryGoal`) — `Textarea`
- Activity currently struggling with / अडचणीचे काम (`activityStruggle`) — `Input` text
- Any contraindications? / काही धोके? (`hasContraindications`) — `Checkbox`; when checked, reveals `Textarea` for details (`contraindicationDetails`)

**Save button**: full-width on mobile, right-aligned on desktop. Shows "Saving… / सेव्ह होत आहे…" while pending.

### Tab integration (`src/app/(app)/patients/[id]/page.tsx`)

- Add `['assessment', 'Assessment / मूल्यांकन']` as 6th entry in `TABS`
- Import `getLifestyleAssessment` from `@/data/lifestyle`
- Import `LifestyleForm` from `@/components/LifestyleForm`
- Add async `Assessment({ patientId })` server function: fetches assessment row, renders `LifestyleForm` with `defaultValues`
- Add `{tab === 'assessment' && <Assessment patientId={id} />}` in tab content

## Tests

`tests/data/lifestyle.test.ts` — PGlite integration tests:
- `getLifestyleAssessment` returns `undefined` for new patient
- `upsertLifestyleAssessment` inserts on first call, returns the row
- Second call with different values updates the same row (upsert semantics — only one row per patient)
- Partial fields: only filled fields are stored; unfilled remain null

`tests/actions/lifestyle.test.ts` — using action-mocks pattern:
- Happy path: valid formData → calls upsert → returns `{ ok: true }`
- Auth guard: `requireUser` throws → returns `{ ok: false, error: ... }` (via existing mock pattern)

## Out of Scope

- Versioning / history of assessment changes (not a log — single living document per patient)
- Patient-facing form (therapist fills it in during consultation)
- Mental wellbeing questionnaire (section 9 from reference) — deferred
- Daily habits detail (section 10) — partially covered by lifestyle section; full version deferred
- Commitment & preferences (section 13) — deferred
- Contraindication auto-flagging or alerts — therapist reviews manually
