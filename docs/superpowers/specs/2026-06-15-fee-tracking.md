# Fee Tracking — Design Spec
Date: 2026-06-15

## Overview

Add fee tracking to the patient management app. Each patient has a course fee (the total amount charged for their treatment) and a history of payments against that fee. The patient detail page gains a "Fees" tab for entering/viewing this data. The print report gains a live Fee Summary section.

## Schema

Two new tables in `src/db/schema.ts`:

```typescript
export const fees = pgTable('fees', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  courseFee: numeric('course_fee', { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const feePayments = pgTable('fee_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export type FeeRow = typeof fees.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
```

Migration: `npm run db:generate` → `npm run db:migrate`.

## New Files

| Path | Responsibility |
|---|---|
| `src/data/fees.ts` | `getPatientFees`, `setCourseFee`, `addPayment`, `deletePayment` |
| `src/actions/fees.ts` | `setCourseFeeAction`, `addPaymentAction`, `deletePaymentAction` |

## Modified Files

| Path | Change |
|---|---|
| `src/db/schema.ts` | Add `fees` and `feePayments` tables |
| `src/lib/validation.ts` | Add `courseFeeSchema`, `paymentSchema` |
| `src/app/(app)/patients/[id]/page.tsx` | Add "Fees" tab; fetch `getPatientFees` |
| `src/app/(app)/patients/[id]/print/page.tsx` | Wire in Fee Summary section (import `getPatientFees`) |

## Data Layer — `src/data/fees.ts`

```typescript
export type PatientFees = {
  courseFee: number | null;  // null = no fee set yet
  payments: FeePayment[];
  totalPaid: number;
  balance: number | null;    // null if no course fee set
};

export async function getPatientFees(db: Db, patientId: string): Promise<PatientFees> { ... }
// Returns fee row + all payments in descending order by paymentDate (newest-first), computes totalPaid + balance

export async function setCourseFee(db: Db, patientId: string, courseFee: number): Promise<void> { ... }
// Upsert: insert if no fee row exists, update courseFee if it does

export async function addPayment(db: Db, patientId: string, amount: number, paymentDate: string, description: string | null): Promise<void> { ... }

export async function deletePayment(db: Db, id: string): Promise<void> { ... }
```

`totalPaid = sum of all payment amounts`. `balance = courseFee - totalPaid` (null if no courseFee set).

## Validation — `src/lib/validation.ts`

```typescript
export const courseFeeSchema = z.object({
  courseFee: z.coerce.number().positive('Fee must be positive / शुल्क सकारात्मक असणे आवश्यक आहे'),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive / रक्कम सकारात्मक असणे आवश्यक आहे'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / अवैध तारीख'),
  description: z.string().optional().transform(v => v?.trim() || undefined),
});
```

## Server Actions — `src/actions/fees.ts`

```typescript
export async function setCourseFeeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult>

export async function addPaymentAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult>

export async function deletePaymentAction(
  patientId: string,
  paymentId: string,
): Promise<ActionResult>
```

All follow the standard pattern: `requireUser()` → parse + validate → call data function → `revalidatePath`.

## UI — Fees Tab

New "Fees / शुल्क" tab added to the patient detail page tab list (after Visits, before Documents).

Tab content is a server component section that renders:

### Fee Summary Card

Three boxes side by side:
- **Total Fee / कोर्स शुल्क** — ₹[courseFee] or "Not set / सेट नाही"
- **Total Paid / भरलेले** — ₹[totalPaid]
- **Balance Due / बाकी** — ₹[balance] (orange text if > 0, green if 0)

### Set Course Fee Form

```html
<form>
  <label>Course Fee / कोर्स शुल्क (₹)</label>
  <input name="courseFee" type="number" step="0.01" min="0" />
  <button>Set Fee / शुल्क सेट करा</button>
</form>
```

Uses `InlineForm` pattern with `setCourseFeeAction`.

### Add Payment Form

```html
<form>
  <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount / रक्कम" />
  <input name="paymentDate" type="date" />
  <input name="description" placeholder="Note / टीप (optional)" />
  <button>Record Payment / पेमेंट नोंदवा</button>
</form>
```

Uses `InlineForm` pattern with `addPaymentAction`.

### Payment History List

Table showing payments, newest first:

| Date | Description | Amount | Delete |
|---|---|---|---|
| 03 Jun 2026 | First instalment | ₹1,500 | [×] |

Delete uses a `DeleteButton`-style confirmation before calling `deletePaymentAction`. No undo.

## Fee Summary in Print Report

In `src/app/(app)/patients/[id]/print/page.tsx`, add:

```typescript
import { getPatientFees } from '@/data/fees';
// ...
const patientFees = await getPatientFees(db, id);
```

Then render the Fee Summary section (before Visit History) only when `patientFees.courseFee !== null`:

```tsx
{patientFees.courseFee !== null && (
  <FeeSection fees={patientFees} />
)}
```

## Testing

### `tests/data/fees.test.ts` (PGlite)

- `setCourseFee` creates fee row; calling again updates it
- `addPayment` inserts; `getPatientFees` returns correct `totalPaid` and `balance`
- `deletePayment` removes the row; `totalPaid` recalculates
- `getPatientFees` returns `{ courseFee: null, payments: [], totalPaid: 0, balance: null }` for patient with no fee

### `tests/actions/fees.test.ts`

Mocks: db client, `requireUser`, `getPatientFees`, `setCourseFee`, `addPayment`, `deletePayment`, `revalidatePath`.

- `setCourseFeeAction`: valid input → calls `setCourseFee` → success; invalid (negative) → returns error
- `addPaymentAction`: valid → calls `addPayment` → success; missing amount → returns error
- `deletePaymentAction`: valid → calls `deletePayment` → success

## Invariants Preserved

- All DB access through `src/data/fees.ts`
- `requireUser()` called first in every action
- Cascade delete: removing a patient removes fees + payments (FK `onDelete: 'cascade'`)
- `balance` is always `courseFee - totalPaid`; never stored separately
