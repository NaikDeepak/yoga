---
name: add-domain-entity
description: Use when adding a new patient-data domain slice to the yoga patient-management app (a new table/record type with its own repo functions, server actions, and UI) — e.g. tracking a new kind of per-patient record. Not for adding a single column to an existing table.
---

# Add Domain Entity

This is a checklist, not a tutorial — the full pattern is already documented in
`docs/architecture.md` under "How to add a feature." Read that section first;
this skill just keeps you from skipping a step.

## When this applies

A genuinely new domain entity (its own table, its own `src/data/*.ts` +
`src/actions/*.ts` files) — e.g. `lifestyle_assessments`, `documents`,
`visits`. If the request is really "add a field to `patients`," skip this:
just add the column, update `src/lib/validation.ts`, and extend
`PatientForm.tsx` — no new data/actions files needed.

## Reference slice

`src/data/lifestyle.ts` + `src/actions/lifestyle.ts` + their tests is the
cleanest example of the "one record per patient, upsert" shape. For a
"many records per patient" shape (the more common case), use
`src/data/visits.ts` + `src/actions/visits.ts` instead.

## Checklist

1. **Schema** — add the table to `src/db/schema.ts`, then
   `npm run db:generate` → review the generated SQL in `drizzle/` → commit it
   as-is (never hand-edit a generated migration).
2. **Data layer** (TDD: test first) — `src/data/<domain>.ts`, pure functions
   taking `db` as an argument. Test in `tests/data/`, built on
   `tests/helpers/db.ts` (in-memory PGlite running real migrations).
3. **Validation** — zod schema in `src/lib/validation.ts`. Every error
   message is bilingual: `"English / मराठी"`.
4. **Server action** (TDD: test first) — `src/actions/<domain>.ts`. Order
   inside the action: `requireUser()` → zod parse → call the repo function →
   `revalidatePath`. Test in `tests/actions/`, using the mocks in
   `tests/helpers/action-mocks.ts` (db client, storage, auth, next/cache,
   next/navigation).
5. **UI** — under `src/app/(app)/...`, using `InlineForm` for error display.
   Every label is bilingual.
6. **Coverage** — `npm run coverage`; the new code in `src/lib`, `src/data`,
   `src/actions` must keep the 80% gate (`vitest.config.ts`) green.
7. **Docs** — in the *same commit*, update `docs/architecture.md`'s module
   map table (add the new files + key exports) and, if the pattern itself
   changed, the "How to add a feature" section.

## Common misses

- Forgetting bilingual text on a *validation* error message (easy to bilingual
  the form but miss the zod `message:`).
- Hand-editing a generated migration instead of re-running `db:generate`.
- A server action that skips `requireUser()` because "it's just a read" —
  every mutation goes through auth; check `docs/architecture.md`'s invariants
  list if unsure.
- Updating code but not `docs/architecture.md` in the same commit — the doc
  is what the next session reads instead of scanning `src/`.
