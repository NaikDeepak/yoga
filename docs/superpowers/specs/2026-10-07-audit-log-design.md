# Audit Log — Design

Date: 2026-10-07 · Branch: `feat/audit-log` (Claude) · Paired with CSV export (`feat/csv-export`, Antigravity).
Roadmap: Phase 3 "audit logs".

## Decisions (Deepak)
- **What's recorded:** changes, deletes and exports. Not page views, logins, preferences, or the client's own public check-ins.
- **After a permanent client delete:** entries keep the **client code only**. Names and health details are never stored in the log, so it can prove what happened without undoing the erasure.

## Model (migration 0024)
`audit_log` has these columns:
- `id`;
- `seq` (bigserial: write order, for stable newest-first order and paging);
- `at`;
- `actor_id`, `actor_email`;
- `action`;
- `patient_id` (**no foreign key**, so entries survive a delete);
- `client_code`;
- `summary`.

## Rules
- **`recordAudit(db, entry)` is best effort:** a failed write is logged with `safeErrorMessage` and **never** fails the action. It looks up the client code from `patientId`; `client.delete` passes the code captured before erasure.
- **Recorded only on success:** each action calls it just before its success-path `revalidatePath` (or redirect).
- **Summaries are non-identifying:** amounts and dates (`₹2000 on 2026-10-02`), fee and document *types* (`MRI`), link kinds (`posture link (with photos)`), photo counts. **Never** names, problems, visit notes, or document file names (a file name can contain a name).
- **Actions recorded (30 call sites):**
  - client create, update, delete;
  - visit add;
  - fee set; payment add, delete; charge add, delete;
  - document upload, delete;
  - problem add, remove;
  - treatment plan, lifestyle assessment, prescription (save or add);
  - posture add, retake, delete; AI approve; flexibility save; photo consent withdrawn;
  - share link create and revoke (exercises, posture, progress);
  - **export** (wired when the CSV export branch is integrated).

## UI
**Settings → Activity log** (`/settings/activity`, linked from Settings) shows 50 entries per page, newest first, with "Show older". The columns are When (IST), Who, What (en/mr labels), Client (code) and Detail.

## Tests
- **Data:** order, code kept after delete with no name, no-client entries, never throws, paging.
- **Actions:** a full client lifecycle records the expected actions, with no name, problem, note or phone in any entry; delete is recorded with its code; failed actions aren't recorded.
- **Component:** columns, IST time, translated labels (every action has en and mr), the empty state.
