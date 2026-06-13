# Lifestyle Assessment Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6th "Assessment / मूल्यांकन" tab to the patient detail page with a 5-section, ~22-field lifestyle intake form that upserts one living record per patient.

**Architecture:** New `lifestyle_assessments` table (one row per patient, unique FK, cascade delete). Data layer (`src/data/lifestyle.ts`) follows the `treatment.ts` upsert pattern. Action (`src/actions/lifestyle.ts`) follows `saveTreatmentPlanAction` exactly. UI is a server component using `InlineForm` — no client component needed.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM v0.45, Zod (`opt()` helper for blank-to-undefined), shadcn/ui (Card, Label, Input, Textarea, Button), native `<select>` for dropdowns, PGlite for tests.

---

## File map

| Action | Path |
|--------|------|
| Modify | `src/db/schema.ts` |
| Generate | `drizzle/<new-migration>.sql` (auto-generated) |
| Modify | `src/lib/validation.ts` |
| Create | `src/data/lifestyle.ts` |
| Create | `tests/data/lifestyle.test.ts` |
| Create | `src/actions/lifestyle.ts` |
| Modify | `tests/actions/actions.test.ts` |
| Modify | `src/app/(app)/patients/[id]/page.tsx` |
| Modify | `docs/architecture.md` |

---

## Task 1: Schema — add `lifestyle_assessments` table

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add table and type to schema**

Open `src/db/schema.ts`. At the bottom, **after** the `export type Visit = ...` line, add:

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
  workType: text('work_type'),
  dailySitting: text('daily_sitting'),
  activityLevel: text('activity_level'),
  sleepHours: text('sleep_hours'),
  sleepQuality: integer('sleep_quality'),
  stressLevel: integer('stress_level'),
  screenTime: text('screen_time'),
  // Section 4: Exercise History
  previousExercise: text('previous_exercise'),
  fitnessLevel: text('fitness_level'),
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

The import line at the top of `schema.ts` already includes `boolean`, `integer`, `text`, `timestamp`, `uuid`, and `pgTable` — no new imports needed.

- [ ] **Step 2: Generate the migration**

```bash
npm run db:generate
```

Expected: Drizzle prints something like `[✓] Your SQL migration file ➜ drizzle/0002_<name>.sql`. A new file appears in `drizzle/`.

- [ ] **Step 3: Run the migration against the local Supabase DB**

```bash
npm run db:migrate
```

Expected: Drizzle prints `[✓] Migrations applied` (or similar). No errors.

- [ ] **Step 4: Verify migration file exists and looks correct**

```bash
ls drizzle/
```

Expected: a file named `0002_*.sql` exists. Open it and confirm it contains `CREATE TABLE "lifestyle_assessments"` and `ALTER TABLE "lifestyle_assessments" ENABLE ROW LEVEL SECURITY`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add lifestyle_assessments schema and migration"
```

---

## Task 2: Validation schema

**Files:**
- Modify: `src/lib/validation.ts`

- [ ] **Step 1: Add `lifestyleSchema` and `LifestyleInput`**

Open `src/lib/validation.ts`. The file already defines `opt` and `blankToUndef` at the top. Append after the last export (`firstError`):

```typescript
export const lifestyleSchema = z.object({
  // Section 1: Primary Concern
  chiefComplaint: opt(z.string().trim().max(1000)),
  duration: opt(z.string().trim().max(500)),
  aggravatingFactors: opt(z.string().trim().max(1000)),
  relievingFactors: opt(z.string().trim().max(1000)),
  previousTreatment: opt(z.string().trim().max(1000)),
  // Section 2: Medications & Restrictions
  currentMedications: opt(z.string().trim().max(500)),
  doctorDiagnosis: opt(z.string().trim().max(500)),
  doctorRestrictions: opt(z.string().trim().max(500)),
  // Section 3: Lifestyle
  workType: opt(z.enum(['desk', 'standing', 'physical'])),
  dailySitting: opt(z.enum(['<2h', '2-4h', '4-8h', '8+h'])),
  activityLevel: opt(z.enum(['sedentary', 'light', 'active'])),
  sleepHours: opt(z.string().trim().max(500)),
  sleepQuality: opt(z.coerce.number().int().min(1).max(10)),
  stressLevel: opt(z.coerce.number().int().min(1).max(10)),
  screenTime: opt(z.string().trim().max(500)),
  // Section 4: Exercise History
  previousExercise: opt(z.string().trim().max(500)),
  fitnessLevel: opt(z.enum(['beginner', 'intermediate', 'active'])),
  fearOfMovement: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  // Section 5: Goals & Safety
  primaryGoal: opt(z.string().trim().max(1000)),
  activityStruggle: opt(z.string().trim().max(500)),
  hasContraindications: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  contraindicationDetails: opt(z.string().trim().max(1000)),
});
export type LifestyleInput = z.infer<typeof lifestyleSchema>;
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation.ts
git commit -m "feat: add lifestyleSchema validation"
```

---

## Task 3: Data layer + PGlite tests (TDD)

**Files:**
- Create: `tests/data/lifestyle.test.ts`
- Create: `src/data/lifestyle.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/data/lifestyle.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getLifestyleAssessment, upsertLifestyleAssessment } from '@/data/lifestyle';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('getLifestyleAssessment', () => {
  it('returns undefined for a patient with no assessment', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result).toBeUndefined();
  });
});

describe('upsertLifestyleAssessment', () => {
  it('inserts a new row on first call', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Back pain' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result).toBeDefined();
    expect(result!.chiefComplaint).toBe('Back pain');
    expect(result!.patientId).toBe(p.id);
  });

  it('updates the existing row on second call (one row per patient)', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Knee pain' });
    await upsertLifestyleAssessment(db, p.id, { chiefComplaint: 'Back pain', duration: '3 months' });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result!.chiefComplaint).toBe('Back pain');
    expect(result!.duration).toBe('3 months');
  });

  it('stores only filled fields; unfilled remain null', async () => {
    const p = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    await upsertLifestyleAssessment(db, p.id, { workType: 'desk', sleepQuality: 7 });
    const result = await getLifestyleAssessment(db, p.id);
    expect(result!.workType).toBe('desk');
    expect(result!.sleepQuality).toBe(7);
    expect(result!.chiefComplaint).toBeNull();
    expect(result!.primaryGoal).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npm test tests/data/lifestyle.test.ts
```

Expected: FAIL — "Cannot find module '@/data/lifestyle'"

- [ ] **Step 3: Create the data layer**

Create `src/data/lifestyle.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { lifestyleAssessments, type LifestyleAssessment } from '@/db/schema';
import type { Db } from '@/db/types';
import type { LifestyleInput } from '@/lib/validation';

export async function getLifestyleAssessment(db: Db, patientId: string): Promise<LifestyleAssessment | undefined> {
  const [row] = await db.select().from(lifestyleAssessments).where(eq(lifestyleAssessments.patientId, patientId));
  return row;
}

export async function upsertLifestyleAssessment(db: Db, patientId: string, input: LifestyleInput): Promise<void> {
  await db.insert(lifestyleAssessments)
    .values({ ...input, patientId })
    .onConflictDoUpdate({
      target: lifestyleAssessments.patientId,
      set: { ...input, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npm test tests/data/lifestyle.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add tests/data/lifestyle.test.ts src/data/lifestyle.ts
git commit -m "feat: lifestyle data layer with PGlite tests"
```

---

## Task 4: Server action + action tests (TDD)

**Files:**
- Modify: `tests/actions/actions.test.ts`
- Create: `src/actions/lifestyle.ts`

- [ ] **Step 1: Add the failing tests to the existing actions test file**

Open `tests/actions/actions.test.ts`. Add the following imports at the top of the file (alongside existing imports):

```typescript
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { getLifestyleAssessment } from '@/data/lifestyle';
```

Then append the following describe block at the **end** of the file (after the `documents actions` block):

```typescript
describe('saveLifestyleAssessmentAction', () => {
  it('upserts assessment data and returns ok:true', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await saveLifestyleAssessmentAction(
      p.id,
      fd({ chiefComplaint: 'Knee pain', workType: 'desk', sleepQuality: '7' }),
    );
    expect(result).toEqual({ ok: true });
    const saved = await getLifestyleAssessment(db, p.id);
    expect(saved!.chiefComplaint).toBe('Knee pain');
    expect(saved!.workType).toBe('desk');
    expect(saved!.sleepQuality).toBe(7);
  });

  it('returns ok:false for invalid enum value', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await saveLifestyleAssessmentAction(
      p.id,
      fd({ workType: 'couch-surfing' }),
    );
    expect(result).toMatchObject({ ok: false });
    expect(await getLifestyleAssessment(db, p.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npm test tests/actions/actions.test.ts
```

Expected: FAIL — "Cannot find module '@/actions/lifestyle'"

- [ ] **Step 3: Create the action**

Create `src/actions/lifestyle.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { lifestyleSchema, firstError } from '@/lib/validation';
import { upsertLifestyleAssessment } from '@/data/lifestyle';
import type { ActionResult } from './patients';

export async function saveLifestyleAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = lifestyleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await upsertLifestyleAssessment(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run action tests — all must pass**

```bash
npm test tests/actions/actions.test.ts
```

Expected: all tests PASS (existing tests unchanged, 2 new tests pass).

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/actions/lifestyle.ts tests/actions/actions.test.ts
git commit -m "feat: saveLifestyleAssessmentAction with action tests"
```

---

## Task 5: Assessment tab UI + architecture doc update

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Add imports**

Open `src/app/(app)/patients/[id]/page.tsx`. The file already imports `InlineForm`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Label`, `Input`, `Textarea`, `Button`. Add two more imports alongside the existing ones:

```typescript
import { getLifestyleAssessment } from '@/data/lifestyle';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
```

- [ ] **Step 2: Add Assessment to TABS**

Find the `TABS` constant:

```typescript
const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
  ['progress', 'Progress / प्रगती'],
] as const;
```

Replace it with:

```typescript
const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
  ['progress', 'Progress / प्रगती'],
  ['assessment', 'Assessment / मूल्यांकन'],
] as const;
```

- [ ] **Step 3: Add tab content render**

Find the tab content block inside the `PatientPage` component:

```typescript
{tab === 'progress' && <Progress patientId={id} />}
```

Add one line after it:

```typescript
{tab === 'assessment' && <Assessment patientId={id} />}
```

- [ ] **Step 4: Add the `Assessment` server function**

Append the following function at the **end** of the file (after the `Progress` function):

```typescript
async function Assessment({ patientId }: { patientId: string }) {
  const existing = await getLifestyleAssessment(getDb(), patientId);
  const selectClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="max-w-2xl space-y-6">
      <InlineForm
        action={saveLifestyleAssessmentAction.bind(null, patientId)}
        className="space-y-6"
      >
        {/* Section 1: Primary Concern */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Concern / मुख्य तक्रार</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-chiefComplaint">What brings you here / कशासाठी आलात</Label>
              <Textarea
                id="a-chiefComplaint"
                name="chiefComplaint"
                rows={3}
                defaultValue={existing?.chiefComplaint ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-duration">Since when / केव्हापासून</Label>
              <Input
                id="a-duration"
                name="duration"
                placeholder="e.g. 2 months / २ महिने"
                defaultValue={existing?.duration ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-aggravatingFactors">What makes it worse / काय त्रास वाढवते</Label>
              <Textarea
                id="a-aggravatingFactors"
                name="aggravatingFactors"
                rows={2}
                defaultValue={existing?.aggravatingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-relievingFactors">What makes it better / काय आराम देते</Label>
              <Textarea
                id="a-relievingFactors"
                name="relievingFactors"
                rows={2}
                defaultValue={existing?.relievingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-previousTreatment">Previous treatments tried / आधी कोणते उपचार केले</Label>
              <Textarea
                id="a-previousTreatment"
                name="previousTreatment"
                rows={2}
                defaultValue={existing?.previousTreatment ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Medications & Restrictions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medications & Restrictions / औषधे</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-currentMedications">Current medications / सध्याची औषधे</Label>
              <Textarea
                id="a-currentMedications"
                name="currentMedications"
                rows={2}
                defaultValue={existing?.currentMedications ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorDiagnosis">Doctor&apos;s diagnosis / डॉक्टरांचे निदान</Label>
              <Textarea
                id="a-doctorDiagnosis"
                name="doctorDiagnosis"
                rows={2}
                defaultValue={existing?.doctorDiagnosis ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorRestrictions">
                Doctor&apos;s restrictions / डॉक्टरांनी काय टाळायला सांगितले
              </Label>
              <Textarea
                id="a-doctorRestrictions"
                name="doctorRestrictions"
                rows={2}
                defaultValue={existing?.doctorRestrictions ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Lifestyle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifestyle / जीवनशैली</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="a-workType">Work type / कामाचा प्रकार</Label>
                <select
                  id="a-workType"
                  name="workType"
                  defaultValue={existing?.workType ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="desk">Desk job / बैठे काम</option>
                  <option value="standing">Standing / उभे राहणे</option>
                  <option value="physical">Physical labour / शारीरिक श्रम</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-dailySitting">Daily sitting / दररोज बसणे</Label>
                <select
                  id="a-dailySitting"
                  name="dailySitting"
                  defaultValue={existing?.dailySitting ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="<2h">&lt;2 hrs</option>
                  <option value="2-4h">2–4 hrs</option>
                  <option value="4-8h">4–8 hrs</option>
                  <option value="8+h">8+ hrs</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-activityLevel">Activity level / सक्रियता</Label>
                <select
                  id="a-activityLevel"
                  name="activityLevel"
                  defaultValue={existing?.activityLevel ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="sedentary">Sedentary / बैठी जीवनशैली</option>
                  <option value="light">Light / सौम्य</option>
                  <option value="active">Active / सक्रिय</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepHours">Sleep hours / झोपेचे तास</Label>
                <Input
                  id="a-sleepHours"
                  name="sleepHours"
                  placeholder="e.g. 7"
                  defaultValue={existing?.sleepHours ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepQuality">Sleep quality 1–10 / झोपेचा दर्जा</Label>
                <Input
                  id="a-sleepQuality"
                  name="sleepQuality"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={existing?.sleepQuality?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-stressLevel">Stress level 1–10 / ताण पातळी</Label>
                <Input
                  id="a-stressLevel"
                  name="stressLevel"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={existing?.stressLevel?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-screenTime">Screen time / स्क्रीन वेळ</Label>
                <Input
                  id="a-screenTime"
                  name="screenTime"
                  placeholder="e.g. 6 hrs"
                  defaultValue={existing?.screenTime ?? ''}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Exercise History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exercise History / व्यायामाचा इतिहास</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-previousExercise">Previous exercise / आधीचा व्यायाम</Label>
              <Input
                id="a-previousExercise"
                name="previousExercise"
                placeholder="e.g. yoga, walking / योग, चालणे"
                defaultValue={existing?.previousExercise ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-fitnessLevel">Fitness level / तंदुरुस्ती पातळी</Label>
              <select
                id="a-fitnessLevel"
                name="fitnessLevel"
                defaultValue={existing?.fitnessLevel ?? ''}
                className={selectClass}
              >
                <option value="">—</option>
                <option value="beginner">Beginner / नवीन</option>
                <option value="intermediate">Intermediate / मध्यम</option>
                <option value="active">Active / सक्रिय</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="fearOfMovement"
                value="true"
                defaultChecked={existing?.fearOfMovement ?? false}
                className="h-4 w-4 rounded border-input"
              />
              Afraid movement worsens pain? / हालचालीची भीती
            </label>
          </CardContent>
        </Card>

        {/* Section 5: Goals & Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goals & Safety / उद्दिष्टे आणि सुरक्षितता</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-primaryGoal">Primary goal / मुख्य उद्दिष्ट</Label>
              <Textarea
                id="a-primaryGoal"
                name="primaryGoal"
                rows={2}
                defaultValue={existing?.primaryGoal ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-activityStruggle">Activity currently struggling with / अडचणीचे काम</Label>
              <Input
                id="a-activityStruggle"
                name="activityStruggle"
                placeholder="e.g. climbing stairs / जिने चढणे"
                defaultValue={existing?.activityStruggle ?? ''}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="hasContraindications"
                value="true"
                defaultChecked={existing?.hasContraindications ?? false}
                className="h-4 w-4 rounded border-input"
              />
              Any contraindications? / काही धोके?
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="a-contraindicationDetails">Contraindication details / तपशील</Label>
              <Textarea
                id="a-contraindicationDetails"
                name="contraindicationDetails"
                rows={2}
                defaultValue={existing?.contraindicationDetails ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Assessment / सेव्ह करा</Button>
        </div>
      </InlineForm>
    </div>
  );
}
```

- [ ] **Step 5: Update `docs/architecture.md`**

In the Module map table, update these two rows:

Find:
```
| `src/db/schema.ts` | 5 tables: patients, patient_problems, documents, treatment_plans, visits | table objects + row types |
```
Replace with:
```
| `src/db/schema.ts` | 6 tables: patients, patient_problems, documents, treatment_plans, visits, lifestyle_assessments | table objects + row types |
```

Find:
```
| `src/lib/validation.ts` | zod schemas, bilingual messages | `patientSchema`, `problemSchema`, `treatmentSchema`, `visitSchema`, `docTypeSchema`, `firstError` |
```
Replace with:
```
| `src/lib/validation.ts` | zod schemas, bilingual messages | `patientSchema`, `problemSchema`, `treatmentSchema`, `visitSchema`, `lifestyleSchema`, `docTypeSchema`, `firstError` |
```

Add a new data row after `src/data/visits.ts`:
```
| `src/data/lifestyle.ts` | one assessment per patient (upsert) | `getLifestyleAssessment`, `upsertLifestyleAssessment` |
```

Update the `src/actions/*` row to include lifestyle:
Find:
```
| `src/actions/*` (rest) | server actions per domain; all return `ActionResult` | `*Action` functions |
```
Replace with:
```
| `src/actions/*` (rest) | server actions per domain; all return `ActionResult` — includes lifestyle.ts | `*Action` functions |
```

Update the patients page row:
Find:
```
| `src/app/(app)/patients/*` | list/new/detail(tabs+progress)/edit/print pages | — |
```
Replace with:
```
| `src/app/(app)/patients/*` | list/new/detail(tabs+progress+assessment)/edit/print pages | — |
```

Update the Phase 2 roadmap line:
Find:
```
Phase 2: dashboard + charts ✅; lifestyle form, follow-ups (upcoming).
```
Replace with:
```
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups (upcoming).
```

- [ ] **Step 6: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript or Next.js errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/patients/[id]/page.tsx docs/architecture.md
git commit -m "feat: Assessment tab — 5-section lifestyle intake form"
```

---

## Self-review checklist (coordinator runs before handoff)

- [ ] Schema: `lifestyleAssessments` table has `patientId.unique()`, all columns nullable (except `id`, `patientId`, `updatedAt`, `createdAt`), `.enableRLS()` present
- [ ] Validation: `opt()` used for all non-boolean fields; booleans use `z.preprocess`; enum values match schema comments and select option values in UI
- [ ] Data: `upsertLifestyleAssessment` returns `Promise<void>`; uses `onConflictDoUpdate` targeting `lifestyleAssessments.patientId`
- [ ] Action: mirrors `saveTreatmentPlanAction` exactly (requireUser → safeParse → upsert → revalidatePath → return ok)
- [ ] Tests: `getLifestyleAssessment` returns `undefined` test; upsert insert test; upsert update test; partial-fields null test; action happy-path; action validation-failure
- [ ] UI: `['assessment', 'Assessment / मूल्यांकन']` in TABS; `{tab === 'assessment' && <Assessment patientId={id} />}` in content; `Assessment` function uses `InlineForm`; native `<select>` with `defaultValue`; `<input type="checkbox" value="true" defaultChecked={...}>` for booleans; `existing?.sleepQuality?.toString() ?? ''` for integer fields
- [ ] No `LifestyleForm.tsx` component created
- [ ] `docs/architecture.md` updated
