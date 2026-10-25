# Second clinic test + admin site — design

Date: 2026-10-25 · Status: **draft; Deepak answered the open questions 2026-10-25, waiting on approval** · Builds on `plans/2026-10-07-multi-clinic-direction.md`.

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
4. **Clinic type: yoga and physiotherapy** (Deepak, 2026-10-25). The profile gets a clinic type and lists
   which treatment-plan sections and fee types it uses, so a physio clinic doesn't see "Panchkarma" or
   "monthly yoga". The AI treatment-draft prompt and the printout follow the same list. Stored data keeps its
   columns; only labels and which sections show change. *My call:* a physio set starts with exercise
   therapy, manual therapy, electrotherapy / modalities, home programme and advice; Dr Pawar or a physio
   friend should sanity-check the list before Sunrise goes live.
4a. **All wording in locale files** (Deepak, 2026-10-25). Languages stay English + Marathi for now. Every
   user-facing string still written in code moves into `src/lib/i18n/en.ts` / `mr.ts` (about 170 lines in
   27 files today, mostly "English / मराठी" error messages in actions and validation, plus any
   English-only text). Then a new language is a new locale file. A test fails if a Devanagari string appears
   outside `src/lib/i18n/` or `src/clinics/`.
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
**Shape (my call):** a separate small Next.js app in the same repo (`admin/`), with its own Vercel project
and its own small Neon database (free plan allows 100 projects). It's kept apart so a compromised clinic
site can't reach the controls for all clinics. **Login: GitHub sign-in limited to Deepak's GitHub account**,
not Supabase. Supabase's free plan allows only 2 active projects, and Pawar + Sunrise use both
(Deepak: "we host only 2 now").

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

## Costs (prices checked 2026-10-25 on the providers' pricing pages; they change)
| Service | Free plan | Paid when needed |
|---|---|---|
| **Vercel** (hosting) | Hobby: **personal, non-commercial use only** | Pro **$20/month per developer seat**; one team can hold many projects |
| **Supabase** (login) | **2 active projects** per account; pauses after a week without activity; 50,000 monthly users | Pro **$25/month**, then about **$10/month per extra project** |
| **Neon** (database) | 100 projects, 1 GB each, 6 h restore | Launch: pay per use ($0.106 per compute-hour), 7-day restore |
| **Cloudflare R2** (files) | 10 GB + 1 M writes + 10 M reads a month, per account | $0.015 per GB-month beyond that; downloads free |
| **Gemini** (AI drafts) | small free quota | per use; a few rupees per clinic per month at today's volumes (my estimate) |

**Now (Pawar + Sunrise):** fits free plans, with one caveat. Pawar is a business, so strictly it already
belongs on Vercel Pro, and Hobby's terms don't cover it. Sunrise (a test) is fine on Hobby.
Supabase is then full (2 of 2), which is why the admin site uses GitHub login.

**Per new paying clinic: two ways.**
- **A. We host it in our accounts.** All clinics share one Vercel Pro team ($20/month in total, for one
  developer seat) and one Supabase Pro account ($25/month, plus about $10/month per clinic beyond the first).
  Neon is about $0–10/month per clinic on Launch, depending on use and whether a 7-day restore is wanted.
  R2 is shared and free until the account passes 10 GB. **Roughly: $45/month to start, plus about
  $10–20/month per extra clinic.** Simplest to run; you resell the hosting.
- **B. The clinic owns its accounts.** The clinic signs up to Vercel, Supabase, Neon and Cloudflare itself
  and invites you as admin. Each clinic gets its own free sets, and the data legally sits with the clinic,
  which helps with health-data trust. The clinic still needs Vercel Pro ($20/month) because it's a
  business. **Roughly $20/month per clinic,** paid by the clinic, plus your fee. More setup per clinic.
- **Not this:** you opening several free accounts under your own name to dodge limits. That breaks the
  providers' terms and risks every clinic's account being closed at once.

*My recommendation:* B for the first few clinics, because the cost is predictable, it's the clinic's data,
and it's the clinic's bill. Revisit A once there are enough clinics that one shared bill is cheaper. The
setup script (Project 2) works the same either way: it only needs the account details.

**What to charge** is Deepak's call. The table gives the floor: about $20/month per clinic for hosting,
plus Gemini usage, plus the time to set up (timed in checklist point 6).

## Left to the builder
File layout inside `admin/`, chart library (follow the dataviz skill), exact count queries, logo artwork,
Sunrise's made-up details, cache mechanics.

## Decisions (Deepak, 2026-10-25)
1. Product is for **yoga and physiotherapy clinics**: plan sections, fee types and AI prompt per profile.
2. Languages stay **English + Marathi**; hard-coded strings move to locale files so a language is one file later.
3. The **ready-to-market checklist** above is agreed.
4. **Host only 2 clinics now** (Pawar + Sunrise). Costs for a new paying clinic are in *Costs*; each new
   clinic is either charged for hosting or gets its own accounts.
