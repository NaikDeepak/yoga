# Clinic-ready product (Project 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The same code runs Pawar unchanged and a made-up "Sunrise Physio" with its own identity, on-screen colours, treatment sections, fee types and module switches — proven locally in mock mode and in CI.

**Architecture:** Everything a clinic differs by lives in its profile (`src/clinics/<slug>.ts`, picked by `CLINIC_PROFILE`). Core keeps registries (treatment sections, fee types, modules); a profile picks from them. One function decides each module switch; pages, actions, share links and data all ask it.

**Tech Stack:** Next.js 15 (React 19), Drizzle + Postgres/PGlite, zod, Tailwind v4 CSS variables, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-second-clinic-and-admin-design.md` (Project 1).

## Global Constraints
- Pawar must look and behave exactly as today: every module on, same colours (hex rounding of the current oklch values only), same sections, same fee types and amounts.
- Never `if (slug === 'sunrise')` or any clinic name in core; clinic text only in `src/clinics/`.
- Every user-facing string in `src/lib/i18n/en.ts` + `mr.ts` (English + Marathi). Clinic wording stays in the profile with `en`/`mr`.
- Colours: text ≥ 4.5:1 on white, large/bold ≥ 3:1 (existing `contrastOnWhite` rule).
- Stored data is never hidden: a treatment section or fee type a profile doesn't list still shows wherever it already holds a value.
- Migrations are additive (new nullable columns only); the same migrations run for every clinic.
- TDD, tests in `tests/` mirroring `src/`; layering `src/lib` → `src/data` → `src/actions` → `src/app`.
- `docs/architecture.md` updated in the same commit as each structural change.

## Review Focus
1. **Switch off, old link still out there:** a share link created while a module was on, opened after it was switched off, shows only the parts still on (or the "not found" page) — never a crash. Test in Task 5.
2. **Switch off, form already open:** a server action called after its module was switched off returns the "switched off" error instead of saving. Test in each wiring task (Task 4–7).
3. **Profile switched for a clinic with existing data:** a plan with `panchkarma` text in a clinic whose sections don't list it still shows and prints that text. Test in Task 8.
4. **Unknown fee type in old rows:** a charge with a fee type the profile doesn't list keeps its label on the fees tab and receipt. Test in Task 8.
5. **Missing `CLINIC_PROFILE` on a deploy:** the build fails loudly instead of showing Pawar. Test in Task 1.

---

### Task 1: Profile fails closed in production

**Files:**
- Modify: `src/clinics/index.ts`
- Modify: `.github/workflows/ci.yml` (Build step env: `CLINIC_PROFILE: pawar`)
- Modify: `docs/environments.md` (env table: `CLINIC_PROFILE` required in Production, set for build + runtime)
- Test: `tests/clinics/profile.test.ts`

**Interfaces:**
- Produces: `resolveClinicProfile(slug?: string, env?: Record<string, string | undefined>): ClinicProfile`

- [ ] **Step 1: Write the failing tests**

```ts
it('refuses to guess the clinic in production', () => {
  expect(() => resolveClinicProfile(undefined, { NODE_ENV: 'production' })).toThrow(/CLINIC_PROFILE/);
});
it('still defaults to pawar outside production', () => {
  expect(resolveClinicProfile(undefined, { NODE_ENV: 'development' }).slug).toBe('pawar');
  expect(resolveClinicProfile(undefined, { NODE_ENV: 'test' }).slug).toBe('pawar');
});
it('uses CLINIC_PROFILE from env when set', () => {
  expect(resolveClinicProfile(undefined, { NODE_ENV: 'production', CLINIC_PROFILE: 'pawar' }).slug).toBe('pawar');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/clinics/profile.test.ts` — expect the production test to FAIL.
- [ ] **Step 3: Implement.** `env` defaults to `process.env`; in production with no slug and no `CLINIC_PROFILE`, throw `CLINIC_PROFILE is not set. Set it in Vercel (Production, build and runtime).`
- [ ] **Step 4: Run** the test file, then `CLINIC_PROFILE= LOCAL_MOCK=false npm run build` must fail and `CLINIC_PROFILE=pawar npm run build` must pass (use the CI placeholder env from `docs/environments.md`).
- [ ] **Step 5: Commit** `feat(clinics): fail closed when CLINIC_PROFILE is missing in production`.

**Release note (Deepak):** before the next `deploy:prod`, add `CLINIC_PROFILE=pawar` to Vercel Production. `scripts/prod/deploy` must refuse if it's missing (`vercel env ls production` lists the name) — add that check here.

### Task 2: On-screen colours from the profile

**Files:**
- Modify: `src/clinics/types.ts` (new `theme` block), `src/clinics/pawar.ts`
- Create: `src/clinics/theme-css.ts`
- Modify: `src/app/layout.tsx` (inject `<style>` in `<head>`)
- Modify: `src/app/globals.css` (comment: the values are fallbacks; the profile wins)
- Test: `tests/clinics/theme-css.test.ts`, `tests/clinics/profile.test.ts`

**Interfaces:**
- Produces: `theme: { primary, primaryForeground, ring, background, foreground, accent, accentText }` (all `hex`) on `ClinicProfile`; `themeCss(theme: ClinicProfile['theme']): string` returns `:root{--primary:#…;…}` covering `--primary`, `--primary-foreground`, `--ring`, `--background`, `--foreground`, `--brand-accent`, `--brand-accent-text`.

- [ ] **Step 1: Write failing tests:** `themeCss` output contains each of the 7 variables with the profile's hex; and for every profile in `CLINIC_REGISTRY`: `contrastOnWhite(theme.primary) >= 4.5` (white button text sits on it, so check primary vs `primaryForeground` too), `contrastOnWhite(theme.accentText) >= 4.5`, `contrastOnWhite(theme.foreground) >= 4.5`. Move `contrastOnWhite` to `tests/helpers/contrast.ts` and add `contrast(a: string, b: string): number`.
- [ ] **Step 2: Run** — FAIL (no `theme`).
- [ ] **Step 3: Implement.** Pawar's hex values are the current `globals.css` oklch values converted to sRGB hex (convert once with a throwaway script; record the oklch source in a comment). Layout renders `<style dangerouslySetInnerHTML={{ __html: themeCss(clinicProfile.theme) }} />` — values are schema-checked hex, so no injection.
- [ ] **Step 4: Run** tests; open `npm run dev`, compare login, list and client page against `main` side by side — no visible change.
- [ ] **Step 5: Commit** `feat(clinics): on-screen theme colours come from the clinic profile`.

### Task 3: One switch function for every module

**Files:**
- Modify: `src/clinics/types.ts` (`features.fees: z.boolean()`), `src/clinics/pawar.ts` (`fees: true`)
- Modify: `src/lib/features.ts`
- Create: `src/lib/feature-off.ts`
- Test: `tests/lib/features.test.ts`

**Interfaces:**
- Produces: `isFeatureEnabled(name: ClinicFeature, env?: Env): boolean` — precedence `FEATURE_<NAME>` env (`true`/`false` only) → profile default. (Project 3 inserts the admin override between them; leave a one-line comment where.)
- Produces: `isPostureEnabled(env?)` becomes `isFeatureEnabled('posture', env)`.
- Produces: `featureOffError(name: ClinicFeature): { ok: false; error: string }` — message from i18n `features.off` ("This feature is switched off / हे वैशिष्ट्य बंद आहे"), used by every action in Tasks 4–7.

- [ ] **Step 1: Rewrite the posture tests** to the new rule: profile default in every environment, env overrides both ways, `fees` follows the profile and `FEATURE_FEES=false` turns it off. Remove the "off in production by default" test; Pawar production already sets `FEATURE_POSTURE=true`, so behaviour there is unchanged.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — all pass (fix callers' tests that relied on dev-only posture).
- [ ] **Step 5: Commit** `feat(features): one switch rule for all modules; add fees switch`.

### Task 4: Wire `flexibility` and `ai`

**Files:**
- Modify: `src/app/(app)/patients/[id]/posture/[assessmentId]/page.tsx` (flexibility capture link + AI card), `.../flexibility/page.tsx` (`notFound()` when off), `src/actions/posture.ts` (`saveFlexibilityTestsAction`, `generatePostureAiAction`, `savePostureAiAction`), `src/app/api/ai/**` (treatment draft route: 404 when `ai` off), `src/components/TreatmentPlanForm.tsx` (prop `aiEnabled: boolean`, hides "Generate with AI"), its parent page passes it; total-score UI hides flexibility parts when off.
- Test: `tests/actions/posture.test.ts`, `tests/app/api/ai.test.ts` (or the existing route test), `tests/components/treatment-plan-form.test.tsx`

**Interfaces:**
- Consumes: `isFeatureEnabled`, `featureOffError` (Task 3).

- [ ] **Step 1: Failing tests:** with `FEATURE_FLEXIBILITY=false` (`vi.stubEnv`), `saveFlexibilityTestsAction` returns `featureOffError('flexibility')` and writes nothing; with `FEATURE_AI=false`, `generatePostureAiAction` and the treatment AI route refuse; `TreatmentPlanForm` with `aiEnabled={false}` has no "Generate with AI" button.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (check at the top of each action, before auth-dependent work is fine). **Step 4: Run** `npm test`.
- [ ] **Step 5: Commit** `feat(features): flexibility and AI switches hide and refuse`.

### Task 5: Wire `shareLinks` and `checkins`

**Files:**
- Modify: `src/actions/share-links.ts` (all create actions refuse when `shareLinks` off; revoke stays allowed), `src/app/s/[token]/page.tsx` (`notFound()` when `shareLinks` off), share buttons on the client page hidden when off, `src/app/s/[token]/ExercisesBody.tsx` (no `CheckinForm` when `checkins` off), `src/actions/checkins.ts` (refuse when off), `src/data/shared-progress.ts` (parts by switch).
- Test: `tests/actions/share-links.test.ts`, `tests/actions/checkins.test.ts`, `tests/data/shared-progress.test.ts`

- [ ] **Step 1: Failing tests:** create-link actions return the off error with `FEATURE_SHARE_LINKS=false`; revoke still works; `saveCheckinAction` refuses with `FEATURE_CHECKINS=false`; a progress link made while posture was on returns no posture part once `FEATURE_POSTURE=false` (Review Focus 1).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`.
- [ ] **Step 5: Commit** `feat(features): share-link and check-in switches`.

### Task 6: Wire `fees`

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx` (drop `fees` from `TABS` and the fee quick links when off; `?tab=fees` falls back to overview), `.../receipt/page.tsx` (`notFound()`), `src/actions/fees.ts`, `src/actions/charges.ts` (refuse), dashboard fee widgets and CSV export fee columns hidden when off, the patient list "balance" bits if any.
- Test: `tests/actions/fees.test.ts`, `tests/actions/charges.test.ts`, `tests/app/patient-tabs.test.ts` (new: tab list per switch)

- [ ] **Step 1: Failing tests** for refusal and the tab list. **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`.
- [ ] **Step 5: Commit** `feat(features): fees switch`.

### Task 7: Every page works with every module off

**Files:**
- Create: `e2e/modules-off.spec.ts`
- Modify: `playwright.config.ts` (second `webServer` entry on port 3101 with `FEATURE_POSTURE/FLEXIBILITY/AI/SHARE_LINKS/CHECKINS/FEES=false`; project `phone-modules-off` runs only `modules-off.spec.ts`)

- [ ] **Step 1: Write the spec:** log in, add a client, open every tab, `/calendar`, `/settings`, `/dashboard`; assert no "Generate with AI", "Share with client", "Fees" tab, posture or flexibility buttons; `?tab=fees` shows overview; `/patients/<id>/receipt` is 404; no page shows the error screen.
- [ ] **Step 2: Run** `npx playwright test --project=phone-modules-off` — fix any page that crashes.
- [ ] **Step 3: Commit** `test(e2e): app works with every module switched off`.

### Task 8: Treatment sections and fee types per clinic type

**Files:**
- Create: `src/lib/treatment-sections.ts`, migration via `npm run db:generate` (adds `exercise_therapy`, `manual_therapy`, `electrotherapy`, `home_programme`, `advice` — nullable text — to `treatment_plans`)
- Modify: `src/db/schema.ts`, `src/clinics/types.ts` (`practice` block), `src/clinics/pawar.ts`, `src/lib/feeTypes.ts`, `src/lib/gemini.ts` (draft schema + prompt from the clinic's sections), `src/components/TreatmentPlanForm.tsx`, `src/app/(app)/patients/[id]/print/page.tsx`, `src/components/AddChargeForm.tsx`, receipt + fees tab labels, `src/lib/validation.ts` (plan + charge schemas), i18n en/mr (new labels)
- Test: `tests/lib/treatment-sections.test.ts`, `tests/lib/fee-types.test.ts`, `tests/lib/gemini.test.ts`, `tests/components/treatment-plan-form.test.tsx`, `tests/data/treatment.test.ts`

**Interfaces:**
- Produces: `TREATMENT_SECTIONS: readonly { key: TreatmentSectionKey; labelKey: keyof Translations['treatmentPlan']; aiHint: string }[]` with keys `yogaProgram, pranayam, massage, yogaTherapy, dietPlan, medicines, panchkarma, exerciseTherapy, manualTherapy, electrotherapy, homeProgramme, advice`.
- Produces: `sectionsToShow(clinicSections: TreatmentSectionKey[], plan: Partial<Record<TreatmentSectionKey, string | null>> | undefined): TreatmentSectionKey[]` — the clinic's sections in profile order, then any other section that holds text.
- Produces: profile `practice: { type: 'yoga' | 'physio' | 'both'; treatmentSections: TreatmentSectionKey[]; feeTypes: { key: FeeTypeKey; defaultAmount: number | null }[] }`. Pawar: `type: 'yoga'`, today's 7 sections in today's order, today's 4 fee types and amounts.
- Produces: `FEE_TYPES` gains `session` ("Physio session / फिजिओ सत्र") and `assessment` ("Assessment / मूल्यांकन"); `feeTypeLabel(key: string)` returns the label for any known key and the raw key otherwise.
- Produces: `generateTreatmentDraft(context, sections: TreatmentSectionKey[])` returns `Partial<TreatmentDraftFields>` for just those sections; Gemini `required` = those sections.

- [ ] **Step 1: Failing tests:** `sectionsToShow(['exerciseTherapy','advice'], { panchkarma: 'x' })` → `['exerciseTherapy','advice','panchkarma']` (Review Focus 3); Pawar's sections equal the old `PLAN_FIELDS` order; Gemini request schema for physio sections has exactly those `required` keys; `feeTypeLabel('monthly_yoga')` still returns the yoga label in a physio clinic (Review Focus 4); saving a plan writes the new columns.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (form, print page and AI follow `sectionsToShow` / profile sections; charge form offers only the profile's fee types; `saveTreatmentPlanAction` accepts every known section key). **Step 4: Run** `npm test`, `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(clinics): treatment sections and fee types per clinic type` (include `drizzle/` migration).

### Task 9: All wording in locale files

**Files:**
- Modify: the ~27 files with Devanagari outside `src/lib/i18n/` and `src/clinics/` (find with `grep -rlP "[\x{0900}-\x{097F}]" src --include='*.ts' --include='*.tsx' | grep -v "src/lib/i18n\|src/clinics"`), `src/lib/i18n/en.ts`, `mr.ts`
- Create: `tests/lib/i18n/no-inline-marathi.test.ts`

**Interfaces:**
- Server-side error strings use a helper `bilingual(key)` from `src/lib/i18n/server.ts` that returns `"<en> / <mr>"` from the locale files, so existing messages stay word-for-word the same.

- [ ] **Step 1: Write the guard test** (same walker as `no-hardcoded-clinic.test.ts`): no Devanagari in `src/**/*.ts(x)` outside `src/lib/i18n/` and `src/clinics/`. Exception list stays empty unless a string is data, not UI (e.g. Marathi voice prompts) — then it moves into i18n anyway.
- [ ] **Step 2: Run** — FAIL listing the files.
- [ ] **Step 3: Move strings** file by file; existing tests that assert exact messages must still pass unchanged.
- [ ] **Step 4: Run** `npm test`.
- [ ] **Step 5: Commit** `refactor(i18n): all bilingual wording lives in locale files`.

### Task 10: Sunrise Physio profile

**Files:**
- Create: `src/clinics/sunrise.ts`, `public/clinics/sunrise/logo.png`, `public/clinics/sunrise/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (generate from a simple SVG with `sharp`, already a Next dependency; script in `scripts/clinic/make-icons.ts`)
- Modify: `src/clinics/index.ts` (registry), `tests/clinics/profile.test.ts` (every registry profile passes the schema)

**Values (my call, made up):** name "Sunrise Physio Clinic" / "सनराइज फिजिओ क्लिनिक"; short "Sunrise Physio" / "सनराइज फिजिओ"; prefix `SRP`; branches "Baner" and "Wakad" with made-up addresses; contact `+91 90000 00000`, `hello@sunrise-physio.example`; signature "Dr. Asha Kulkarni, PT"; theme blue/teal (primary `#1F5F8B`, accent `#2A9D8F`, accent text `#1E7268`, background `#F5F9FC`, foreground `#14222E`) — contrast test from Task 2 must pass; `practice.type: 'physio'`, sections `exerciseTherapy, manualTherapy, electrotherapy, homeProgramme, advice`, fee types `assessment 800, session 600, package, other`; features: posture **off**, flexibility **off**, ai **off**, shareLinks **on**, checkins **on**, fees **on**.

- [ ] **Step 1:** Add the profile; schema + contrast tests run over it — fix values until green.
- [ ] **Step 2:** `CLINIC_PROFILE=sunrise npm run dev`, click through login, list, new client, every tab, receipt, print, share page.
- [ ] **Step 3: Commit** `feat(clinics): add made-up Sunrise Physio profile for the second-clinic test`.

### Task 11: Sunrise shows nothing of Pawar's; CI runs both profiles

**Files:**
- Create: `e2e/clinic-identity.spec.ts`
- Modify: `playwright.config.ts` (webServer `env` passes `CLINIC_PROFILE` through, default `pawar`), `.github/workflows/ci.yml` (e2e job matrix `clinic: [pawar, sunrise]`; build step also runs with `CLINIC_PROFILE=sunrise`), `e2e/smoke.spec.ts` and `e2e/phone-width.spec.ts` (skip steps for modules the active profile has off, read from `CLINIC_PROFILE`), branch protection note in `docs/environments.md` (required check names change with the matrix — Deepak updates them)
- Modify: `docs/architecture.md`, `docs/backlog.md` (freeze ended 2026-10-25 for the second-clinic work; F1 parked; Projects 2–3 listed)

- [ ] **Step 1: Write the spec** (runs only when `CLINIC_PROFILE=sunrise`): visit login, dashboard, list, client tabs, print, receipt, share page and `/manifest.webmanifest`; collect `document.body.innerText`, every `img[src]`, and computed `--primary`; assert none contain the `FORBIDDEN` list from `tests/clinics/no-hardcoded-clinic.test.ts` (export it to `tests/helpers/pawar-identity.ts` so both use one list) and `--primary` equals Sunrise's.
- [ ] **Step 2: Run** `CLINIC_PROFILE=sunrise npm run e2e` and `npm run e2e` — all green.
- [ ] **Step 3: Commit** `test(e2e): run smoke, phone-width and identity checks for both clinics`.
- [ ] **Step 4: Gate (Deepak):** PR merged → `CLINIC_PROFILE=pawar` in Vercel → `deploy:prod` → Deepak clicks through Pawar on the phone: same look, every module there.
