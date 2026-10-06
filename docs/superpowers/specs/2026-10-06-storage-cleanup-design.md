# Delete Client & Withdraw Photo Consent — Design

Date: 2026-10-06 · Branch: `feat/storage-cleanup` · Status: Approved (Deepak, 2026-10-06)
Roadmap: posture follow-up plan **E1 + E2** (`docs/superpowers/plans/2026-10-04-posture-followups.md`).

## Why

- **E1:** there is no way to delete a client. `deletePatient` exists but nothing calls it. If it were called, the database rows would cascade away but every file in R2 would stay: posture photos, documents, and the profile photo (old profile photos already pile up, because replacing one never deletes the previous file). A client who asks to be erased can't be.
- **E2:** a client can withdraw photo consent, but there is no way to delete their posture photos while keeping their progress.

## 1. Delete client (danger zone)

- **Where:** a "Delete client / साधक हटवा" card at the bottom of the client's **edit** page.
- **Confirming:** the physio types the client's full name, as with a GitHub repo delete. The action compares it again on the server (trimmed, case-insensitive).
- **Order (files first, revised after PR review):**
  1. Remove **every file under `patients/<id>/`** in storage, by prefix rather than from the DB paths, so leftovers and orphans go too. R2 attempts every batch, then reports failures (counts only).
  2. Only if that succeeded, delete the `patients` row. All 12 child tables cascade, including share links, so any live client link stops working at once.
  3. If storage fails, the client is **kept** and the physio sees "please try again". A retry finishes the job. Deleting the row first would orphan PHI with no way to find it again.
- **Afterwards:** redirect to `/patients`.

## 2. Withdraw photo consent (all posture photos of a client)

- **Where:** on the client's **Assessment tab**, in the posture section, a "Withdraw photo consent / फोटो संमती मागे घ्या" button with an AlertDialog confirmation. It only appears when the client has posture photos.
- **What it deletes:** every posture photo file for that client. Files go first; only views whose file is actually gone get `file_path` nulled. A photo that failed to delete keeps its path, the physio sees "N photo(s) could not be deleted; please try again", and the button stays until a retry succeeds.
- **What it keeps:** the saved points (landmarks), measurements, scores, AI text and notes. The stick figures are drawn from the saved points, so reports, comparisons, the score trend and the progress link all keep working, just with no photo behind the figure.
- **Recorded:** `posture_assessments.photos_deleted_at` is set on each affected assessment (the first withdrawal date is kept). Each view with no photo says "Photo deleted (consent withdrawn)", and the Assessment tab notes "Photos deleted on {date}".
- **Shared posture links:** `include_photos` is switched off on the client's posture link, so the physio's status line says "without photos" and the client's page says "Photo not shared".
- **New assessments:** these still need the consent tick as today (`consent_at`), which is fresh consent.
- **Retakes:** "Retake views" after withdrawal stores new photos under fresh consent. `photos_deleted_at` is kept as the record of the withdrawal: each view shows its photo if it has one, else "Photo deleted (consent withdrawn)". A partial retake leaves the other views' photos deleted, so clearing the flag would be wrong.

## Data model (migration 0021)

- `posture_views.file_path` becomes **nullable**; null means the photo was deleted.
- `posture_assessments.photos_deleted_at timestamp` (nullable).
- `FileStorage` gains `removePrefix(prefix): Promise<number>`:
  - R2: `ListObjectsV2` paged, then `DeleteObjects` in batches of up to 1000.
  - Local: `rm -r` of the folder.
  - Returns the number of files removed.
  - Refuses an empty prefix and anything that doesn't match `patients/<uuid>/`.

## Code layout

- `src/data/patients.ts`: `deletePatientAndFiles(db, storage, id)` calls `storage.removePrefix(`patients/${id}/`)`, then deletes the row. Throws on a storage failure and keeps the client. Returns `{ deleted, filesRemoved }`.
- `src/data/posture.ts`:
  - `deletePosturePhotos(db, storage, patientId, now)` collects this client's non-null view paths and removes the files (allSettled). Then, in one transaction, it nulls the paths of the files that are gone, stamps `photos_deleted_at` and turns off `include_photos`. Returns `{ deleted, failed }`.
  - Every reader treats a null `filePath` as "no photo": the physio report, compare, the shared posture report, retake and delete.
- `src/actions/patients.ts`: `deletePatientAction(id, confirmName)`.
- `src/actions/posture.ts`: `withdrawPhotoConsentAction(patientId)`.
- UI:
  - `src/components/DeleteClientCard.tsx` (client island, typed-name confirm);
  - a withdraw button on the Assessment tab;
  - a deleted-photos note on the report.

## Tests

- **Storage:**
  - `removePrefix` on R2 (mocked SDK: paging, batching, refuses a bad prefix);
  - local (removes only that client's folder);
  - FakeStorage support.
- **Data:**
  - deleting a client removes every row and every file under the prefix, including an orphaned old profile photo, and leaves another client's files alone;
  - a storage failure still deletes the client;
  - withdrawing consent nulls paths and deletes the files, while metrics, score, compare and the shared report still work with no photo URLs;
  - another client's photos are untouched;
  - a retake after withdrawal stores new photos and clears the flag.
- **Actions:**
  - auth required;
  - a wrong typed name refuses;
  - the right name deletes and redirects;
  - an invalid id refuses;
  - withdraw requires auth and works per client.

## Out

- Deleting old profile photos when a new one is uploaded (small, separate fix; the client delete sweeps them anyway).
- Audit log of deletions (Phase 3 "audit logs").
- Undo or soft delete.

## Docs

`docs/architecture.md` (module map, invariants: "deleting a client wipes `patients/<id>/` in storage"). Mark E1/E2 done in the follow-ups plan.
