# Second clinic + admin site — step-by-step roadmap

> Master execution order for `specs/2026-10-25-second-clinic-and-admin-design.md`. Every step has an owner,
> a **Verify** line (the exact check that proves it's done) and stops at a **Gate** where Deepak says OK
> before the next phase. Tick a box only after its Verify passes. Detailed task plans:
> Phase 1 → `plans/2026-10-25-clinic-ready-product.md`; Phases 2 and 3 get their own detailed plans
> (written at the start of each phase, because the login spike in 2.1 decides their shape).

**Rules for every code step**
- Claim in `scripts/collab.sh` before editing; release after merge.
- Each PR: `npm run typecheck`, `npm test` (coverage gate), `npm run build`, `npm run e2e` green locally; CI
  checks green; Kilo review comments answered.
- **Merge and `deploy:prod` only with Deepak's OK for that PR.**
- After each deploy: `deploy:prod` smoke passes, then Deepak spends 2 minutes on Pawar on the phone (login, a
  client, the treatment tab) — "looks and works as before".
- Nothing with client data (screenshots, Lighthouse, dumps) goes into the repo or a chat.

Owners: **C** = Claude, **D** = Deepak.

---

## Phase 0 — Prepare (this week)

- [ ] **0.1 (D)** Approve the spec and this roadmap; merge PR #73.
  **Verify:** PR #73 merged; `docs/superpowers/specs/2026-10-25-second-clinic-and-admin-design.md` on `main`.
- [ ] **0.2 (D)** Add `CLINIC_PROFILE=pawar` to Vercel Production (`vercel env add CLINIC_PROFILE production`).
  **Verify (C):** `vercel env ls production` lists `CLINIC_PROFILE`.
- [ ] **0.3 (D, any time before Phase 2)** Create the scoped R2 token (steps in `docs/backlog.md`).
  **Verify (C):** token can list/put/delete in `patient-files` only; Vercel updated; `deploy:prod` green;
  upload + delete checked live; old Admin token deleted by D.
- [ ] **0.4 (D)** Decide when Pawar moves to Vercel Pro (Hobby's terms are non-commercial). Not blocking.
  **Verify:** decision written in `docs/backlog.md`.

**Gate 0:** spec merged, `CLINIC_PROFILE` set.

---

## Phase 1 — Product ready for any clinic (code only, no new services)

Four PRs, each deployed to Pawar before the next starts. Task numbers refer to `plans/2026-10-25-clinic-ready-product.md`.

- [x] **1.1 (C) PR-A "foundation"** — Tasks 1–3: profile fails closed, on-screen colours from the profile,
  one switch rule + fees switch.
  **Verify:**
  - `CLINIC_PROFILE= LOCAL_MOCK=false npm run build` fails with "CLINIC_PROFILE is not set"; with
    `CLINIC_PROFILE=pawar` it builds.
  - `npx vitest run tests/clinics tests/lib/features.test.ts` green, including the contrast test.
  - Side-by-side screenshots of login, client list and client page (`main` vs branch, mock data only):
    no visible difference.
  - After deploy: Pawar unchanged on the phone; posture still shows.
- [x] **1.2 (C) PR-B "switches"** — Tasks 4–7: flexibility, AI, share links, check-ins and fees switches; the
  modules-off end-to-end test.
  **Verify:**
  - Each module's tests show "off" hides the button and the action refuses with "switched off".
  - `npx playwright test --project=phone-modules-off` green (every page opens with every module off).
  - `npm run e2e` (all on) green.
  - After deploy: Pawar unchanged (all modules on).
- [ ] **1.3 (C) PR-C "clinic type + wording"** — Tasks 8–9: treatment sections and fee types per clinic type
  (one additive migration), all wording in locale files.
  **Verify:**
  - `npm run db:generate` produced one migration that only adds 5 nullable columns; `migration-reviewer`
    skill run on it.
  - Test proves a plan with Panchkarma text still shows in a physio clinic; old fee types keep their labels.
  - `no-inline-marathi` guard test green; existing message tests unchanged.
  - Release: `npm run db:status:prod` → `db:migrate:prod` (D types "migrate prod") → `deploy:prod`.
    Pawar's treatment tab, printout and charge form show the same sections and fee types as before.
- [ ] **1.4 (C) PR-D "Sunrise + both clinics in CI"** — Tasks 10–11: Sunrise profile and icons, identity e2e,
  CI runs both profiles; docs (`architecture.md`, `environments.md`, `backlog.md`: freeze ended, F1 parked).
  **Verify:**
  - `CLINIC_PROFILE=sunrise npm run dev`: blue/teal, Sunrise name and logo, physio sections, no posture or AI.
  - `CLINIC_PROFILE=sunrise npm run e2e` green, including `clinic-identity.spec.ts` (no Pawar text, image
    or colour on any page, printout, receipt, share page or manifest).
  - CI shows e2e for `pawar` and `sunrise`; D updates the required check names in branch protection.
- [ ] **1.5 (D)** Click through Sunrise locally on the Mac for 15 minutes (C starts it, D drives).
  **Verify:** D's list of anything odd is empty or each item is fixed in a follow-up PR.

**Gate 1:** Pawar production unchanged after all four deploys; Sunrise works locally; D says "Phase 1 done".

---

## Phase 2 — Sunrise's own copy, login off Supabase, backups, release to all

C writes `plans/<date>-clinic-copies-and-login.md` (detailed tasks) at the start of this phase; the steps
below are its outline and verification.

- [ ] **2.1 (C) Login spike (half a day, throwaway branch, mock data only).** Try Neon's managed login
  against the questions in spec Project 2 step 0.
  **Verify:** a written result in the phase plan: each question yes/no with evidence, and the choice
  (managed login or the library). **D approves the choice.**
- [ ] **2.2 (C) Build the new login behind a switch** (`LOGIN_PROVIDER=supabase|neon`, default `supabase`), so
  Pawar can switch and switch back.
  **Verify:** auth tests cover sign-in, wrong password, sign-out, expired session, no public sign-up,
  every protected page and action refusing without a session, share links still login-free; e2e green with
  both providers.
- [ ] **2.3 (C) Security review** — `phi-security-reviewer` and `security-review` skills on the branch.
  **Verify:** every finding fixed or written down as accepted by D.
- [ ] **2.4 (C+D) Pawar cut-over.** D recreates staff logins on the new login; C switches
  `LOGIN_PROVIDER=neon` in Vercel and deploys.
  **Verify:** every Pawar staff member logs in; an old Supabase session is refused; logout works; e2e smoke
  passes against production (`deploy:prod` smoke). Supabase project paused (not deleted) for 2 weeks, then
  deleted by D. Keep-alive cron removed.
- [ ] **2.5 (C) Nightly backups.** GitHub Action `pg_dump` per clinic → private R2 folder, 30 days kept.
  **Verify:** first night's dump present; restore drill into a throwaway Neon branch shows equal row counts
  (counts only); branch deleted; never a connection string in logs.
- [ ] **2.6 (C) Per-clinic config + scripts.** `~/.config/clinics/<slug>.env` (chmod 600); `*:prod` scripts take
  `--clinic <slug>` (default `pawar`); `release:all` (Pawar first, stop on first failure); smoke checks the
  clinic name on `/login`.
  **Verify:** `npm run db:status:prod` and `npm run db:status:prod -- --clinic pawar` print the same;
  script tests cover "unknown clinic" and "missing file"; a dry run of `release:all` lists Pawar then Sunrise.
- [ ] **2.7 (C+D) Set up Sunrise for real** with `scripts/clinic/setup.ts`: Neon project, migrate + seed, R2
  bucket + its own scoped token (D creates the token), Vercel project + env vars, D's first login.
  **Time the whole thing** (checklist point 6).
  **Verify:** Sunrise live at its own URL; D logs in there; D's Pawar login is refused there; D adds a
  client, visit, document upload and share link; Pawar's `db:status:prod` counts and R2 object count unchanged.
- [ ] **2.8 (C) First `release:all`** with a no-op change.
  **Verify:** both clinics deployed, Pawar first, both smoke tests green.

**Gate 2:** Sunrise live and isolated; Pawar on the new login; backups proven; D says "Phase 2 done".

---

## Phase 3 — Admin site

C writes `plans/<date>-admin-site.md` at the start of this phase.

- [ ] **3.1 (C) Admin app skeleton** (`admin/`, own Vercel project + small Neon project, GitHub sign-in limited
  to D's account).
  **Verify:** D signs in with GitHub; any other GitHub account is refused; the clinics list shows Pawar and
  Sunrise from the admin database.
- [ ] **3.2 (C) Switches API + clinic side.** Clinic pulls its switches (signed with its own secret), caches
  ~60 s, stores the last set in its own database. Precedence: env kill switch → admin → profile.
  **Verify:** tests for signature check, cache, admin-down fallback (last stored set, then profile);
  turning AI on for Sunrise in admin shows it there within a minute; off hides it again.
- [ ] **3.3 (C) Usage counts.** Daily on `/api/ping`: weekly counts only (clients, visits, assessments,
  documents, share links, AI drafts, logins, active staff) → admin. Charts per clinic.
  **Verify:** a test asserts the payload has only numbers and dates (no names, phones, notes); charts show
  Sunrise's test activity and Pawar's real activity.
- [ ] **3.4 (C) Command line for Claude** (`npm run admin -- clinics | usage <slug> | switch <slug> <module> on|off`)
  and a log of every switch change.
  **Verify:** each command works against the live admin site; a switch asks to confirm; the change log
  shows who, when, old → new.
- [ ] **3.5 (C+D) Admin-down drill.** Stop the admin deployment for 10 minutes.
  **Verify:** both clinics keep working with their last switches; counts resume afterwards.

**Gate 3:** D runs both clinics from the admin site; D says "Phase 3 done".

---

## Phase 4 — Ready to market (the agreed checklist)

- [ ] **4.1** Nothing Pawar-specific anywhere on Sunrise (automated in 1.4, re-checked live).
- [ ] **4.2 (D)** One week using Sunrise as a pretend physio; every bug logged in `docs/backlog.md` and fixed.
- [ ] **4.3** Every module switched on and off from the admin site (3.2).
- [ ] **4.4** A real release went to both clinics through `release:all`, Pawar first (2.8, then a real one).
- [ ] **4.5** Usage visible for both clinics in admin (3.3).
- [ ] **4.6** Third-clinic setup timed and written down; cost sheet's setup hours updated from it.

**Gate 4:** D starts marketing.
