# CSV Export — Spec (assigned to Antigravity)

Date: 2026-10-07 · Branch: `feat/csv-export` · Roadmap: Phase 3 "CSV export". Paired with the audit log (`feat/audit-log`, Claude).

## Decisions (Deepak)
- **Three files:** Clients, Visits, Fees & payments. **No visit notes** (clinical free text stays in the app).
- **Where:** an **"Export data / डेटा निर्यात"** card on the **Settings** page, logged-in staff only, with one download link per file. It respects a branch choice (All, or one branch from `BRANCHES`).
- **Audit:** each export is recorded in the audit log. **Claude wires that in when integrating**; leave a single clearly marked spot (see Route).

## Files and columns (header row exactly as listed; one row per item; dates `YYYY-MM-DD`)
1. **`clients-<YYYY-MM-DD>.csv`:** `Client code, Name, Mobile, Branch, Age, Gender, Joined, Problems`.
   - Joined is the IST date of `created_at`.
   - Problems is the client's problems joined with `; `.
   - Ordered by client code.
2. **`visits-<YYYY-MM-DD>.csv`:** `Client code, Name, Visit date, Pain (0-10), Weight (kg), Next visit`.
   - Ordered by visit date, then client code.
   - Empty cells where a value is null.
3. **`fees-<YYYY-MM-DD>.csv`:** `Client code, Name, Course fee, Total paid, Balance, Charges total`.
   - Balance = course fee − total paid, exactly as `getPatientFees` computes it; empty if there's no course fee.
   - Charges total = the sum of the client's `charges` (tracked separately; not part of the balance).
   - Amounts are plain numbers with no currency sign.
   - Every client is included (blank fee cells when there's no fee row). Ordered by client code.

## Code layout (follow `CLAUDE.md` layering)
- **`src/lib/csv.ts`** (pure):
  - `toCsv(header: string[], rows: (string | number | null)[][]): string`. RFC 4180: quote fields containing `,` `"` CR or LF, double the inner quotes, `\r\n` line endings, **UTF-8 BOM** at the start so Excel shows Marathi correctly.
  - **Formula-injection guard:** a text cell starting with `=`, `+`, `-`, `@`, a tab or CR gets a leading `'`. Numbers are not prefixed.
  - `csvFilename(kind, isoDate)`.
- **`src/data/export.ts`:** `exportClients(db, { branch? })`, `exportVisits(db, { branch? })` and `exportFees(db, { branch? })`, each returning `{ header, rows }`. Use efficient queries (joins or grouped sums), not a query per client.
- **Route `src/app/api/export/[kind]/route.ts`:**
  - `GET` with `kind` in `clients | visits | fees` and optional `?branch=<key>`.
  - `getSessionUser()`, and `401` if there's no user (same pattern as `src/app/api/ai/treatment-plan/[patientId]/route.ts`).
  - Unknown kind gives `404`. An unknown branch value gives `400`.
  - Response: `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="…"`, `Cache-Control: no-store`.
  - Put exactly this comment where the CSV is built: `// AUDIT: export recorded here (wired by Claude)`.
  - Log errors only with `safeErrorMessage`.
- **UI:**
  - `src/components/ExportCard.tsx`: a client component with a branch select and three links whose `href`s carry `?branch=`. Plain `<a download>`, no JavaScript fetching needed.
  - Added to `src/app/(app)/settings/page.tsx` as a new Card, styled like the existing cards.
- **i18n:** an `export` block in `src/lib/i18n/en.ts` and `mr.ts`, every label "English" and "मराठी" in the respective file: title, description, branch label, all branches, and the three file labels.

## Tests (TDD; mirror src)
- **`tests/lib/csv.test.ts`:** quoting (comma, quote, newline), BOM and CRLF, nulls as empty, the formula guard (for `=SUM(1)`, `+1`, `-2`, `@x`, but not the number `-2`), and Marathi text unchanged.
- **`tests/data/export.test.ts`:** PGlite with a few clients, problems, visits, fees, payments and charges:
  - the exact headers;
  - row order;
  - the problem join;
  - nulls;
  - balance and charges totals;
  - the branch filter;
  - visit notes never appear (create a visit with a distinctive note and assert it's absent from the output).
- **`tests/app/api/export.test.ts`** (see the existing `tests/app/api/` tests for mocking):
  - 401 without a user;
  - 404 for an unknown kind;
  - 400 for a bad branch;
  - 200 with CSV headers and filename for each kind.
- **`tests/components/export-card.test.tsx`:** links point to the right URLs, and the branch choice updates them.

## Constraints
- Edit or create **only** the files listed above. **No schema changes and no migrations.** Don't touch `docs/architecture.md`; Claude updates it.
- Must pass: `npx vitest run tests/lib/csv.test.ts tests/data/export.test.ts tests/app/api/export.test.ts tests/components/export-card.test.tsx` and `npm run typecheck`.
- Commit on `feat/csv-export`. **Don't push.** Hand off to claude in the notepad.
