# Clinic copies and login, part 1: login off Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pawar signs in through Neon's managed login (users in Pawar's own Neon database), with Supabase kept as a one-switch fallback until it is retired.

**Architecture:** Upgrade to Next.js 16 first (the login package targets it). Then add a `LOGIN_PROVIDER=mock|supabase|neon` seam: `src/lib/auth.ts` stays the one place pages and actions ask, and gains a neon branch that reads the session uncached. A tight allowlisted `/api/auth/*` route, a deploy guard, and a real-provider smoke script against the Sunrise preview come before Pawar is touched. Pawar switches by changing a Vercel env var and redeploying.

**Tech Stack:** Next.js 16, React 19, `@neondatabase/auth` (exact pinned beta), Drizzle, Vitest + PGlite, Playwright (mock mode), Vercel, Neon CLI (`NEON_PROFILE=main`).

**Spec:** `docs/superpowers/specs/2026-10-25-second-clinic-and-admin-design.md` (Project 2, step 0). Roadmap: `docs/superpowers/plans/2026-10-25-second-clinic-roadmap.md` (Phase 2, steps 2.2–2.4). Evidence: the 2.1 spike result, kept in the git-ignored workspace `.superpowers/sdd/2026-10-27-clinic-copies-and-login/spike-result.md`.

**Scope.** This is part 1, covering roadmap 2.2–2.4 plus the Next 16 upgrade and the optional region move. Part 2 covers 2.5 backups, 2.6 per-clinic config, 2.7 the real Sunrise setup and 2.8 `release:all`. It gets written after the cut-over, because it builds on `create-login`, on how the cut-over went, and on the `neon_auth` schema now sitting in each clinic's database. **Part 2 must back up and restore-drill the `neon_auth` schema as well as `public`.**

## Global Constraints

- No public sign-up, ever. Only Deepak creates logins. The Neon setting `--disable-sign-up true` is on before any clinic URL is trusted, and our `/api/auth/*` allowlist blocks sign-up even if that setting drifts.
- `src/lib/auth.ts` stays the one place pages and actions ask about the login. Share links (`/s/…`), `/login`, `/manifest.webmanifest` stay login-free. `/api/*` answers 401 JSON, never a redirect.
- Tests never touch real services. `@/lib/neon-auth` is mocked with `vi.mock`, and e2e stays in mock mode.
- `@/lib/neon-auth` is only ever loaded lazily (`await import('@/lib/neon-auth')`); a top-level import breaks Vitest.
- The session read is uncached (`disableCookieCache`). A signed-out or revoked cookie is refused at once, not after 5 minutes.
- Pin `@neondatabase/auth` to an exact version, with no `^`.
- Fail closed: production with `LOGIN_PROVIDER` unset or unknown throws, and `deploy:prod` refuses while Vercel Production lacks `LOGIN_PROVIDER`.
- **Rollback stays real until part 1's last PR.** `src/lib/supabase/*`, the `@supabase/*` packages and the Supabase keep-alive in `/api/ping` all stay until Supabase is retired (PR-H, at least 2 weeks after the cut-over).
- Never print or commit a connection string, cookie secret, auth URL with credentials, or password. Scripts read passwords through a hidden prompt (no echo, no argv). Secrets live in chmod-600 files outside the repo. Redirect `neon … create` output that may contain secrets.
- Merges and `deploy:prod` need Deepak's OK for each PR. Every user-facing string is "English / मराठी". `docs/architecture.md` is updated in the same commit as any structural change.
- Claim in `scripts/collab.sh` before editing, and release after the merge.

## Review Focus

1. **Replayed or revoked cookie:** a session cookie copied before sign-out (or before an admin revoke) must be refused on the very next page or action, not 5 minutes later. Covered by the Task 4 unit test (reader called with `disableCookieCache`) and the Task 9 smoke step "replayed cookie refused".
2. **Allowlist path variants:** a trailing slash, different case (`Sign-Up/Email`), an encoded slash (`sign-up%2Femail`), `..` segments, and the wrong method on an allowed path (GET `sign-in/email`) must all answer 404. Covered by Task 7 tests.
3. **Old Supabase cookie after the switch:** a browser still holding `sb-*` cookies gets `/login`, not a 500 and not a session. Covered by the Task 6 test and the Task 12 cut-over check.
4. **Missing provider in production:** `NODE_ENV=production` with `LOGIN_PROVIDER` unset or misspelled throws, and the deploy refuses. Covered by Tasks 3 and 8.
5. **Public paths under the new proxy:** `/s/<token>`, `/manifest.webmanifest`, `/login` stay public with the neon provider, and `/api/patients/search` answers 401 JSON with no session. Covered by Task 6 tests and the Task 9 smoke.

---

## PR-E — Next.js 16 upgrade (branch `chore/next-16`)

### Task 1: Upgrade Next.js and clear the upgrade warnings

**Files:**
- Modify: `package.json`, `package-lock.json`
- Rename: `src/middleware.ts` → `src/proxy.ts` (export renamed `proxy`, same matcher)
- Modify: `src/lib/storage.ts`, `src/db/seed-exercises.ts` (Turbopack whole-project trace warnings)
- Modify: `docs/architecture.md`, `docs/environments.md` (Next version, proxy file name)

**Interfaces:**
- Produces: `src/proxy.ts` exporting `proxy(request)` + `config`, still delegating to `updateSession` from `src/lib/supabase/middleware.ts`. Task 6 builds on it.

- [ ] **Step 1:** `npm i next@16 eslint-config-next@16` (the latter only if present). Record the exact installed version in the PR body. `npm ci` must pass with no `--legacy-peer-deps`.
- [ ] **Step 2:** Rename the file and the export per Next 16's proxy convention. Keep the matcher byte-identical.
- [ ] **Step 3:** Run `npm run build` and read the warnings. Remove the 5 "dynamic filesystem access traces the whole project" warnings by scoping the paths: use `/* turbopackIgnore: true */` on the dynamic `path.resolve(process.cwd(), …)`, or static path segments. Behaviour stays unchanged, and the existing `tests/lib/storage.test.ts` and seed tests still pass.
- [ ] **Step 4:** Check the Vercel project's Node version is ≥ 20.9 (`vercel project inspect` or the dashboard). CI already uses Node 22.
- [ ] **Step 5: Verify.** `npm run typecheck`, `npm run coverage`, and `npm run build` with no Turbopack trace warnings. Then `npm run e2e`, `CLINIC_PROFILE=sunrise npm run e2e`, and `CLINIC_PROFILE=sunrise npm run build` (CI's fake env), all green.
- [ ] **Step 6: Commit** `chore: upgrade to Next.js 16 (middleware → proxy)`.

### Task 2: Prove the Vercel build before production

- [ ] **Step 1:** Push the branch, open PR-E, and get CI green (all 3 required checks).
- [ ] **Step 2:** `vercel deploy --yes` gives a Sunrise preview. Check `/login` is 200, signing in works, a client page opens, `/s/<random>` is 404, and the identity has no Pawar terms.
- [ ] **Step 3:** With Deepak's OK, merge, then `npm run deploy:prod` (its smoke runs). Deepak does the 2-minute phone check on Pawar.
- [ ] **Step 4:** Tick the PR-E line in the roadmap's Phase 2 section.

## PR-F — Server region to Singapore (optional; only with Deepak's OK)

### Task 2a: Move functions to `sin1`

**Files:** Modify `vercel.json` (add `"regions": ["sin1"]`) and `docs/environments.md`.

- [ ] **Step 1:** Add the region and deploy a preview. Check that the `x-vercel-id` response header ends in `sin1::…`.
- [ ] **Step 2:** With Deepak's OK, merge and run `deploy:prod`. Then check `x-vercel-id` on `https://yoga-ten-tau.vercel.app/login` shows `sin1`, and that the cron still runs the next day (Vercel → Crons log).
- [ ] **Step 3: Commit** `chore(vercel): run functions in sin1, next to the database`.

## PR-G — New login behind a switch (branch `feat/neon-login`)

### Task 3: `loginProvider()` seam and session-user shape

**Files:**
- Create: `src/lib/login-provider.ts`
- Modify: `src/lib/auth.ts` (export `SessionUser`; the supabase branch maps to it)
- Test: `tests/lib/login-provider.test.ts`, `tests/lib/auth.test.ts`

**Interfaces:**
- Produces: `type LoginProvider = 'mock' | 'supabase' | 'neon'`; `loginProvider(): LoginProvider`; `type SessionUser = { id: string; email: string | null }` (exported from `src/lib/auth.ts`).

- [ ] **Step 1: Failing tests** in `tests/lib/login-provider.test.ts`:
  - `isLocalMock()` true → `'mock'`, whatever `LOGIN_PROVIDER` says;
  - `LOGIN_PROVIDER=neon` → `'neon'`; `=supabase` → `'supabase'`;
  - unset, `NODE_ENV=development` or `test` → `'supabase'` (today's default);
  - unset, `NODE_ENV=production` → throws `LOGIN_PROVIDER must be set in production (supabase or neon)`;
  - `LOGIN_PROVIDER=Neon` or `clerk` → throws `Unknown LOGIN_PROVIDER "…"` (any NODE_ENV).
  In `tests/lib/auth.test.ts`: the supabase branch returns exactly `{ id, email }`, with no other fields from the Supabase user.
- [ ] **Step 2:** Run `npx vitest run tests/lib/login-provider.test.ts tests/lib/auth.test.ts` and expect FAIL.
- [ ] **Step 3:** Implement. `getSessionUser()` switches on `loginProvider()`. The mock and supabase branches keep today's logic and return `SessionUser`.
- [ ] **Step 4:** The tests PASS, and `npm run typecheck` is clean (the 24 callers use only `id` and `email`).
- [ ] **Step 5: Commit** `feat(auth): LOGIN_PROVIDER seam, fail closed in production`.

### Task 4: Neon session reader

**Files:**
- Create: `src/lib/neon-auth.ts`
- Modify: `src/lib/auth.ts` (neon branch), `package.json` (`@neondatabase/auth` exact version)
- Test: `tests/lib/auth.test.ts` (with `vi.mock('@/lib/neon-auth', …)`)

**Interfaces:**
- Produces from `src/lib/neon-auth.ts`:
  - `getNeonAuth()`: memoised `createNeonAuth({ baseUrl: NEON_AUTH_BASE_URL, cookies: { secret: NEON_AUTH_COOKIE_SECRET } })`, built on first call; throws `NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set` if either is missing.
  - `readNeonSession(): Promise<SessionUser | null>`: the session read through a `createAuthServer` instance whose cookie context ignores writes during render (the same trick as `src/lib/supabase/server.ts`), called with `query: { disableCookieCache: 'true' }`.
- Consumes: `SessionUser` (Task 3).

- [ ] **Step 1: Failing tests:**
  - with provider neon, `getSessionUser()` returns what `readNeonSession` resolves, and `requireUser()` redirects to `/login` when it resolves `null`;
  - the neon module is not imported when the provider is mock or supabase (the mock factory records whether it was loaded);
  - with `readNeonSession` mocked to throw, `getSessionUser()` returns `null` and logs through `safeErrorMessage`. A login-service outage then sends people to `/login`, not a 500.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Install the latest `@neondatabase/auth` as an exact version. Implement `neon-auth.ts` against the SDK's server exports (check `node_modules/@neondatabase/auth` for `createNeonAuth`, `createAuthServer`). Add the neon branch in `auth.ts` via `await import('@/lib/neon-auth')`.
- [ ] **Step 4:** Tests PASS. `npm run coverage` holds the 80% gate (`neon-auth.ts` is a thin SDK wrapper: if it can't be covered without the network, exclude it in `vitest.config` with a one-line reason).
- [ ] **Step 5: Commit** `feat(auth): read Neon sessions uncached`.

### Task 5: Sign-in and sign-out actions; remove self-registration

**Files:**
- Modify: `src/actions/auth.ts`, `src/app/login/page.tsx` (drop the "registered" notice and the register link), `src/lib/auth-paths.ts` (drop `/register`), `src/lib/i18n/en.ts` + `mr.ts` (drop `auth.register*` and `accountRegistered` keys only if nothing else uses them)
- Delete: `src/app/register/page.tsx`
- Test: `tests/actions/auth.test.ts`, `tests/lib/auth-paths.test.ts`

**Interfaces:**
- Consumes: `loginProvider()`, `getNeonAuth()`.
- Produces: `signInAction(formData)` and `signOutAction()`, each with mock, supabase and neon branches. `signUpAction` no longer exists.

- [ ] **Step 1: Failing tests (neon):**
  - right credentials: `getNeonAuth().signIn.email` is called with `{ email, password }`, then REDIRECT `/dashboard`;
  - an `error` result, or a thrown error: REDIRECT `/login?error=1`, and the password never appears in a logged message;
  - sign-out calls `signOut` and REDIRECTs `/login`, even when `signOut` throws.
  Also: `isPublicPath('/register')` is `false`; `@/actions/auth` exports no `signUpAction`; mock and supabase tests unchanged.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Delete the register page, its strings, and its links.
- [ ] **Step 4:** Tests PASS. `npm run e2e` is green (mock login unchanged; nothing in e2e visits `/register`, so grep to confirm).
- [ ] **Step 5: Commit** `feat(auth): Neon sign-in/out; remove self-registration`.

### Task 6: Proxy session check for the neon provider

**Files:**
- Rename: `src/lib/supabase/middleware.ts` → `src/lib/session-middleware.ts` (the supabase branch keeps importing `@supabase/ssr`)
- Modify: `src/proxy.ts` (import path)
- Test: `tests/lib/session-middleware.test.ts` (new; mock `@/lib/neon-auth`)

**Interfaces:**
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>`, same name and contract as today.

- [ ] **Step 1: Failing tests (provider neon):**
  - no session on `/dashboard` → 307 `/login`;
  - no session on `/s/abc`, `/login` or `/manifest.webmanifest` → passes through (no redirect);
  - no session on `/api/patients/search` → passes through, so the route returns its own 401;
  - session on `/login` → 307 `/dashboard`;
  - request carrying only old `sb-…-auth-token` cookies on `/dashboard` → 307 `/login`;
  - the session check throws → 307 `/login` for a page, pass-through for `/api/*`.
  The neon branch calls the SDK's middleware or session check only for non-public, non-`/api` paths, plus `/login`.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Keep the mock and supabase branches unchanged apart from dropping `/register`.
- [ ] **Step 4:** Tests PASS, `npm run e2e` is green, and `docs/architecture.md` names the new file.
- [ ] **Step 5: Commit** `feat(auth): proxy checks Neon sessions`.

### Task 7: Allowlisted `/api/auth/*` route

**Files:**
- Create: `src/lib/auth-routes.ts`, `src/app/api/auth/[...path]/route.ts`
- Test: `tests/lib/auth-routes.test.ts`, `tests/app/api/auth/route.test.ts`

**Interfaces:**
- Produces: `isAllowedAuthRoute(method: string, segments: string[]): boolean`.

- [ ] **Step 1: Failing tests:**
  - allowed:
    - `POST sign-in/email`
    - `POST sign-out`
    - `GET get-session`
    - `POST request-password-reset`
    - `POST reset-password`
    - `GET reset-password/<token>`
  - refused:
    - `POST sign-up/email`
    - `POST admin/create-user`
    - `GET admin/list-users`
    - `POST organization/create`
    - `GET sign-in/email` (wrong method)
    - `POST Sign-In/Email` (case)
    - `['sign-in','email','']` (trailing slash)
    - `['sign-up%2Femail']` and `['sign-up/email']` (encoded or embedded slash)
    - `['..','admin','create-user']`
    - `[]`
    - `reset-password/a/b`
  - route test: provider not neon → every method answers 404; an allowed path with provider neon is handed to `getNeonAuth().handler()`; a refused path answers 404 without calling it.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement with an exact match on (method, joined segments). Reject any segment containing `/`, `%`, `.` or uppercase. The token segment must match `^[A-Za-z0-9_-]{1,256}$`.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat(auth): allowlisted Neon auth route; everything else 404`.

### Task 8: Keep-alive and deploy guard follow the provider

**Files:**
- Modify: `src/app/api/ping/route.ts`, `scripts/prod/deploy.ts`, `src/lib/prod-ops.ts` (if a pure helper is needed)
- Test: `tests/app/api/ping.test.ts` (existing or new), `tests/lib/prod-ops.test.ts`

- [ ] **Step 1: Failing tests:**
  - with `LOGIN_PROVIDER=supabase`, ping still does both Supabase pings, so the 2-week fallback can't auto-pause;
  - with `LOGIN_PROVIDER=neon` and no Supabase env, ping makes no Supabase fetch and returns `{ ok: true, db: true, auth: true }`;
  - the deploy guard reports `LOGIN_PROVIDER is not set in Vercel Production` when `vercel env ls production` output lacks it (reusing `hasEnvVar`).
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Update the ping comment and the `keepalive.yml` comment: Supabase keep-alive runs only while Supabase is the login.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5: Commit** `feat(ops): keep-alive and deploy guard follow LOGIN_PROVIDER`.

### Task 9: `create-login`, preference move, and real-provider smoke scripts

**Files:**
- Create: `scripts/clinic/login-config.ts`, `scripts/clinic/create-login.ts`, `scripts/clinic/move-preferences.ts`, `scripts/clinic/login-smoke.ts`; `package.json` scripts `create-login`, `login-smoke`
- Test: `tests/scripts/login-config.test.ts`, `tests/scripts/login-smoke.test.ts` (pure parts only)

**Interfaces:**
- `readClinicLoginConfig(slug: string, dir = ~/.config/clinics): { authBaseUrl: string; adminEmail: string; siteUrl: string }` reads `<dir>/<slug>.env`. It refuses if the file is missing, group- or world-readable (mode not 600), or missing a key, with messages naming the key, never the value. Keys: `NEON_AUTH_BASE_URL`, `ADMIN_EMAIL`, `SITE_URL`. Part 2 extends this same file. Smoke-test logins never go in it: `login-smoke` asks for the test login's password.
- `npm run create-login -- --clinic <slug> --email <staff email> [--reset]`: asks (hidden) for the admin password, then the new password twice. It signs in as the admin **directly against `NEON_AUTH_BASE_URL`**, then calls `admin/create-user` (or `admin/set-user-password` with `--reset`). It prints only `created <email> id=<id>` or `password reset for <email>`.
- `npm run move-preferences -- --from <old user id> --to <new user id>` uses `PROD_DATABASE_URL` from `.env` (as other prod scripts do). It moves the `user_preferences` row (language, WhatsApp number) to the new id and prints the row count only. It refuses if the target already has a row.
- `npm run login-smoke -- --clinic <slug> --email <test login>` asks (hidden) for that login's password. It checks against `SITE_URL`:
  1. sign-in leads to `/dashboard` 200;
  2. a wrong password leads to `/login?error=1`;
  3. `/s/<random>` gives 404 (not 307);
  4. `/api/patients/search` without a cookie gives 401;
  5. `POST /api/auth/sign-up/email` gives 404;
  6. sign-out happens;
  7. the cookie copied before sign-out is replayed on `/dashboard` and gets 307 `/login`.
  It prints one line per check, pass or fail, and exits non-zero on any fail. It never prints cookies.

- [ ] **Step 1: Failing tests:** config file missing, mode 644, key missing, all good. Smoke-result formatting: a fail line names the check and the status code only.
- [ ] **Step 2:** Run and expect FAIL.
- [ ] **Step 3:** Implement. Use the Node `readline` hidden-input pattern (muted output), never argv or env, for passwords.
- [ ] **Step 4:** Tests PASS, and `npm run typecheck` is clean.
- [ ] **Step 5: Commit** `feat(clinic): create-login, move-preferences and login-smoke scripts`.

### Task 10: Docs and env

**Files:** `docs/architecture.md` (auth section: provider seam, lazy import, allowlist, uncached read), `docs/environments.md` (`LOGIN_PROVIDER`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`; switching and rolling back; scripts), `.env.example`, `docs/backlog.md`.

- [ ] **Step 1:** Write the docs. The rollback runbook is "set `LOGIN_PROVIDER=supabase` in Vercel Production, then `npm run deploy:prod`; about 5 minutes".
- [ ] **Step 2: Commit** `docs: Neon login provider, switch and rollback`.

### Task 11: Real-provider rehearsal on the Sunrise preview (C, with D for the admin password)

This proves the neon branch against the real service before Pawar is touched. It stands in for the roadmap's "e2e green with both providers" (see ledger ruling).

- [ ] **Step 1:** On Neon branch `sunrise-preview` (`br-late-lake-ao1ym347`), run, in this order:
  1. `neon neon-auth enable`;
  2. `neon neon-auth config email-password update --disable-sign-up true`;
  3. add the preview domain;
  4. set the application name.
  Send outputs that may hold secrets to a chmod-600 file.
- [ ] **Step 2: Bootstrap the first admin, sign-up never open:**
  1. `neon neon-auth user create --email <Deepak's real email>`;
  2. `neon neon-auth user set-role <id> --roles admin`;
  3. Deepak uses "forgot password" (`POST /api/auth/request-password-reset` through the preview) and sets his password from the emailed link.
  If the shared-SMTP mail doesn't arrive within 10 minutes, rule in the ledger and fall back: turn sign-up on with only `localhost` trusted, have Deepak sign up from a local `npm run dev` against this branch, turn it off, then check that a sign-up POST answers `400 EMAIL_PASSWORD_SIGN_UP_DISABLED`.
  **Verify:** Deepak signs in on the preview, and a sign-up POST is refused.
- [ ] **Step 3:** Deepak writes `~/.config/clinics/sunrise-preview.env` (chmod 600; `NEON_AUTH_BASE_URL`, `ADMIN_EMAIL`, `SITE_URL`). He runs `npm run create-login -- --clinic sunrise-preview --email <a test address he owns>`.
- [ ] **Step 4:** Add to Vercel Preview:
  - `LOGIN_PROVIDER=neon`;
  - `NEON_AUTH_BASE_URL`;
  - `NEON_AUTH_COOKIE_SECRET` (32+ random bytes, generated into a chmod-600 file, never shown).
  Then `vercel deploy --yes`.
- [ ] **Step 5:** `npm run login-smoke -- --clinic sunrise-preview --email <test login>`: all 7 checks pass. Deepak clicks through once on his phone.
- [ ] **Step 6:** Ledger line: the smoke output (pass lines only).

### Task 12: Security review (roadmap 2.3) and PR-G merge

- [ ] **Step 1:** Run the `phi-security-reviewer` and `security-review` skills on `feat/neon-login`. Fix every finding in a commit, or write it in the PR body as "accepted by Deepak" with his OK.
- [ ] **Step 2:** Get CI green. With Deepak's OK, add `LOGIN_PROVIDER=supabase` to Vercel **Production** (the deploy guard needs it), merge, and run `deploy:prod`.
  **Verify:** Pawar behaves exactly as before (still Supabase); Deepak does the phone check.

### Task 13: Pawar cut-over (roadmap 2.4, C + D, one sitting)

- [ ] **Step 1:** On Pawar's production branch (`br-shy-morning-aobjyx6b`), run, in this order:
  1. `neon neon-auth enable`;
  2. disable sign-up;
  3. add domain `https://yoga-ten-tau.vercel.app`;
  4. allow-localhost off;
  5. set the application name.
  The `neon_auth` schema appears in `neondb` next to `public`. Then run `npm run db:status:prod` to confirm the migrations and row counts are unchanged.
- [ ] **Step 2:** Bootstrap Deepak as admin (Task 11 step 2 method). Deepak writes `~/.config/clinics/pawar.env`.
- [ ] **Step 3:** Deepak runs `create-login` for each of the 2 staff accounts, with the same emails and the same passwords as today. Note each new id.
- [ ] **Step 4:** For each staff member, get the old Supabase user id by email (Supabase dashboard → Auth → Users). Then run `move-preferences --from <old> --to <new>` so language and WhatsApp number carry over.
- [ ] **Step 5:** Put `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` (a new secret, not the preview's) in Vercel Production. Change `LOGIN_PROVIDER` to `neon`. Then run `npm run deploy:prod`.
- [ ] **Step 6:** Verify:
  - `npm run login-smoke -- --clinic pawar --email <Deepak's admin>` passes all 7;
  - a browser that was signed in on Supabase lands on `/login`;
  - both staff sign in on their phones and see their usual language;
  - `db:status:prod` counts are unchanged.
  **If anything fails:** set `LOGIN_PROVIDER=supabase`, run `deploy:prod`, and the old logins work again.
- [ ] **Step 7:** Tick roadmap 2.4. Deepak pauses (does not delete) the Supabase project 2 weeks later, then says when to start PR-H.

## PR-H — Retire Supabase (at least 2 weeks after Task 13, with Deepak's OK)

### Task 14: Remove Supabase code

**Files:**
- Delete: `src/lib/supabase/server.ts`, the supabase branches in `auth.ts`, `actions/auth.ts`, `session-middleware.ts` and `ping`
- Modify: `package.json` (drop `@supabase/ssr`, `@supabase/supabase-js`), `login-provider.ts` (`'mock' | 'neon'`), tests, docs, `.env.example`
- Remove Supabase env vars from Vercel (all envs)

- [ ] **Step 1:** Update the tests first. `LOGIN_PROVIDER=supabase` now throws `Unknown LOGIN_PROVIDER`.
- [ ] **Step 2:** Remove the code and packages. Then run `npm run typecheck`, `npm run coverage`, `npm run build`, and e2e for both profiles.
- [ ] **Step 3:** With Deepak's OK: merge, `deploy:prod`, and `login-smoke` against Pawar. Deepak deletes the Supabase project and the local gitignored `scripts/create-admin.js` (it holds a plaintext password).
- [ ] **Step 4: Commit** `chore: retire Supabase login`.
