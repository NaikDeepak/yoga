# Fee Charges (Consultation / Monthly Yoga Fee) — Design Spec
Date: 2026-08-10

## Overview

Client feedback: the current fee model (one "Course Fee" total per patient + payments tracked against a running balance) doesn't fit two common cases:

1. A first-time patient paying a **Consultation Fee** — a standalone charge, not part of any package.
2. A patient on a recurring **Monthly Yoga Fee** — a fixed monthly charge, not tied to a package total either.

Both need a fast "pick fee type → amount → print receipt" flow, independent of the existing Course Fee/Balance tracking.

This spec adds a new **Charges** concept: standalone, typed, single-line charges with their own receipt. It does not change the existing `fees`/`feePayments` tables, actions, or receipt page — those keep working exactly as before for package-based patients.

## Schema

New table in `src/db/schema.ts`:

```typescript
export const charges = pgTable('charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  feeType: text('fee_type').notNull(), // 'consultation' | 'monthly_yoga' | 'package' | 'other'
  label: text('label').notNull(),      // resolved display label (preset text, or custom text when feeType='other')
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  chargeDate: date('charge_date').notNull(),
  note: text('note'),                  // optional extra note
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('charges_patient_history_idx').on(table.patientId, table.chargeDate, table.createdAt)
]).enableRLS();

export type Charge = typeof charges.$inferSelect;
```

Migration: `npm run db:generate` → `npm run db:migrate`.

## Fee Type Presets

Defined as a constant (e.g. `src/lib/feeTypes.ts`), used by both the form and receipt rendering:

| `feeType` | Label (EN / MR) | Default amount |
|---|---|---|
| `consultation` | Consultation Fee / सल्ला शुल्क | ₹500 |
| `monthly_yoga` | Monthly Yoga Fee / मासिक योग शुल्क | ₹3000 |
| `package` | Package Fee / पॅकेज शुल्क | — (no default) |
| `other` | Other / इतर | — (user types a custom `label`) |

Amount is always editable regardless of type (covers price changes without a code edit). "Monthly Yoga Fee" is a label applied each time a charge is added — there is no recurring/subscription logic, no due-month tracking. Staff add one charge per month manually, same as any other charge.

## New Files

| Path | Responsibility |
|---|---|
| `src/lib/feeTypes.ts` | `FEE_TYPES` constant (type, bilingual label, default amount) |
| `src/data/charges.ts` | `addCharge`, `listCharges`, `deleteCharge` |
| `src/actions/charges.ts` | `addChargeAction`, `deleteChargeAction` |
| `src/app/(app)/patients/[id]/charges/[chargeId]/receipt/page.tsx` | Single-charge receipt page |

## Modified Files

| Path | Change |
|---|---|
| `src/db/schema.ts` | Add `charges` table |
| `src/lib/validation.ts` | Add `chargeSchema` |
| `src/app/(app)/patients/[id]/page.tsx` | Add "Charges" block inside existing Fees tab |

## Data Layer — `src/data/charges.ts`

```typescript
export async function addCharge(
  db: Db,
  patientId: string,
  feeType: string,
  label: string,
  amount: number,
  chargeDate: string,
  note: string | null,
): Promise<Charge> { ... }

export async function listCharges(db: Db, patientId: string): Promise<Charge[]> { ... }
// Newest-first by chargeDate, createdAt

export async function getCharge(db: Db, patientId: string, id: string): Promise<Charge | null> { ... }
// Used by the single-charge receipt page

export async function deleteCharge(db: Db, patientId: string, id: string): Promise<void> { ... }
```

## Validation — `src/lib/validation.ts`

```typescript
export const chargeSchema = z.object({
  feeType: z.enum(['consultation', 'monthly_yoga', 'package', 'other']),
  label: z.string().trim().min(1, 'Label required / लेबल आवश्यक आहे'),
  amount: z.coerce.number().positive('Amount must be positive / रक्कम सकारात्मक असणे आवश्यक आहे'),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / अवैध तारीख'),
  note: z.string().optional().transform(v => v?.trim() || undefined),
});
```

`label` is set by the client from the preset text when `feeType !== 'other'`; when `feeType === 'other'`, the form's custom-label input is submitted as `label` directly. The schema always requires a non-empty `label` — this keeps validation simple (one required field) rather than branching required-ness on `feeType`.

## Server Actions — `src/actions/charges.ts`

```typescript
export async function addChargeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult>

export async function deleteChargeAction(
  patientId: string,
  chargeId: string,
): Promise<ActionResult>
```

Standard pattern: `requireUser()` → parse + validate with `chargeSchema` → call data function → `revalidatePath`.

## UI — Charges Block (inside existing Fees tab)

Added below the existing Course Fee/Balance/Payment History content — that content is unchanged.

### Add Charge Form

```html
<form>
  <select name="feeType">
    <option value="consultation">Consultation Fee / सल्ला शुल्क</option>
    <option value="monthly_yoga">Monthly Yoga Fee / मासिक योग शुल्क</option>
    <option value="package">Package Fee / पॅकेज शुल्क</option>
    <option value="other">Other / इतर</option>
  </select>
  <input name="customLabel" placeholder="Custom label / सानुकूल लेबल" /> <!-- shown only when feeType=other -->
  <input name="amount" type="number" step="0.01" min="0.01" /> <!-- prefilled from preset default on type change, always editable -->
  <input name="chargeDate" type="date" />
  <input name="note" placeholder="Note / टीप (optional)" />
  <button>Add Charge / शुल्क जोडा</button>
</form>
```

Client-side: selecting a `feeType` prefills `amount` with that type's default (if any) and toggles the `customLabel` input's visibility for `other`. Uses `InlineForm` pattern with `addChargeAction`.

### Charge History List

| Date | Type / Label | Amount | Receipt | Delete |
|---|---|---|---|---|
| 10 Aug 2026 | Consultation Fee | ₹500 | [Print] | [×] |
| 15 Aug 2026 | Monthly Yoga Fee | ₹3,000 | [Print] | [×] |

"Print" links to `/patients/[id]/charges/[chargeId]/receipt`. Delete uses the existing `DeleteButton`-style confirmation before calling `deleteChargeAction`. No undo.

## Single-Charge Receipt Page

**URL:** `/patients/[id]/charges/[chargeId]/receipt`

**Access:** Protected by middleware, same as `/patients/[id]/print` and `/patients/[id]/receipt` — no explicit `requireUser()` call needed in the page.

**Data fetched:**
```typescript
const patient = await getPatient(db, id);
const charge = await getCharge(db, id, chargeId);
```

If the charge doesn't exist (or belongs to a different patient), 404.

### Page Layout

Same brand pattern as the existing receipt page (`#1B3A2E` dark green letterhead):

1. **Letterhead** — identical to existing receipt/print pages. Right badge: `DOCUMENT / Receipt / [date] / Ref: [patientCode]`
2. **Patient Section** — Full Name | Patient Code, Branch (if set) | Mobile
3. **Charge** — section header bar `CHARGE`:
   ```
   [Label]                          ₹[amount]
   Date: [chargeDate]
   [Note, if present]
   ```
4. **Footer** — same signature block as existing receipt page

### Print button

Same `PrintButton` component, hidden on print via `print:hidden`.

## Link from Charge History Row

Each row's "Print" is a plain link (`<Link href={...}>`), not a button — no extra wiring needed beyond the route existing.

## Testing

### `tests/data/charges.test.ts` (PGlite)

- `addCharge` inserts a row and returns it
- `listCharges` returns charges newest-first for a patient
- `deleteCharge` removes the row
- Cascade delete: removing a patient removes its charges (FK `onDelete: 'cascade'`)

### `tests/actions/charges.test.ts`

Mocks: db client, `requireUser`, `addCharge`, `deleteCharge`, `revalidatePath`.

- `addChargeAction`: valid input → calls `addCharge` → success
- `addChargeAction`: missing amount → returns error
- `addChargeAction`: `feeType='other'` with empty label → returns error
- `deleteChargeAction`: valid → calls `deleteCharge` → success

### Receipt page

No automated test (print/UI page; covered by manual QA, consistent with the existing receipt page).

**Manual QA checklist:**
- Add Charge form: selecting each fee type prefills the right default amount; amount stays editable
- Selecting "Other" shows the custom label input; submitting without a label errors
- Charge appears in Charge History, newest-first
- "Print" opens the single-charge receipt with correct patient/charge data
- Delete removes the charge with confirmation, no undo
- Existing Course Fee/Balance block and its receipt page are unaffected

## Invariants Preserved

- All DB access through `src/data/charges.ts`
- `requireUser()` called first in every action
- Cascade delete: removing a patient removes its charges (FK `onDelete: 'cascade'`)
- `charges` is fully independent of `fees`/`feePayments` — no shared totals, no balance interaction
- Existing Course Fee/Balance/Payment History UI and receipt page are unmodified
