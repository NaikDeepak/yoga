# Clinic Profile — Spec (assigned to Antigravity)

Date: 2026-10-07 · Branch: `feat/clinic-profile` · Plan: `docs/superpowers/plans/2026-10-07-multi-clinic-direction.md` ("Now" items 1–2).

## Goal
Move **every Pawar-specific detail** into one typed, validated clinic profile, so a future clinic is a new profile file,
not code edits. **There must be zero visible change for Pawar:** every page, receipt, message and code reads exactly as today.

## New files
- **`src/clinics/types.ts`:** the `ClinicProfile` type plus a zod `clinicProfileSchema`:
  - `slug`;
  - `name: { en, mr }` (full name, e.g. "Pawar's Yog Therapy Center" / "पवार योग थेरपी सेंटर") and `shortName: { en, mr }` ("Pawar's Yog Therapy" / its Marathi form);
  - `logo: { src, alt }`;
  - `contact: { phone, whatsappDigits, email, hours }`;
  - `signature: { name, lines: string[] }` (the founder block on receipts and the printout);
  - `branches: { key, label, fullAddress }[]` (non-empty, unique keys);
  - `patientCodePrefix` (e.g. `"PYT"`, letters only);
  - `features: { posture, flexibility, ai, shareLinks, checkins }` (booleans).
- **`src/clinics/pawar.ts`:** Pawar's profile. Copy today's values exactly:
  - name, contact and hours from `src/lib/clinic.ts`;
  - branches and addresses from `src/lib/presets.ts`;
  - the signature block text from `src/app/(app)/patients/[id]/receipt/page.tsx` (lines ~108–110);
  - logo `/pytc-logo.png` with alt `PYTC`;
  - prefix `PYT`;
  - every feature `true`.
- **`src/clinics/index.ts`:** a registry `{ pawar }` and `export const clinicProfile`, chosen by `process.env.CLINIC_PROFILE` (default `"pawar"`) and **validated with the schema at import**. An unknown slug or invalid profile throws, naming the problem. Also `export function clinicName(locale, short = false)`.

## Rewire (behaviour unchanged)
- **`src/lib/clinic.ts`:** `CLINIC` keeps its exact shape (`name`, `phone`, `email`, `hours`, `whatsappDigits`) but is **derived from `clinicProfile`**. Existing imports keep working.
- **`src/lib/presets.ts`:** `BRANCHES` (and the `BranchKey` type) are **derived from `clinicProfile.branches`**. Keep the export names.
- **`src/lib/patient-code.ts`:** the prefix comes from `clinicProfile.patientCodePrefix` (`PYT-`). Existing codes keep parsing.
- **`src/lib/features.ts`:** `isPostureEnabled(env)` keeps its current semantics. An explicit `FEATURE_POSTURE=true|false` env var wins; otherwise the profile's `features.posture` applies, but **still only in development**. Production stays off unless the env var is `true`. Add `isFeatureEnabled(name, env)` for the other switches, with the same "env var `FEATURE_<NAME>` wins" rule. **Don't wire the new switches into the UI yet.**
- **Hard-coded identity, replace with the profile:**
  - `src/app/layout.tsx` and `src/app/s/[token]/page.tsx` metadata titles → `clinicName('en', true)`;
  - `src/app/manifest.ts` name and description;
  - `src/components/Sidebar.tsx` (logo and name);
  - `src/app/login/page.tsx` and `src/app/register/page.tsx` (logo src/alt);
  - `src/components/ReportLetterhead.tsx` and `src/app/s/[token]/not-found.tsx` (logo);
  - the **signature blocks** in `src/app/(app)/patients/[id]/receipt/page.tsx`, `.../charges/[chargeId]/receipt/page.tsx` and `.../print/page.tsx` → one new component `src/components/ClinicSignature.tsx` rendering `clinicProfile.signature`.
- **`src/lib/whatsapp.ts`:** every message uses `clinicName('en', true)` instead of the literal "Pawar's Yog Therapy". The output text must stay identical.
- **i18n (`src/lib/i18n/en.ts`, `mr.ts`):** replace the clinic name inside `auth.loginTitle`, `print.footerText`, `receipt.footerOfficial`, `chargeReceipt.footerOfficial` and `dashboard.birthdayWishMsg` with a `{clinic}` placeholder.
  - Fill it in at the use sites with the right-language name: `src/app/login/page.tsx`, `.../print/page.tsx`, both receipt pages, and the birthday-wish builder in `src/app/(app)/dashboard/page.tsx` (around line 502).
  - The rendered text must be unchanged. In particular the Marathi birthday text keeps "पवार योग थेरपी सेंटर", so `name.mr` must be exactly that.
- **`src/components/TopNav.tsx`:** the comment mentioning `dr.pawar@example.com` → use `dr.someone@example.com`.

## Tests (TDD; files mirror src)
- **`tests/clinics/profile.test.ts`:**
  - Pawar's profile passes the schema;
  - an unknown `CLINIC_PROFILE` throws;
  - a profile with a duplicate branch key, an empty branch list or a bad prefix fails the schema;
  - `clinicName` en/mr, short and full;
  - `CLINIC`, `BRANCHES` and the code prefix equal today's values (pin them).
- **`tests/clinics/no-hardcoded-clinic.test.ts` (the guard):** read every `.ts`/`.tsx` under `src/` **except** `src/clinics/` and `src/db/seed-mock.ts` (demo data). Assert none contains `Pawar`, `पवार`, `PYTC`, `pytc-logo`, `8550921037`, `85509 21037`, `pawarsyog`, `Dodamarg` or `Yog Therapy`.
- **`tests/lib/features.test.ts`:** add cases: an env var overrides the profile both ways; production stays off without the env var; `isFeatureEnabled` follows the same rules.
- **Must stay green unchanged:** the existing tests, which pin today's texts (e.g. `tests/lib/whatsapp.test.ts`) and the patient-code tests.

## Constraints
- **Only the files named above,** plus new tests. **No schema or migration changes.** Don't edit `docs/architecture.md`; Claude updates it.
- **Verify:** `npx vitest run tests/clinics tests/lib tests/components` **and the full `npm test`**, plus `npm run typecheck`. Everything must pass.
- **Commit** on `feat/clinic-profile`. **Don't push.** Hand off to claude in the notepad.
