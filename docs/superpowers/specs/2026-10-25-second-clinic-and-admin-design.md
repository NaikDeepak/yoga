# Second clinic test + admin site — design

Date: 2026-10-25 · Status: **draft, waiting on Deepak** · Builds on `plans/2026-10-07-multi-clinic-direction.md`.

## Why
Deepak wants to market the app to other clinics. Before that he needs proof that the same code can run a
second clinic with its own address, database, files, login, look and set of modules, and that he can
run all clinics from one place. The proof is a **made-up clinic used only by Deepak**.

This work **ends the feature freeze** of 2026-10-07. F1 (pain map + questionnaires) stays parked.

## Goals
1. One codebase runs two clinics: Pawar (real) and **Sunrise Physio** (made up; name is a placeholder).
2. Each clinic has its own copy: Vercel project + URL, Neon database, R2 bucket, Supabase Auth project.
3. A clinic's name, logo, colours (on screen too, not just print), branches, contact, client-code prefix and
   wording come from its profile. **Nothing of Pawar's ever shows on Sunrise.**
4. Modules turn on or off per clinic, and the switch really hides them: pages, actions, share links, data.
5. **One admin site** for Deepak (and Claude, via a command-line tool): every clinic, its switches, and
   its usage counts per week.
6. Setting up a clinic and releasing to all clinics are scripts, so the test is also a rehearsal of
   onboarding a paying clinic.

## Non-goals
- One shared multi-tenant database. Isolation stays "separate copies".
- Clinic staff editing their own profile or switches (admin is Deepak's only).
- Creating a clinic from the admin site. Setting one up stays a scripted, guided step.
- Billing, sign-up for clinics, marketing site.
- New clinical features (F1 etc.).

## Anti-goals (would make this a failure even if it "works")
- Any client name, phone or health detail leaving a clinic's own database, including to the admin site.
- A Pawar login working on Sunrise, or the reverse.
- Pawar's site changing behaviour or look because of this work.
- A per-clinic fork or `if (clinic === 'sunrise')` in core code.
- A clinic going down because the admin site is down.

## What exists today (checked 2026-10-25)
- `src/clinics/` profile chosen by `CLINIC_PROFILE`. It covers names, logo, icons, print colours, contact,
  signature, branches, prefix and a `features` block.
- **Switches are mostly not wired.** Only posture is read, through `isPostureEnabled()`, and in production
  that function ignores the profile and listens only to `FEATURE_POSTURE`. `flexibility`, `ai`,
  `shareLinks` and `checkins` are declared but never read. `isFeatureEnabled()` has no callers. Fees has
  no switch.
- `resolveClinicProfile()` silently falls back to `pawar` when `CLINIC_PROFILE` is unset. A Sunrise
  deploy missing that setting would show Pawar's identity.
- The on-screen theme is hard-coded in `globals.css` (green / amber). Profile colours drive only print
  and the installed-app colours.
- Core wording is yoga/Ayurveda-specific: treatment plan fields `yogaProgram`, `pranayam`, `massage`,
  `yogaTherapy`, `dietPlan`, `medicines`, `panchkarma` (also in the Gemini prompt and printout), and fee
  type `monthly_yoga`.
- Every label is required in English and Marathi (`name.mr`, i18n en/mr only).
- Release scripts (`deploy:prod`, `db:migrate:prod`, `db:status:prod`) know one clinic: `PROD_DATABASE_URL`,
  `PROD_SITE_URL` and one linked Vercel project.
- Vercel cron: `/api/ping` daily at 03:00 UTC.

## Three projects, in order, each with a gate

### Project 1 — Product ready for any clinic (code only, no new services)
1. **Profile fails closed.** In production, missing or unknown `CLINIC_PROFILE` stops the app at start-up.
   It must be set for the build on Vercel too, because browser code imports the profile.
2. **On-screen colours from the profile.** The root layout writes the profile's colours as the CSS
   variables `globals.css` already uses (primary, accent, accent text, background, cream). Pawar's values
   reproduce today's look exactly. A test checks every profile for contrast (text 4.5:1, large/bold 3:1),
   reusing `contrastOnWhite`.
3. **Every switch wired.** Modules: `posture`, `flexibility`, `ai`, `shareLinks`, `checkins`, `fees`
   (new). For each: hide the entry points, refuse the server actions, and 404 the share-link parts when off.
   Tests run each module on and off. One function decides a switch:
   **env kill switch (`FEATURE_X=false`) → admin override (Project 3) → profile default.** Posture keeps its
   current production behaviour for Pawar (on via env) until Project 3 replaces it.
4. **Clinic-type wording** (needs Deepak's answer, see Questions): treatment-plan sections and fee types
   become profile-driven, so a physio clinic doesn't see "Panchkarma". Stored data keeps its columns;
   only labels and which sections show change.
5. **Sunrise profile** `src/clinics/sunrise.ts`: name, a generated logo and icons, blue/teal colours,
   two made-up branches, prefix `SRP`, made-up contact, posture + AI **off**, fees + share links **on**.
6. **Guard test extended:** with `CLINIC_PROFILE=sunrise`, rendered pages, printouts, receipts, the share
   page and the manifest contain no Pawar text, phone, logo path or colour.
7. **Gate:** `CLINIC_PROFILE=sunrise npm run dev` (mock mode) clicks through cleanly. The e2e smoke and
   phone-width specs pass under both profiles, with CI running both. Pawar production looks and behaves
   the same after deploy.

### Project 2 — Sunrise's own copy + release for every clinic
1. **Prerequisite (Deepak):** the scoped R2 token task in the backlog. Each clinic gets its **own bucket
   and its own token** limited to that bucket. Pawar moves to a scoped token first.
2. **Setup script** (`scripts/clinic/setup.ts`, guided, run with Deepak). It creates or links the Neon
   project, migrates and seeds the exercise library, creates the R2 bucket, and creates the Vercel project
   with env vars (`CLINIC_PROFILE`, DB, R2, Supabase, `APP_URL`, `CRON_SECRET`). It prints only names,
   never values. Steps a script can't do (Supabase project, R2 token) are printed as a checklist.
3. **Supabase Auth:** a new project per clinic, with public sign-up off and Deepak creating logins. Never
   shared with Pawar.
4. **Per-clinic config on the Mac:** one file per clinic outside the repo (e.g.
   `~/.config/clinics/<slug>.env`, `chmod 600`) holding that clinic's DB URL, site URL and Vercel project.
   The `*:prod` scripts take `--clinic <slug>`, default `pawar`, so today's commands keep working.
5. **Release to all:** `npm run release:all` runs the same migration and deploy for each clinic, **Pawar first**.
   It stops at the first clinic whose smoke test fails. The smoke test now also checks that `/login` shows
   that clinic's name.
6. **Gate:** Sunrise is live at its own URL. Deepak can log in there and his Pawar login is refused. He
   adds a client, a visit, a document upload and a share link. Pawar's database and bucket counts don't
   change. A no-op release goes out to both, Pawar first.

### Project 3 — Admin site
**Shape (my call):** a separate small Next.js app in the same repo (`admin/`), with its own Vercel project,
its own small Neon database and its own Supabase Auth project (or one login method that works only for
Deepak). It's kept apart so a compromised clinic site can't reach the controls for all clinics.

- **Clinics list:** name, URL, app version, last check-in time, open problems (e.g. no check-in for 2 days).
- **Switches:** per clinic, per module: on / off / "use profile default". The clinic reads its switches
  from the admin API, caches them for ~60 seconds, and **stores the last known set in its own database**.
  If the admin site is down, it uses that stored set, and if there's none, the profile defaults. An env
  kill switch still beats everything.
- **Usage:** each clinic sends weekly **counts only**: clients added, visits, assessments (posture,
  flexibility), documents uploaded, share links created/opened, AI drafts, staff logins, active staff.
  Counts are computed from the clinic's own tables and `audit_log`. Sent once a day on the existing
  `/api/ping` cron. Shown as small charts per clinic plus a table.
- **Trust between the sites:** each clinic has its own secret, shared only with the admin site, and signs
  its requests with it. The admin site accepts counts and serves switches only for the clinic that secret
  belongs to.
- **Command line for Claude:** `npm run admin -- clinics | usage <slug> | switch <slug> <module> on|off`,
  with the token read from a `chmod 600` file. Changing a switch asks for confirmation.
- **Every switch change is logged** (who, when, old → new) on the admin site.
- **Gate:** Deepak turns AI on for Sunrise in the admin site and sees it appear there within a minute. He
  turns it off and it disappears (pages and actions). Usage charts show Sunrise's test activity next to
  Pawar's. With the admin site stopped, both clinics keep working with their last switches.

## Proposed "ready to market" checklist (my proposal; Deepak to confirm or change)
1. Sunrise live on its own URL, database, bucket and login; nothing Pawar-specific visible anywhere on it,
   including printouts and share pages.
2. One week of Deepak using Sunrise as a pretend physio, with every bug logged and fixed.
3. Switches proven from the admin site, on and off, for every module.
4. A real release went to both clinics through `release:all`, Pawar first.
5. Usage visible for both clinics in the admin site.
6. Setting up a third clinic, timed from the script and written down: the onboarding cost.

## Costs and limits (verify at setup; numbers change)
- Each copy is designed to fit free tiers for a test. Supabase's free plan limits active projects and pauses
  idle ones. Pawar + Sunrise + admin is three Auth projects, so a paid plan or another login approach may be
  needed. Neon's free plan limits projects too.
- Vercel's free (Hobby) plan isn't for commercial use. Paying clinics will need Vercel Pro. The test can
  stay on Hobby.
- Hobby crons run daily, which is why switches are pulled on request (cached) rather than pushed.

## Left to the builder
File layout inside `admin/`, chart library (follow the dataviz skill), exact count queries, logo artwork,
Sunrise's made-up details, cache mechanics.

## Questions for Deepak (answers change what gets built)
1. **Clinic type wording.** Is the product for **yoga/Ayurveda clinics only**, or for **physio clinics in
   general**? If physio, treatment-plan sections (Panchkarma, Pranayam…), fee types and the AI prompt
   become per-profile (adds about a third to Project 1).
2. **Languages.** Does every clinic get English + Marathi, or do languages become per-clinic (e.g. English +
   Hindi)? Per-clinic languages are a big job, and could wait until a real clinic asks.
3. **Ready-to-market checklist** above: right, or what's missing?
4. **Paying for services** if free tiers run out (a third Supabase project, Vercel Pro later): OK?
