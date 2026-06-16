# Receipt Generation — Design Spec
Date: 2026-06-15

## Overview

Add a printable receipt page at `/patients/[id]/receipt`. The receipt uses the same PYTC letterhead as the patient report but is focused on fee/payment information — suitable for patients submitting to employers or insurance. Built on the fee data introduced in Spec B.

## New Files

| Path | Responsibility |
|---|---|
| `src/app/(app)/patients/[id]/receipt/page.tsx` | Server-rendered receipt page |

## No Schema Changes

Uses existing `fees` and `feePayments` tables from Spec B. No new tables or actions needed.

## Modified Files

| Path | Change |
|---|---|
| `src/app/(app)/patients/[id]/page.tsx` | Add "Print Receipt / पावती" button in page header (only shown when a course fee exists) |

## Receipt Page

**URL:** `/patients/[id]/receipt`

**Access:** Protected by middleware (same as `/patients/[id]/print` — no explicit `requireUser()` call needed in the page). If no fee data exists, redirect to `/patients/[id]`.

**Data fetched:**
```typescript
const patient = await getPatient(db, id);         // name, code, branch, address, age, gender, mobile
const patientFees = await getPatientFees(db, id);  // courseFee, payments[], totalPaid, balance
```

If `patientFees.courseFee === null`, redirect to `/patients/${id}` (no fee to receipt).

### Page Layout

Follows same brand pattern as patient report (same `#1B3A2E` dark green):

---

**1. Letterhead** — identical to patient report header (PYTC logo, clinic name, contact, date badge)

The right badge reads:
```
DOCUMENT
Receipt
[date]
Ref: [patientCode]
```

---

**2. Patient Section** — section header bar: `PATIENT`

Simple 2-column row:
- Full Name | Patient Code
- Branch (if set) | Mobile

---

**3. Fee Summary** — section header bar: `FEE SUMMARY`

Same three-box layout as in the patient report:
- **Total Fee / कोर्स शुल्क** — ₹[courseFee]
- **Total Paid / भरलेले** — ₹[totalPaid]
- **Balance Due / बाकी** — ₹[balance] (orange if > 0, green if 0)

---

**4. Payment History** — section header bar: `PAYMENT HISTORY`

Table with dark green header row:

| NO. | DATE | DESCRIPTION | AMOUNT (₹) |
|---|---|---|---|
| 1 | 03 Jun 2026 | First instalment | 1,500.00 |
| 2 | 10 Jun 2026 | Second instalment | 500.00 |

*Note: `getPatientFees` returns payments descending (newest-first). The receipt page must reverse the array before rendering to ensure rows appear in ascending payment date order (oldest first — receipt convention).*
Amount formatted with two decimal places and commas (e.g. `1,500.00`).

**Total row** at bottom of table:
```
                              TOTAL PAID    ₹2,000.00
```

---

**5. Footer** — same signature block as patient report

```
Aacharya Narayan Pawar
Founder of PYTC & Lead Instructor
Pawar Yoga Therapy Center, Pune
```

Centred line below rule:
> "This is an official receipt issued by Pawar Yoga Therapy Center. | Generated on [date]"

---

**6. Print button** — hidden on print, shown in screen view:

```tsx
<div className="mb-4 flex justify-end print:hidden">
  <PrintButton />
</div>
```

`PrintButton` component already exists in `src/components/PrintButton.tsx`.

## Link from Patient Detail Page

In `src/app/(app)/patients/[id]/page.tsx`, add a "Print Receipt / पावती" button in the page header next to the existing print link. Only render it when `patientFees.courseFee !== null`:

```tsx
{patientFees.courseFee !== null && (
  <Button asChild variant="outline" size="sm">
    <Link href={`/patients/${id}/receipt`}>Print Receipt / पावती</Link>
  </Button>
)}
```

This requires fetching `getPatientFees` in the patient detail page (already fetched for the Fees tab from Spec B — no extra query).

## Testing

No automated test for the receipt page (print/UI page; covered by manual QA consistent with project convention).

**Manual QA checklist:**
- Receipt page loads for patient with fees set
- Redirects to patient page when no course fee exists
- All payments appear in ascending date order
- Total row matches `totalPaid`
- Balance colour: orange when > 0, green when 0
- Print button triggers `window.print()`
- Letterhead matches patient report header
- "Print Receipt" button on patient page is hidden when no fee set
- "Print Receipt" button on patient page is visible when fee is set

## Invariants Preserved

- Auth check (`requireUser()`) before any data access
- No direct DB queries in page — all via `getPatient` and `getPatientFees`
- No new schema, no new actions
