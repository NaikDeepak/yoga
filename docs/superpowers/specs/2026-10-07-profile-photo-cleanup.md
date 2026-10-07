# Profile Photo Cleanup — Spec (pilot task for Antigravity)

Date: 2026-10-07 · Branch: `feat/profile-photo-cleanup` · Backlog item "Delete the old profile photo…"

## Problem
`updatePatientAction` (and `createPatientAction`) upload a new profile photo and call `setPhotoPath`, but never
delete the previous file. Every photo change leaves an orphan file in R2 under `patients/<id>/`. Delete client
sweeps the folder eventually, but until then they pile up.

## Required behaviour
1. **Data layer:** add `replacePatientPhoto(db, storage, patientId, file)` in `src/data/patients.ts`:
   - build the storage key as today plus a random suffix (added in review so same-millisecond uploads can't collide): `patients/<id>/photo-<Date.now()>-<8 hex>-<sanitised name>` (sanitise as now: `name.replace(/[^\w.\-]+/g, '_')`);
   - **upload the new file first**, then update `patients.photo_path`, reading the previous path inside the same statement or transaction;
   - **only after the row points at the new file**, remove the previous file. This is best effort: use `Promise.allSettled`, and a failed removal must not fail the call;
   - if the DB update fails, remove the newly uploaded file and rethrow (no orphan);
   - return `{ photoPath: string }` (the new key).
2. **Actions:** `createPatientAction` and `updatePatientAction` use `replacePatientPhoto` instead of `upload` + `setPhotoPath`. Validation and redirects are unchanged.
3. Keep `setPhotoPath` (tests use it); don't change its behaviour.

## Tests (TDD: failing test first), in the files that mirror src
- `tests/data/patients.test.ts`:
  - the first photo is stored and set;
  - replacing deletes the old file and keeps the new one;
  - a failing remove of the old file still succeeds, and the row points at the new one;
  - a failing DB update removes the newly uploaded file and throws;
  - another client's photo is untouched.

  Use `FakeStorage` from `tests/helpers/fake-storage.ts` (it has `failRemove` and `failNextUpload`).
- `tests/actions/actions.test.ts`, "replaces photo when provided": also assert that the old file is gone from `storage.files`.

## Constraints
- Follow `CLAUDE.md` conventions: layering, no DB access from actions except through `src/data`, and log errors with `safeErrorMessage` if you log at all.
- **No other files.** Don't touch `docs/architecture.md` (Claude updates it), and don't change migrations or the schema.
- Run `npx vitest run tests/data/patients.test.ts tests/actions/actions.test.ts` and `npm run typecheck`; both must pass.
- Commit on branch `feat/profile-photo-cleanup` with a clear message. **Do not push, do not merge.**
