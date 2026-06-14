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
- Zod: `visitSchema` gets `nextVisitDate: z.string().date().optional()` (same format as `visitDate`, `YYYY-MM-DD`)
- Saved through the existing `addVisitAction` → `addVisit` data function — both receive the new optional field.

---

## 3. Dashboard Panel

**File:** `src/app/(app)/dashboard/page.tsx`

New card inserted above the existing stats/charts:

**Title:** Follow-ups This Week / या आठवड्यातील पाठपुरावा

**Window:** today through today + 6 days inclusive (7-day rolling window, computed server-side from `new Date()` in UTC+5:30 / IST).

**Data query:** `getFollowUpsThisWeek(db)` in `src/data/visits.ts`
- For each patient, take only their most recent visit's `nextVisitDate` (latest `createdAt` per `patientId`)
- Filter where `nextVisitDate` falls within [today, today+6]
- Join `patients` to get `fullName`, `patientCode`, `mobile`
- Order by `nextVisitDate` ascending

**Row display:**
```
Jane Doe · PYT-0002    9876543210    Due: 16 Jun
```
- Patient name is a link to `/patients/:id`
- Mobile number shown as plain text (tap-to-call on mobile)
- Date formatted as `DD MMM` (e.g. "16 Jun")

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
| `src/data/visits.ts` | `tests/data/visits.test.ts` | `getFollowUpsThisWeek` returns correct patients within window; excludes patients outside window; uses most recent visit per patient |
| `src/actions/visits.ts` | `tests/actions/visits.test.ts` | `addVisitAction` with `nextVisitDate` saves correctly; omitting field still works |
| UI | manual / `next build` | Field appears in form; dashboard card shows/hides correctly |

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
| `tests/data/visits.test.ts` | New tests for `getFollowUpsThisWeek` |
| `tests/actions/visits.test.ts` | Extend with `nextVisitDate` cases |
| `docs/architecture.md` | Update phase roadmap line |

---

## Out of Scope

- Cancellation / rescheduling (no appointments table)
- WhatsApp/SMS integration (Phase 3)
- Push notifications or email reminders
- Per-visit edit or delete
