# Follow-up Appointments — Design Spec

**Date:** 2026-06-14
**Branch:** feat/follow-up-appointments
**Status:** Approved

## Problem

The existing `visits` table records past visits (date, weight, pain, note) but has no forward-looking field. There is no way to:
- Schedule when a patient should return
- See which patients are due for follow-up this week
- Know who to call or WhatsApp for a reminder

## Solution

Add one nullable `next_visit_date` column to the `visits` table and surface a "Follow-ups" card on the dashboard.

---

## 1. Data Model

**Change:** Add one nullable date column to `visits` in `src/db/schema.ts`:

```ts
nextVisitDate: date('next_visit_date'),   // nullable, no default
```

- One Drizzle migration, no new table.
- The most recent visit's `nextVisitDate` is authoritative per patient. Older values are silently superseded when a new visit is logged.
- If a new visit is logged without a `nextVisitDate`, the patient disappears from the dashboard — logging a visit with no follow-up date effectively clears the pending follow-up. This is intentional: attending the session resolves the pending call.
- No constraint forcing a value — therapist leaves it blank when no follow-up is needed.

---

## 2. Visit Form Change

**File:** `src/app/(app)/patients/[id]/page.tsx` — `Treatment` component / Add Visit card.

Add one optional date field below the existing Date/Weight/Pain row:

```
Next visit / पुढील भेट   [date input, min=today, optional]
```

- Field name: `nextVisitDate`
- Zod: `visitSchema` gets `nextVisitDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / चुकीची तारीख'))` using the project's existing `opt` helper, which maps empty strings (`""`) submitted by HTML forms to `undefined`. Plain `z.string().date().optional()` would fail on empty form submission.
- Saved through the existing `addVisitAction` → `addVisit` data function — both receive the new optional field.

---

## 3. Dashboard Panel

**File:** `src/app/(app)/dashboard/page.tsx`

New card inserted above the existing stats/charts:

**Title:** Follow-ups This Week / या आठवड्यातील पाठपुरावा

**Window:** today through today + 6 days inclusive (7-day rolling window). The date range is computed using `getISTDateString(offsetDays)` — a helper that extracts year/month/day from the IST offset (`UTC+5:30`) directly, avoiding timezone shift bugs from `new Date().toLocaleDateString()` when the server runs in a non-IST timezone.

**Data query:** `getFollowUpsThisWeek(db)` in `src/data/visits.ts`
- For each patient, use a subquery ordering by `visitDate DESC` first, then `createdAt DESC` as the tie-breaker (using `selectDistinctOn([visits.patientId])`), ensuring the latest visit per patient determines follow-up status. This ensures backfilled visits are not incorrectly treated as the authoritative visit.
- Filter where that visit's `nextVisitDate` falls within [today, today+6] (IST date strings).
- Join `patients` to get `fullName`, `patientCode`, `mobile`
- Order by `nextVisitDate` ascending

**Row display:**
```
Jane Doe · PYT-0002    9876543210    Due: 16 Jun
```
- Patient name is a link to `/patients/:id`
- Mobile number shown as plain text (tap-to-call on mobile)
- Date formatted as `DD MMM` (e.g. "16 Jun") using a timezone-safe `formatDueDate` helper that splits the `YYYY-MM-DD` string directly rather than parsing through `new Date()`:

```ts
function formatDueDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[month - 1]}`;
}
```

**Empty state:** "No follow-ups in the next 7 days / या आठवड्यात कोणी नाही"

---

## 4. Validation

- `nextVisitDate` is optional everywhere; omitting it is valid.
- No client-side min-date enforcement beyond the `min=today` HTML attribute (server ignores past dates — they simply won't appear in the dashboard window once passed).
- `visitSchema` change is additive and backwards-compatible.

---

## 5. Testing

Follow the project's TDD pattern: failing test → minimal code → commit.

| Layer | Test file | What to test |
|---|---|---|
| `src/data/visits.ts` | `tests/data/clinical.test.ts` | `getFollowUpsThisWeek` returns correct patients within window; excludes patients outside window; uses most recent visit per patient (clears when new visit has no `nextVisitDate`) |
| `src/actions/visits.ts` | `tests/actions/actions.test.ts` | `addVisitAction` with `nextVisitDate` saves correctly; omitting field still works |
| UI | manual / `next build` | Field appears in form; dashboard card shows/hides correctly |

New test cases are added directly to the existing files to keep the suite cohesive — no new test files created.

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/db/schema.ts` | Add `nextVisitDate` column to `visits` table |
| `drizzle/migrations/` | Generated migration |
| `src/lib/validation.ts` | Add optional `nextVisitDate` to `visitSchema` |
| `src/data/visits.ts` | Add `getFollowUpsThisWeek(db)` |
| `src/actions/visits.ts` | Pass `nextVisitDate` through to `addVisit` |
| `src/app/(app)/patients/[id]/page.tsx` | Add field to Add Visit form |
| `src/app/(app)/dashboard/page.tsx` | Add follow-ups card |
| `tests/data/clinical.test.ts` | Add tests for `getFollowUpsThisWeek` |
| `tests/actions/actions.test.ts` | Extend with `nextVisitDate` cases |
| `docs/architecture.md` | Update phase roadmap line |

---

## Out of Scope

- Cancellation / rescheduling (no appointments table)
- WhatsApp/SMS integration (Phase 3)
- Push notifications or email reminders
- Per-visit edit or delete
