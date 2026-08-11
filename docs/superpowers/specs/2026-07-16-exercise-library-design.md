# Exercise Library & Prescribed Exercises — Design Spec

Date: 2026-07-16
Status: Retroactive — documents the feature as shipped in PR #17 (`feat/exercise-library`, merged). Written after the fact to close a documentation gap; describes actual behavior, not a proposal.

## Purpose

Therapists assign home-exercise programs to patients verbally or on paper, with no record in the app and nothing reusable across patients. This feature adds a bilingual exercise library (seeded from standard conditioning programs) and per-patient prescriptions: pick exercises from the library, optionally override the dose (repetitions / days per week) or attach a note, and have the prescription appear on the patient detail page and the printable A4 report the patient takes home.

## Scope

**In scope:**
- `exercises` library table seeded from program JSONs (spine conditioning, rotator cuff & shoulder conditioning).
- `prescribed_exercises` join table: one row per patient per exercise, with optional dose overrides and a custom note.
- Repo functions in `src/data/exercises.ts`; one server action to save a patient's whole prescription set.
- `PrescribedExercisesForm` client island (picker on the patient detail page) and prescription rendering in the print view.
- Idempotent seeder `src/db/seed-exercises.ts` used by tests and `scripts/seed-db.ts`.

**Out of scope:**
- In-repo image generation pipeline. Exercise images are generated externally and referenced by hand-edited `image_path` entries in the seed JSONs (deliberate — see Seeding).
- Per-visit exercise compliance tracking; exercise history/versioning.
- CRUD UI for the library itself — library content changes go through seed JSONs + reseed.

## Data model

`exercises` (migration 0010):
- `id` uuid pk, `created_at` — house pattern.
- `name` text NOT NULL **UNIQUE** — the seeder's upsert and orphan-detection key.
- Bilingual pairs: `name/name_mr`, `description/description_mr` (nullable), `repetitions/repetitions_mr`, `days_per_week/days_per_week_mr`, `steps/steps_mr` (text arrays), `tip/tip_mr` (nullable).
- `category` text with CHECK `IN ('neck', 'back', 'core', 'lower_body', 'shoulder')`.
- `image_path` nullable text.

`prescribed_exercises`:
- `patient_id` / `exercise_id` FKs, both `ON DELETE CASCADE`.
- `repetitions`, `days_per_week` nullable text — per-patient dose overrides; display resolves `override ?? library default`.
- `custom_note` nullable text.
- UNIQUE `(patient_id, exercise_id)` — one prescription per patient per exercise; index on `patient_id`.

Both tables `enableRLS()` (house pattern; app uses service role).

## Repo (`src/data/exercises.ts`)

- `listAllExercises(db)` — full library, ordered by category then name.
- `getPrescribedExercises(db, patientId)` — inner join to the library; returns a flattened `PrescribedExercise` shape carrying both library defaults and the override columns so the UI/print layer does the `override ?? default` fallback.
- `savePrescribedExercises(db, patientId, list)` — **replace-the-whole-set** in one transaction: delete all rows for the patient, insert the new list. Rationale: the picker form always submits the complete selection, so replace is simpler and immune to diff bugs; the unique `(patient_id, exercise_id)` index backstops duplicates at the DB level.

## Action (`src/actions/exercises.ts`)

`savePrescribedExercisesAction(patientId, formData)` — standard action shape (requireUser → zod → repo → revalidate):
- Reads `prescribedExercisesJson` (JSON payload from the picker form); missing/empty input saves an empty set (clears the prescription).
- Validates with `prescribedExercisesListSchema` (`src/lib/validation.ts`), which `.refine`s against duplicate `exerciseId`s with a bilingual message.
- Revalidates `/patients/{id}`; returns bilingual errors in `ActionResult`.

## UI

- **Patient detail page** (`patients/[id]/page.tsx`): prescription list + `PrescribedExercisesForm` client island — library picker grouped by category, per-exercise reps/frequency override inputs and custom-note field, submits the whole set as one JSON hidden field.
- **Print view** (`patients/[id]/print/page.tsx`): prescribed exercises rendered on the A4 report with bilingual names, resolved dose (override ?? default), steps and tips — the take-home sheet.

## Seeding (`src/db/seed-exercises.ts`)

`seedExercises(db)` — idempotent upsert from `src/db/seed-data/*.json`, keyed on `exercises.name`, in a transaction:
- Parses each JSON once; parse errors report the offending filename.
- Skips no-op updates; preserves existing `image_path` when the image map lacks an entry.
- Warns on DB rows absent from seed JSON (orphan names after a rename) instead of deleting.
- Consumers: `tests/helpers/db.ts` (`createTestDb` seeds every test DB) and `scripts/seed-db.ts`.

Image workflow (deliberate): more program PDFs will arrive over time; images are generated outside the repo and seed JSONs are hand-edited to reference them. No automated image pipeline wanted.

## Testing

- `tests/db/seed-exercises.test.ts` — idempotency, no-op skip, `image_path` preservation, orphan-name warning.
- Repo/action tests follow the house pattern (PGlite, no real Supabase); `src/lib`/`src/data`/`src/actions` stay under the 80% coverage gate (94.8% at merge).

## Edge cases / accepted limitations

- Saving replaces the set: any concurrent edit loses — acceptable single-clinic, effectively single-editor.
- Library rename creates an orphan warning, not a migration: old prescriptions keep pointing at the same row (rename happens in-place via name-keyed upsert only if the name is unchanged; a true rename is a new row + manual cleanup guided by the warning).
- `category` CHECK must be extended by migration when a new program category arrives (as done for `shoulder`).
