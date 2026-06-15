# Patient Report, Fee Tracking & Receipt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded PYTC patient report, fee tracking with payment history, and a printable receipt page to the patient management app.

**Architecture:** Schema changes first (branch + fees tables), then data layer, then UI in four layers: branch field in PatientForm, complete print page redesign (with fee section already wired in), fee management tab on patient detail page, and receipt page.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PGlite (integration tests), shadcn/ui, TailwindCSS, vitest.

---

## File Map

### Created
| File | Purpose |
|---|---|
| `src/data/fees.ts` | `getPatientFees`, `setCourseFee`, `addPayment`, `deletePayment` |
| `src/actions/fees.ts` | `setCourseFeeAction`, `addPaymentAction`, `deletePaymentAction` |
| `src/app/(app)/patients/[id]/receipt/page.tsx` | Printable receipt page |
| `tests/data/fees.test.ts` | PGlite integration tests for fees data layer |
| `tests/actions/fees.test.ts` | Action tests using action-mocks pattern |

### Modified
| File | Change |
|---|---|
| `src/db/schema.ts` | Add `branch` to patients; add `fees`, `feePayments` tables + types |
| `src/lib/presets.ts` | Add `BRANCHES` constant |
| `src/lib/validation.ts` | Add `branch` to `patientSchema`; add `courseFeeSchema`, `paymentSchema` |
| `src/components/PatientForm.tsx` | Add Branch `<Select>` after Address field |
| `src/app/(app)/patients/[id]/print/page.tsx` | Full visual redesign with fee section |
| `src/app/(app)/patients/[id]/page.tsx` | Add Fees tab + receipt button |

---

### Task 1: Schema, presets, validation, migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/presets.ts`
- Modify: `src/lib/validation.ts`

- [ ] **Step 1: Add BRANCHES to presets**

Open `src/lib/presets.ts` and append:

```typescript
export const BRANCHES = [
  {
    key: 'Manjari BK',
    label: 'Manjari BK',
    fullAddress: 'Shop No 8, Greenoak Society, Cement Road, near Mhasoba Mandir, Manjari Budruk, Pune, Maharashtra 412307',
  },
  {
    key: 'Kharadi',
    label: 'Kharadi',
    fullAddress: 'Survey no. 24/2B, Opposite of Konark Eureka, Sainath Nagar, Kharadi, Pune, Maharashtra 411014',
  },
  {
    key: 'Morgaon',
    label: 'Morgaon',
    fullAddress: 'Morgaon Pawarwadi, Tal-Dodamarg, Sindhudurg - 416511',
  },
] as const;

export type BranchKey = typeof BRANCHES[number]['key'];
```

- [ ] **Step 2: Add branch column + fee tables to schema**

In `src/db/schema.ts`:

Add `branch: text('branch'),` to the `patients` table (before the closing `}`).

Add these two new tables and types after the `lifestyleAssessments` table:

```typescript
export const fees = pgTable('fees', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  courseFee: real('course_fee').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const feePayments = pgTable('fee_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  paymentDate: date('payment_date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export type FeeRow = typeof fees.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
```

- [ ] **Step 3: Add branch + fee schemas to validation**

In `src/lib/validation.ts`, add `branch` to `patientSchema` (after `emergencyContact`):

```typescript
  branch: opt(z.string().trim().max(50)),
```

Append these two new schemas after the `lifestyleSchema`:

```typescript
export const courseFeeSchema = z.object({
  courseFee: z.coerce.number().positive('Fee must be positive / शुल्क सकारात्मक असणे आवश्यक आहे'),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive / रक्कम सकारात्मक असणे आवश्यक आहे'),
  paymentDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / अवैध तारीख')
    .refine(isCalendarValid, 'Invalid date / चुकीची तारीख'),
  description: opt(z.string().trim().max(200)),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
```

- [ ] **Step 4: Generate and run migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: new migration file in `drizzle/`, migration applied successfully.

- [ ] **Step 5: Confirm existing tests still pass**

```bash
npm test
```

Expected: all tests pass (adding optional column + new tables is backwards-compatible).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/lib/presets.ts src/lib/validation.ts drizzle/
git commit -m "feat: add branch field, fees and fee_payments schema, BRANCHES preset"
```

---

### Task 2: Fees data layer + PGlite tests

**Files:**
- Create: `src/data/fees.ts`
- Create: `tests/data/fees.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/data/fees.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getPatientFees, setCourseFee, addPayment, deletePayment } from '@/data/fees';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const PATIENT = { fullName: 'Asha Pawar', mobile: '9876543210' };

describe('getPatientFees', () => {
  it('returns null fee and empty payments for new patient', async () => {
    const p = await createPatient(db, PATIENT);
    const result = await getPatientFees(db, p.id);
    expect(result).toEqual({ courseFee: null, payments: [], totalPaid: 0, balance: null });
  });
});

describe('setCourseFee', () => {
  it('creates a fee row', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    const result = await getPatientFees(db, p.id);
    expect(result.courseFee).toBe(2000);
    expect(result.balance).toBe(2000);
    expect(result.totalPaid).toBe(0);
  });

  it('updates existing fee row on second call', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await setCourseFee(db, p.id, 3000);
    const result = await getPatientFees(db, p.id);
    expect(result.courseFee).toBe(3000);
  });
});

describe('addPayment + getPatientFees', () => {
  it('computes totalPaid and balance from payments', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await addPayment(db, p.id, 1500, '2026-06-03', 'First instalment');
    const result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(1500);
    expect(result.balance).toBe(500);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].description).toBe('First instalment');
  });

  it('accepts null description', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 1000);
    await addPayment(db, p.id, 1000, '2026-06-10', null);
    const result = await getPatientFees(db, p.id);
    expect(result.payments[0].description).toBeNull();
    expect(result.balance).toBe(0);
  });
});

describe('deletePayment', () => {
  it('removes the payment and balance recalculates', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await addPayment(db, p.id, 1500, '2026-06-03', null);
    let result = await getPatientFees(db, p.id);
    await deletePayment(db, result.payments[0].id);
    result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(2000);
    expect(result.payments).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npm test tests/data/fees.test.ts
```

Expected: FAIL — `Cannot find module '@/data/fees'`

- [ ] **Step 3: Implement `src/data/fees.ts`**

```typescript
import { eq } from 'drizzle-orm';
import type { Db } from '@/db/types';
import { fees, feePayments, type FeePayment } from '@/db/schema';

export type PatientFees = {
  courseFee: number | null;
  payments: FeePayment[];
  totalPaid: number;
  balance: number | null;
};

export async function getPatientFees(db: Db, patientId: string): Promise<PatientFees> {
  const [feeRow] = await db.select().from(fees).where(eq(fees.patientId, patientId));
  const payments = await db
    .select()
    .from(feePayments)
    .where(eq(feePayments.patientId, patientId))
    .orderBy(feePayments.paymentDate);
  const courseFee = feeRow?.courseFee ?? null;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    courseFee,
    payments,
    totalPaid,
    balance: courseFee !== null ? courseFee - totalPaid : null,
  };
}

export async function setCourseFee(db: Db, patientId: string, courseFee: number): Promise<void> {
  await db
    .insert(fees)
    .values({ patientId, courseFee })
    .onConflictDoUpdate({
      target: fees.patientId,
      set: { courseFee, updatedAt: new Date() },
    });
}

export async function addPayment(
  db: Db,
  patientId: string,
  amount: number,
  paymentDate: string,
  description: string | null,
): Promise<void> {
  await db.insert(feePayments).values({ patientId, amount, paymentDate, description });
}

export async function deletePayment(db: Db, id: string): Promise<void> {
  await db.delete(feePayments).where(eq(feePayments.id, id));
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test tests/data/fees.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run coverage — confirm gate holds**

```bash
npm run coverage
```

Expected: still above 80% on all metrics.

- [ ] **Step 6: Commit**

```bash
git add src/data/fees.ts tests/data/fees.test.ts
git commit -m "feat: add fees data layer with getPatientFees, setCourseFee, addPayment, deletePayment"
```

---

### Task 3: Branch select in PatientForm

**Files:**
- Modify: `src/components/PatientForm.tsx`

- [ ] **Step 1: Add Branch Select after Address**

In `src/components/PatientForm.tsx`, add this import at the top if not already present (Select components are already imported):

```typescript
import { BRANCHES } from '@/lib/presets';
```

In the Contact section, after the `<div className="space-y-2">` block for Address (the `<Textarea>` with `name="address"`), add:

```tsx
        <div className="space-y-2">
          <Label htmlFor="branch">Branch / शाखा</Label>
          <Select name="branch" defaultValue={defaultValues?.branch ?? '__none__'}>
            <SelectTrigger id="branch">
              <SelectValue placeholder="Select branch / शाखा निवडा" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Select / निवडा —</SelectItem>
              {BRANCHES.map((b) => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
```

Also add this line in the `onSubmit` handler alongside the existing gender `__none__` reset (after line 40):

```typescript
      if (formData.get('branch') === '__none__') formData.set('branch', '');
```

- [ ] **Step 2: Run existing tests**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/PatientForm.tsx
git commit -m "feat: add branch select to PatientForm"
```

---

### Task 4: Patient Report — full visual redesign

**Files:**
- Modify: `src/app/(app)/patients/[id]/print/page.tsx`

- [ ] **Step 1: Replace the entire file**

Replace `src/app/(app)/patients/[id]/print/page.tsx` with the following:

```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { computeBmi } from '@/lib/bmi';
import { BRANCHES } from '@/lib/presets';
import { PrintButton } from '@/components/PrintButton';

const CLINIC = { phone: '+91 85509 21037', email: 'pawarsyog@gmail.com', location: 'Pune, Maharashtra' };
const GREEN = '#1B3A2E';

const GENDER_MARATHI: Record<string, string> = { male: 'पुरुष', female: 'स्त्री', other: 'इतर' };

const MODALITY_KEYS = [
  ['yogaProgram', 'Yoga Program'],
  ['pranayam', 'Pranayam'],
  ['massage', 'Massage'],
  ['yogaTherapy', 'Yoga Therapy'],
  ['panchkarma', 'Panchkarma'],
] as const;

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const [problems, plan, visits, patientFees] = await Promise.all([
    listProblems(db, id),
    getTreatmentPlan(db, id),
    listVisits(db, id),
    getPatientFees(db, id),
  ]);

  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const today = formatDate();
  const latestNote = visits[0]?.progressNote ?? null;
  const modalities = plan
    ? MODALITY_KEYS.filter(([key]) => Boolean(plan[key as keyof typeof plan])).map(([, label]) => label)
    : [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ── LETTERHEAD ── */}
      <header className="mb-6 flex overflow-hidden rounded border border-gray-200">
        <div className="flex flex-1 items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pytc-logo.png" alt="PYTC" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Pawar&apos;s Yog Therapy Center</h1>
            <p className="text-xs font-semibold tracking-widest" style={{ color: '#2D6A4F' }}>
              HEALING THROUGH NATURE &amp; TRADITION
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
              <span>📍 {CLINIC.location}</span>
              <span>📞 {CLINIC.phone}</span>
              <span>✉ {CLINIC.email}</span>
            </p>
          </div>
        </div>
        <div
          className="flex w-44 shrink-0 flex-col items-center justify-center p-4 text-white"
          style={{ backgroundColor: GREEN }}
        >
          <p className="text-xs tracking-widest opacity-75">DOCUMENT</p>
          <p className="text-lg font-bold leading-tight">Patient Report</p>
          <p className="mt-1 text-xs opacity-75">{today}</p>
          <p className="text-xs opacity-75">Ref: {patient.patientCode}</p>
        </div>
      </header>

      {/* ── PATIENT IDENTIFICATION ── */}
      <SectionHeader>PATIENT IDENTIFICATION</SectionHeader>
      <div className="mb-6 flex items-center gap-4 rounded border border-gray-100 bg-gray-50 p-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: GREEN }}
        >
          {nameInitials(patient.fullName)}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{patient.fullName}</p>
          <p className="text-sm text-gray-600">
            {patient.gender ? GENDER_MARATHI[patient.gender] : ''}
            {patient.age ? ` | Age: ${patient.age} yrs` : ''}
            {` | ${patient.mobile}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>{patient.patientCode}</Chip>
            {branch && <Chip>{branch.label}</Chip>}
          </div>
        </div>
      </div>

      {/* ── PERSONAL INFORMATION ── */}
      <SectionHeader>PERSONAL INFORMATION</SectionHeader>
      <div className="mb-6">
        <InfoTable>
          <InfoRow2
            label1="Full Name" value1={patient.fullName}
            label2="Gender" value2={patient.gender ? GENDER_MARATHI[patient.gender] : '—'}
          />
          <InfoRow2
            label1="Age" value1={patient.age ? `${patient.age} years` : '—'}
            label2="Mobile" value2={patient.mobile}
          />
          <InfoRow2
            label1="Email" value1={patient.email ?? '—'}
            label2="Occupation" value2={patient.occupation ?? '—'}
          />
          <InfoRow1 label="Address" value={patient.address ?? '—'} />
          {branch && <InfoRow1 label="Branch" value={branch.label} />}
        </InfoTable>
      </div>

      {/* ── PHYSICAL MEASUREMENTS ── */}
      {(patient.weightKg !== null || patient.heightCm !== null) && (
        <>
          <SectionHeader>PHYSICAL MEASUREMENTS</SectionHeader>
          <div className="mb-6">
            <InfoTable>
              <InfoRow2
                label1="Weight" value1={patient.weightKg !== null ? `${patient.weightKg.toFixed(2)} kg` : '—'}
                label2="Height" value2={patient.heightCm !== null ? `${patient.heightCm.toFixed(2)} cm` : '—'}
              />
              {bmi !== null && <InfoRow1 label="BMI" value={bmi.toFixed(1)} />}
            </InfoTable>
          </div>
        </>
      )}

      {/* ── HEALTH CONDITIONS ── */}
      {problems.length > 0 && (
        <>
          <SectionHeader>HEALTH CONDITIONS</SectionHeader>
          <div className="mb-6 flex flex-wrap gap-2 py-2">
            {problems.map((p) => <Chip key={p.id}>{p.problem}</Chip>)}
          </div>
        </>
      )}

      {/* ── TREATMENT PLAN ── */}
      {(plan || latestNote) && (
        <>
          <SectionHeader>TREATMENT PLAN</SectionHeader>
          <div className="mb-6">
            <table className="w-full text-sm">
              <tbody>
                {modalities.length > 0 && (
                  <tr className="border-b border-gray-100 align-top">
                    <td className="w-36 py-2 font-medium text-gray-700">Modalities</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {modalities.map((m) => <Chip key={m}>{m}</Chip>)}
                      </div>
                    </td>
                  </tr>
                )}
                {plan?.yogaProgram && <PlanRow label="Yoga Program" value={plan.yogaProgram} />}
                {plan?.pranayam && <PlanRow label="Pranayam" value={plan.pranayam} />}
                {plan?.massage && <PlanRow label="Massage" value={plan.massage} />}
                {plan?.yogaTherapy && <PlanRow label="Yoga Therapy" value={plan.yogaTherapy} />}
                {plan?.dietPlan && <PlanRow label="Diet Plan" value={plan.dietPlan} />}
                {plan?.medicines && <PlanRow label="Medicines" value={plan.medicines} />}
                {plan?.panchkarma && <PlanRow label="Panchkarma" value={plan.panchkarma} />}
                {latestNote && <PlanRow label="Progress Notes" value={latestNote} />}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── FEE SUMMARY ── */}
      {patientFees.courseFee !== null && (
        <>
          <SectionHeader>FEE SUMMARY</SectionHeader>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <FeeBox label="TOTAL FEE" amount={patientFees.courseFee} variant="neutral" />
            <FeeBox label="AMOUNT PAID" amount={patientFees.totalPaid} variant="green" />
            <FeeBox
              label="BALANCE DUE"
              amount={patientFees.balance ?? 0}
              variant={(patientFees.balance ?? 0) > 0 ? 'orange' : 'green'}
            />
          </div>
        </>
      )}

      {/* ── VISIT HISTORY ── */}
      <SectionHeader>VISIT HISTORY</SectionHeader>
      <div className="mb-8">
        {visits.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No visit records found / भेटींची नोंद नाही
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: GREEN, color: 'white' }}>
                {['NO.', 'VISIT DATE', 'WEIGHT', 'PAIN LEVEL', 'SESSION NOTES'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => (
                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border-b border-gray-100 px-3 py-2">{i + 1}</td>
                  <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">{v.visitDate}</td>
                  <td className="border-b border-gray-100 px-3 py-2">{v.weightKg != null ? `${v.weightKg} kg` : '—'}</td>
                  <td className="border-b border-gray-100 px-3 py-2">{v.painScale != null ? `${v.painScale}/10` : '—'}</td>
                  <td className="border-b border-gray-100 px-3 py-2 whitespace-pre-wrap">{v.progressNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FOOTER ── */}
      <hr className="border-gray-200" />
      <div className="mt-8 flex justify-end">
        <div className="w-52 border-t-2 border-gray-400 pt-2 text-right">
          <p className="text-sm font-bold">Aacharya Narayan Pawar</p>
          <p className="text-xs text-gray-600">Founder of PYTC &amp; Lead Instructor</p>
          <p className="text-xs italic text-gray-500">Pawar&apos;s Yog Therapy Center, Pune</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        This is an official patient record issued by Pawar&apos;s Yog Therapy Center.
        Confidential — intended solely for the patient and treating practitioner. | Generated on {today}
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3 inline-block rounded px-3 py-1 text-xs font-bold tracking-widest text-white"
      style={{ backgroundColor: '#1B3A2E' }}
    >
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: '#1B3A2E', color: '#1B3A2E', backgroundColor: '#E8F5E9' }}
    >
      {children}
    </span>
  );
}

function InfoTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-sm"><tbody>{children}</tbody></table>;
}

function InfoRow2({
  label1, value1, label2, value2,
}: { label1: string; value1: string; label2: string; value2: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-28 py-2 font-medium text-gray-700">{label1}</td>
      <td className="py-2 pr-6">{value1}</td>
      <td className="w-28 py-2 font-medium text-gray-700">{label2}</td>
      <td className="py-2">{value2}</td>
    </tr>
  );
}

function InfoRow1({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-28 py-2 font-medium text-gray-700">{label}</td>
      <td className="py-2" colSpan={3}>{value}</td>
    </tr>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="w-36 py-2 font-medium text-gray-700">{label}</td>
      <td className="py-2 whitespace-pre-wrap">{value}</td>
    </tr>
  );
}

function FeeBox({
  label, amount, variant,
}: { label: string; amount: number; variant: 'neutral' | 'green' | 'orange' }) {
  const bg = { neutral: '#F9FAFB', green: '#E8F5E9', orange: '#FFF3E0' }[variant];
  const color = { neutral: '#374151', green: '#1B3A2E', orange: '#C2410C' }[variant];
  return (
    <div className="rounded p-4 text-center" style={{ backgroundColor: bg }}>
      <p className="text-2xl font-bold" style={{ color }}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-xs tracking-widest text-gray-500">{label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual QA**

```bash
npm run dev
```

Navigate to any patient's print page: `http://localhost:3000/patients/[id]/print`

Check:
- Letterhead renders with PYTC logo, clinic name, green badge with today's date
- Patient identification card shows initials avatar, name, mobile, patient code badge
- Personal Information grid shows 2-column layout
- Health Conditions shows ailment badges
- Treatment Plan shows only non-empty fields
- Visit History table has dark green header row
- Signature block and footer confidentiality text at bottom
- Print button triggers browser print dialog
- Page looks correct in print preview

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/patients/\[id\]/print/page.tsx
git commit -m "feat: redesign patient report with PYTC branding and fee section"
```

---

### Task 5: Fee server actions + tests

**Files:**
- Create: `src/actions/fees.ts`
- Create: `tests/actions/fees.test.ts`

- [ ] **Step 1: Write failing action tests**

Create `tests/actions/fees.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { createPatient } from '@/data/patients';
import { getPatientFees } from '@/data/fees';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const prev = { ok: false as const, error: '' };

describe('setCourseFeeAction', () => {
  it('creates course fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    expect(r).toEqual({ ok: true });
    expect((await getPatientFees(db, p.id)).courseFee).toBe(2000);
  });

  it('updates existing fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '3000' }));
    expect((await getPatientFees(db, p.id)).courseFee).toBe(3000);
  });

  it('returns error for negative fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({ courseFee: '-500' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for missing fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({}));
    expect(r).toMatchObject({ ok: false });
  });
});

describe('addPaymentAction', () => {
  it('records payment and updates balance', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    const r = await addPaymentAction(p.id, prev, fd({ amount: '1500', paymentDate: '2026-06-15', description: 'First' }));
    expect(r).toEqual({ ok: true });
    const fees = await getPatientFees(db, p.id);
    expect(fees.totalPaid).toBe(1500);
    expect(fees.balance).toBe(500);
  });

  it('returns error for missing amount', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addPaymentAction(p.id, prev, fd({ paymentDate: '2026-06-15' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for invalid date', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addPaymentAction(p.id, prev, fd({ amount: '500', paymentDate: 'not-a-date' }));
    expect(r).toMatchObject({ ok: false });
  });
});

describe('deletePaymentAction', () => {
  it('removes the payment', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    await addPaymentAction(p.id, prev, fd({ amount: '500', paymentDate: '2026-06-15' }));
    const { payments } = await getPatientFees(db, p.id);
    const r = await deletePaymentAction(p.id, payments[0].id);
    expect(r).toEqual({ ok: true });
    expect((await getPatientFees(db, p.id)).totalPaid).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test tests/actions/fees.test.ts
```

Expected: FAIL — `Cannot find module '@/actions/fees'`

- [ ] **Step 3: Implement `src/actions/fees.ts`**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { courseFeeSchema, paymentSchema, firstError } from '@/lib/validation';
import { setCourseFee, addPayment, deletePayment } from '@/data/fees';
import type { ActionResult } from '@/actions/patients';

export async function setCourseFeeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = courseFeeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const db = getDb();
  await setCourseFee(db, patientId, result.data.courseFee);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function addPaymentAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const { amount, paymentDate, description } = result.data;
  const db = getDb();
  await addPayment(db, patientId, amount, paymentDate, description ?? null);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deletePaymentAction(patientId: string, paymentId: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  await deletePayment(db, paymentId);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test tests/actions/fees.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Run full test suite + coverage**

```bash
npm run coverage
```

Expected: all tests pass, coverage gate holds.

- [ ] **Step 6: Commit**

```bash
git add src/actions/fees.ts tests/actions/fees.test.ts
git commit -m "feat: add fee server actions setCourseFeeAction, addPaymentAction, deletePaymentAction"
```

---

### Task 6: Fees tab + receipt button on patient detail page

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/(app)/patients/[id]/page.tsx`, add these imports (alongside existing ones):

```typescript
import { Receipt } from 'lucide-react';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
```

- [ ] **Step 2: Add 'fees' to TABS constant**

Find the `TABS` constant (currently 6 entries). Add the fees tab as the 5th entry (before `assessment`):

```typescript
const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
  ['progress', 'Progress / प्रगती'],
  ['fees', 'Fees / शुल्क'],
  ['assessment', 'Assessment / मूल्यांकन'],
] as const;
```

- [ ] **Step 3: Fetch fees in PatientPage and add receipt button**

In the `PatientPage` function, after the `photoUrl` line, add:

```typescript
  const patientFees = await getPatientFees(db, id);
```

In the button group (where Edit and PDF/Print buttons are), add the receipt button after the PDF button:

```tsx
          {patientFees.courseFee !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${id}/receipt`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Receipt / पावती
              </Link>
            </Button>
          )}
```

- [ ] **Step 4: Add fees tab content dispatch**

In the tab content block (after `{tab === 'progress' && <Progress patientId={id} />}`), add:

```tsx
      {tab === 'fees' && <Fees patientId={id} patientFees={patientFees} />}
```

- [ ] **Step 5: Define the Fees component**

Add this function at the bottom of the file (alongside other tab component functions like `Overview`, `Assessment` etc.):

```tsx
function Fees({ patientId, patientFees }: { patientId: string; patientFees: PatientFees }) {
  const boundSetFee = setCourseFeeAction.bind(null, patientId, { ok: false, error: '' });
  const boundAddPayment = addPaymentAction.bind(null, patientId, { ok: false, error: '' });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {patientFees.courseFee !== null ? `₹${patientFees.courseFee.toLocaleString('en-IN')}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Course Fee / कोर्स शुल्क</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">₹{patientFees.totalPaid.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total Paid / भरलेले</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className={`text-2xl font-bold ${(patientFees.balance ?? 0) > 0 ? 'text-destructive' : 'text-primary'}`}>
              {patientFees.balance !== null ? `₹${patientFees.balance.toLocaleString('en-IN')}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Balance Due / बाकी</p>
          </CardContent>
        </Card>
      </div>

      {/* Set course fee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course Fee / कोर्स शुल्क</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineForm action={boundSetFee}>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="courseFee">Total Course Fee (₹)</Label>
                <Input
                  id="courseFee"
                  name="courseFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={patientFees.courseFee ?? ''}
                  placeholder="e.g. 2000"
                />
              </div>
              <Button type="submit" size="sm">Set / सेट करा</Button>
            </div>
          </InlineForm>
        </CardContent>
      </Card>

      {/* Add payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record Payment / पेमेंट नोंदवा</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineForm action={boundAddPayment}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="amount">Amount (₹) / रक्कम</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paymentDate">Date / तारीख</Label>
                <Input id="paymentDate" name="paymentDate" type="date" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Note / टीप</Label>
                <Input id="description" name="description" placeholder="e.g. First instalment" />
              </div>
            </div>
            <Button type="submit" size="sm" className="mt-3">Add / जोडा</Button>
          </InlineForm>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History / देयके इतिहास</CardTitle>
        </CardHeader>
        <CardContent>
          {patientFees.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded / पेमेंट नोंद नाही</p>
          ) : (
            <ul className="space-y-2">
              {patientFees.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium">₹{p.amount.toLocaleString('en-IN')}</span>
                    <span className="ml-3 text-muted-foreground">{p.paymentDate}</span>
                    {p.description && <span className="ml-2 text-muted-foreground">— {p.description}</span>}
                  </div>
                  <DeleteButton
                    action={deletePaymentAction.bind(null, patientId, p.id)}
                    confirmText={`Delete payment of ₹${p.amount}? / ₹${p.amount} पेमेंट हटवायचे?`}
                    label="×"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + run tests**

```bash
npm run typecheck && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 7: Manual QA**

```bash
npm run dev
```

Navigate to any patient's detail page:
- "Fees / शुल्क" tab appears in the tab bar
- Clicking it shows 3 summary cards, set-fee form, add-payment form, payment history
- Set a course fee → summary updates
- Add a payment → appears in history, balance updates
- Delete a payment → removed from list, balance recalculates
- "Receipt / पावती" button appears in header only after a course fee is set
- Patient report at `/patients/[id]/print` shows Fee Summary section once fees are set

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/patients/\[id\]/page.tsx
git commit -m "feat: add Fees tab and receipt button to patient detail page"
```

---

### Task 7: Receipt page

**Files:**
- Create: `src/app/(app)/patients/[id]/receipt/page.tsx`

- [ ] **Step 1: Create the receipt page**

Create `src/app/(app)/patients/[id]/receipt/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPatientFees } from '@/data/fees';
import { BRANCHES } from '@/lib/presets';
import { PrintButton } from '@/components/PrintButton';

const CLINIC = { phone: '+91 85509 21037', email: 'pawarsyog@gmail.com', location: 'Pune, Maharashtra' };
const GREEN = '#1B3A2E';

function formatDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const patientFees = await getPatientFees(db, id);
  if (patientFees.courseFee === null) redirect(`/patients/${id}`);

  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const today = formatDate();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ── LETTERHEAD ── */}
      <header className="mb-6 flex overflow-hidden rounded border border-gray-200">
        <div className="flex flex-1 items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pytc-logo.png" alt="PYTC" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Pawar&apos;s Yog Therapy Center</h1>
            <p className="text-xs font-semibold tracking-widest" style={{ color: '#2D6A4F' }}>
              HEALING THROUGH NATURE &amp; TRADITION
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
              <span>📍 {CLINIC.location}</span>
              <span>📞 {CLINIC.phone}</span>
              <span>✉ {CLINIC.email}</span>
            </p>
          </div>
        </div>
        <div
          className="flex w-44 shrink-0 flex-col items-center justify-center p-4 text-white"
          style={{ backgroundColor: GREEN }}
        >
          <p className="text-xs tracking-widest opacity-75">DOCUMENT</p>
          <p className="text-lg font-bold leading-tight">Receipt</p>
          <p className="mt-1 text-xs opacity-75">{today}</p>
          <p className="text-xs opacity-75">Ref: {patient.patientCode}</p>
        </div>
      </header>

      {/* ── PATIENT ── */}
      <SectionHeader>PATIENT</SectionHeader>
      <div className="mb-6">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="w-28 py-2 font-medium text-gray-700">Full Name</td>
              <td className="py-2 pr-6">{patient.fullName}</td>
              <td className="w-28 py-2 font-medium text-gray-700">Patient Code</td>
              <td className="py-2">{patient.patientCode}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="w-28 py-2 font-medium text-gray-700">Branch</td>
              <td className="py-2 pr-6">{branch?.label ?? '—'}</td>
              <td className="w-28 py-2 font-medium text-gray-700">Mobile</td>
              <td className="py-2">{patient.mobile}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FEE SUMMARY ── */}
      <SectionHeader>FEE SUMMARY</SectionHeader>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <FeeBox label="TOTAL FEE" amount={patientFees.courseFee} variant="neutral" />
        <FeeBox label="TOTAL PAID" amount={patientFees.totalPaid} variant="green" />
        <FeeBox
          label="BALANCE DUE"
          amount={patientFees.balance ?? 0}
          variant={(patientFees.balance ?? 0) > 0 ? 'orange' : 'green'}
        />
      </div>

      {/* ── PAYMENT HISTORY ── */}
      <SectionHeader>PAYMENT HISTORY</SectionHeader>
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: GREEN, color: 'white' }}>
              {['NO.', 'DATE', 'DESCRIPTION', 'AMOUNT (₹)'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patientFees.payments.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border-b border-gray-100 px-3 py-2">{i + 1}</td>
                <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">{p.paymentDate}</td>
                <td className="border-b border-gray-100 px-3 py-2">{p.description ?? '—'}</td>
                <td className="border-b border-gray-100 px-3 py-2 font-medium">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td colSpan={3} className="px-3 py-2 text-right">TOTAL PAID</td>
              <td className="px-3 py-2" style={{ color: GREEN }}>{formatCurrency(patientFees.totalPaid)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FOOTER ── */}
      <hr className="border-gray-200" />
      <div className="mt-8 flex justify-end">
        <div className="w-52 border-t-2 border-gray-400 pt-2 text-right">
          <p className="text-sm font-bold">Aacharya Narayan Pawar</p>
          <p className="text-xs text-gray-600">Founder of PYTC &amp; Lead Instructor</p>
          <p className="text-xs italic text-gray-500">Pawar&apos;s Yog Therapy Center, Pune</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        This is an official receipt issued by Pawar&apos;s Yog Therapy Center. | Generated on {today}
      </p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3 inline-block rounded px-3 py-1 text-xs font-bold tracking-widest text-white"
      style={{ backgroundColor: '#1B3A2E' }}
    >
      {children}
    </div>
  );
}

function FeeBox({
  label, amount, variant,
}: { label: string; amount: number; variant: 'neutral' | 'green' | 'orange' }) {
  const bg = { neutral: '#F9FAFB', green: '#E8F5E9', orange: '#FFF3E0' }[variant];
  const color = { neutral: '#374151', green: '#1B3A2E', orange: '#C2410C' }[variant];
  return (
    <div className="rounded p-4 text-center" style={{ backgroundColor: bg }}>
      <p className="text-2xl font-bold" style={{ color }}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-xs tracking-widest text-gray-500">{label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual QA**

With the dev server running and a patient that has a course fee set:

- Navigate to `http://localhost:3000/patients/[id]/receipt`
- Verify: same letterhead as patient report, document badge says "Receipt"
- Patient section shows name, code, branch, mobile
- Fee Summary shows 3 coloured boxes
- Payment History table lists all payments in date order with running total row
- Print button triggers browser print dialog; receipt looks clean in print preview
- Navigate to receipt for a patient with NO fees set → should redirect to `/patients/[id]`

- [ ] **Step 4: Final build check**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/patients/\[id\]/receipt/
git commit -m "feat: add receipt page for fee payment history"
```
