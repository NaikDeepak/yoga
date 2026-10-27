# Environments & operations (how-to)

Practical reference: where everything runs, which environment variable does what, how to add or
remove them in Vercel, and how to release. First-time setup: `docs/setup.md`.

## Where is what

| What | Service | Dashboard | Code |
|---|---|---|---|
| **Hosting** (app + API routes + daily cron) | **Vercel** (project `yoga`, team naikdeepaks-projects) | vercel.com → yoga | `vercel.json` (cron) |
| **Database** (all app data) | **Neon** Postgres, pooled connection | console.neon.tech | `src/db/*`, migrations in `drizzle/` |
| **Login only** | **Supabase Auth** (project `yabzxeetzihtnbumampg`), or **Neon Auth** when `LOGIN_PROVIDER=neon` (see *Neon login* below) | supabase.com → project → Authentication · console.neon.tech → project → Auth | `src/lib/login-provider.ts`, `src/lib/supabase/*`, `src/lib/neon-auth.ts`, `src/lib/auth.ts` |
| **Files** (documents, profile + posture + flexibility photos) | **Cloudflare R2**, private bucket `patient-files` | dash.cloudflare.com → R2 | `src/lib/r2-storage.ts`, `src/lib/storage.ts` |
| **AI** (treatment drafts, posture analysis) | **Google Gemini** `gemini-2.5-flash` | aistudio.google.com → API keys | `src/lib/gemini.ts` |
| **Code** | **GitHub** `NaikDeepak/yoga` (PRs reviewed by Kilo) | github.com/NaikDeepak/yoga | — |
| WhatsApp messages | none: free `wa.me` links that open the physio's WhatsApp | — | `src/lib/whatsapp.ts` |

**Supabase = login only** (until a clinic is switched to Neon login). Its old database is unused; never migrate it as "prod".
**Vercel is not connected to GitHub**, so merging to `main` does **not** deploy (see *Release*).
Every file of a client is stored under `patients/<client id>/` in R2.

## The two environments

| | **Local (default)** | **Production** |
|---|---|---|
| URL | https://localhost:3000 (`dev:phone`) or http://localhost:3000 (`dev`) | https://yoga-ten-tau.vercel.app |
| Database | PGlite file DB in `.local-db/` (demo data) | **Neon** (`PROD_DATABASE_URL` locally, `DATABASE_URL` in Vercel) |
| Login | Mock: `dr.demo@example.com` / `password` | **Supabase Auth** (default) or **Neon Auth** (`LOGIN_PROVIDER=neon`) |
| Files | `public/uploads/` | **Cloudflare R2** |
| AI | canned answers without a key | **Gemini** (needs `GEMINI_API_KEY`) |
| Settings | `.env` (copy `.env.example`; `LOCAL_MOCK=true`) | **Vercel → Settings → Environment Variables** |

## Environment variables

| Variable | What it's for | Local `.env` | Vercel Production |
|---|---|---|---|
| `LOCAL_MOCK` | `true` = demo mode (PGlite, mock login, local files, canned AI). Refused in production | `true` | **never** |
| `DATABASE_URL` | Database the app uses: Neon **pooled** URL | not needed in mock mode | required · sensitive |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth project URL | only for `dev:prod-db` | required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase public keys (login) | only for `dev:prod-db` | required |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin key (keepalive ping) | only for `dev:prod-db` | required · sensitive |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 files. All four or the app refuses to start; the token needs **Object Read & Write** (listing is used to delete a client's folder) | not needed in mock mode | required · sensitive |
| `GEMINI_API_KEY` | Google Gemini for AI treatment drafts and posture analysis | optional (canned without) | needed for AI features |
| `FEATURE_POSTURE` | `true` shows posture analysis; `false` turns the whole posture module off (all posture pages 404, save/retake refuse, posture share links 404, Settings capture health hidden). Flexibility needs it too. `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `FEATURE_FLEXIBILITY` | Flexibility tests on posture reports (page, report section, totals, save action). Needs `FEATURE_POSTURE`. `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `FEATURE_AI` | AI treatment drafts and AI posture analysis (buttons hidden, actions refuse). `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `FEATURE_SHARE_LINKS` | Client share links (exercises, posture, progress) and their panels; also stops check-ins and the dashboard nudge card. `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `FEATURE_CHECKINS` | Daily home-exercise check-ins (public form, adherence card, dashboard quiet-clients card). `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `FEATURE_FEES` | Fees tab, payments, charges, receipts, print fee summary, dashboard revenue/outstanding, fees CSV export. `true`/`false` overrides the clinic profile | follows the clinic profile (Pawar: on) | `true`/`false` overrides the profile |
| `LOCAL_DB_DIR` | Folder of the local PGlite database | `.local-db` | never |
| `NEXT_DIST_DIR` | Next.js build folder (`distDir`) | `.next` | never |
| `APP_URL` | Public site address used in client share links | optional | `https://yoga-ten-tau.vercel.app` |
| `CLINIC_PROFILE` | Which clinic profile (`src/clinics/`) this deploy shows. Unset or empty in production = build/start throws (fails closed); `deploy:prod` refuses only when the name is not listed in Vercel Production (an empty value then fails the build). Local `next build` / `next start` need it too (in `.env`) | — | required · set for build + runtime (`pawar`) |
| `LOGIN_PROVIDER` | Which login the app uses: `supabase` or `neon` (mock mode ignores it). **Must be set in every Vercel environment (Production and Preview) before deploying a build from `feat/neon-login` on**: unset or unknown in production = every request 500s, share links included (fails closed, no silent default) | optional (defaults to `supabase` outside production) | required (`supabase` until a clinic is switched to `neon`) |
| `NEON_AUTH_BASE_URL` | Neon Auth endpoint of this clinic's Neon branch (Neon → Auth). Not a secret, but never print it next to a secret. Only read when `LOGIN_PROVIDER=neon` | only to run with `LOGIN_PROVIDER=neon` | required when `LOGIN_PROVIDER=neon` |
| `NEON_AUTH_COOKIE_SECRET` | Signs the session cookie, at least 32 chars (`openssl rand -base64 32`). Only read when `LOGIN_PROVIDER=neon` | same | required · sensitive when `LOGIN_PROVIDER=neon` |
| `CRON_SECRET` | The daily `/api/ping` keepalive must send it; without it the route refuses every call (fails closed). Same value as the `CRON_SECRET` GitHub repo secret. `deploy:prod` needs it locally too (shell, `.env`, or `~/.config/clinics/pawar.env`, chmod 600) for its smoke test | — | required · sensitive (set 2026-10-08) |
| `PROD_DATABASE_URL`, `PROD_SITE_URL` | Used **only** by the `npm run *:prod` scripts on your Mac | Neon pooled URL / live URL | not used |

The e2e `phone-modules-off` project starts a second `next dev` on port 3101 with `LOCAL_DB_DIR=.local-db-modules-off`, `NEXT_DIST_DIR=.next-modules-off` and every `FEATURE_*=false` (both folders are gitignored); a shared folder would clash on `.next/` and corrupt PGlite.

As of 2026-10-06: `GEMINI_API_KEY` **and** `FEATURE_POSTURE=true` are set in Production (both added
that day), so AI features, posture analysis, flexibility tests and the ideal reference photos are live.
Since then posture follows the clinic profile (Pawar: on); `FEATURE_POSTURE=false` turns it off.
Check with `vercel env ls production`. Remember: a local demo (`LOCAL_MOCK=true`) without a key returns a
fixed dummy AI plan, so "it works locally" doesn't prove production has the key.

## Neon login (`LOGIN_PROVIDER=neon`)

Login for a clinic can run on **Neon Auth** (managed Better Auth) instead of Supabase. Code: `src/lib/login-provider.ts`
(the switch), `src/lib/neon-auth.ts`, `src/lib/session-middleware.ts`, `src/app/api/auth/[...path]/route.ts`
(allowlist: everything not listed is 404). Provider rules: `mock` wins under `LOCAL_MOCK`; in production an unset
or unknown value throws; `/api/ping` pings Supabase whenever its URL is set and, under `neon`, checks `{NEON_AUTH_BASE_URL}/ok`. Protected pages read the Neon
session uncached on every navigation. `/register` no longer exists.

**Neon Auth lives per Neon branch.** Manage it with the Neon API, **always by branch ID**:
`https://console.neon.tech/api/v2/projects/{project}/branches/{branchId}/auth/...` with `domains`,
`email_and_password` (`{"disable_sign_up":true}`), `allow_localhost`, `users`, `users/{id}/role`, `config` (`{"name":...}`).
Do **not** use `neon neon-auth ...`: it mis-resolves branches (on 2026-10-27 a command meant for the preview branch hit production).
Never paste the cookie secret or any token in chat; the base URL itself is not a secret.

**State (2026-10-27):**
- Pawar: production branch has Neon Auth enabled (sign-up off, no trusted domains, localhost off) but **unused** until the cut-over.
- Sunrise preview: logins live in a separate throwaway Neon project `sunrise-preview-auth` (`still-haze-98788197`), trusted domain `https://yoga-sunrise-preview.vercel.app`. Delete it after Part 2.

Step-by-step for Deepak (create a login, reset passwords, common messages): `docs/logins.md`.

**Scripts** (`scripts/clinic/`, settings in `~/.config/clinics/<slug>.env`, `chmod 600`, keys `NEON_AUTH_BASE_URL`,
`ADMIN_EMAIL`, `SITE_URL`, optional `VERCEL_PROTECTION_BYPASS`; passwords only via hidden prompt):
| Command | Does |
|---|---|
| `npm run create-login -- --clinic <slug> --email <staff email>` | admin creates a staff login (`--reset` sets a new password) |
| `npm run reset-password -- --clinic <slug> --email <email>` | first-admin bootstrap: Neon emails a reset link → paste it → new password. No admin session needed, sign-up stays off |
| `npm run move-preferences -- --from <old user id> --to <new user id>` | moves the production `user_preferences` row to the new user id |
| `npm run login-smoke -- --clinic <slug> --email <test login> [--site <url>]` | 7 checks against `SITE_URL` (sign-in, wrong password, `/s/` 404, API 401, sign-up 404, sign-out, replayed cookie) |

**First admin:** create the user through the API (`users`), set role `admin` (`users/{id}/role`), then `npm run reset-password`
(uses Neon's shared email). Sign-up is never opened.

**Switch a clinic to Neon:** set `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `LOGIN_PROVIDER=neon` in Vercel Production,
add the live domain as a trusted domain on that branch, create the logins, `move-preferences`, `npm run deploy:prod`
(builds with `--skip-domain`, then promote, smoke, auto-rollback), then `npm run login-smoke` and log in by hand.

**Roll back to Supabase** (about 5 minutes): set `LOGIN_PROVIDER=supabase` in Vercel Production, then `npm run deploy:prod`.
The Supabase project and its logins stay untouched until PR-H, so this works at any time before then.
`/api/ping` keeps pinging Supabase whenever `NEXT_PUBLIC_SUPABASE_URL` is set (even under `LOGIN_PROVIDER=neon`), so it should not pause. Before the rollback deploy:
(a) if Supabase has been paused anyway, unpause it in the Supabase dashboard first;
(b) for staff whose language/WhatsApp settings should carry back, run `move-preferences` in reverse
(`npm run move-preferences -- --from <neon user id> --to <supabase user id>`).

## Sunrise preview (made-up second clinic, for checking only)

`vercel deploy --yes` (no `--prod`) from any branch builds a **Preview** that runs as Sunrise:

| | Preview |
|---|---|
| Database | Neon branch `sunrise-preview` → its own database `sunrise`, own user `sunrise_app` (no Pawar data) |
| Login | Supabase Auth as production (same accounts) until switched; Neon login test accounts: see *Neon login* |
| Files | Own R2 bucket `sunrise-preview-files`, token scoped to that bucket only |
| Settings | Vercel env, scope **Preview**: `CLINIC_PROFILE=sunrise`, `DATABASE_URL`, 3 × `NEXT_PUBLIC_SUPABASE_*`, 4 × `R2_*`, `FEATURE_POSTURE=true`, `FEATURE_FLEXIBILITY=true` |

Previews sit behind Vercel login. The project has no Git integration, so Preview env applies to every
preview and branch-scoped values are refused; with CLI 54 add a Preview value with an empty branch:
`vercel env add NAME preview "" --value V --yes`. Replaced by Sunrise's real setup in roadmap step 2.7.

## Add, change or remove a Vercel environment variable

Env changes **only take effect after a new deploy** (`npm run deploy:prod`, from a clean `main`).

**Dashboard:** vercel.com → project **yoga** → **Settings → Environment Variables** → *Add*, or ⋯ → *Edit* / *Remove*.
Tick **Production** (Preview / Development only if you use them) and mark keys as **Sensitive**.

**CLI** (from the repo folder, logged in with `vercel login`):
```bash
vercel env ls production                      # names only, never values
vercel env add GEMINI_API_KEY production      # prompts for the value (not saved in shell history)
vercel env rm  GEMINI_API_KEY production      # remove (asks to confirm)
# change a value = remove, then add again
npm run deploy:prod                           # apply the change
```
- Turn on posture + flexibility: `vercel env add FEATURE_POSTURE production` → value `true` → deploy.
- `vercel env pull` returns **sensitive** values empty, so keep the real values in a password manager.
- Never paste keys or connection strings into chats, PRs or issues; the scripts never print them.
- Rotating a key (e.g. R2 or Gemini): create the new one in the provider's dashboard, replace it in
  Vercel, deploy, check the site, **then** delete the old one in the provider.

## Everyday local dev
```bash
npm run dev            # mock data, http://localhost:3000
npm run dev:phone      # same over HTTPS on the Wi-Fi (camera on a phone); accept the cert warning
```
- After pulling a branch with **new migrations**, **restart the dev server** — mock mode migrates
  `.local-db` only at startup (symptom: `Failed query … relation does not exist`).
- Restarting `dev:phone` makes a new certificate → accept the warning in the browser again.
- Reset demo data: stop the server, delete `.local-db/` and `public/uploads/`, start again.

## Look at production (safe)
```bash
npm run db:status:prod   # read-only: applied / pending migrations, row counts
```

### Neon CLI (`neon`) and Neon MCP
- Project `pawar-yoga` (`late-mouse-93599929`, `aws-ap-southeast-1`).
- The CLI signs in with an **organization API key** stored in profile `main`
  (`~/.config/neon/credentials.main.json`); `export NEON_PROFILE=main` in `~/.zshrc` selects it.
  Check with `neon projects list`. `neon me` always fails with org keys ("not allowed for organization API keys").
- Browser `neon login` does not work on this Mac: the callback is hit twice, the code is reused and Neon
  revokes the fresh token (`token_inactive`). Use an API key instead: write it to a `chmod 600` file,
  run `neon profile create main --api-key - < file`, delete the file. Never paste a key into a chat or command line.
- `.mcp.json` adds Neon's hosted MCP server (URL only, no key; it signs in by itself). The repo is public: never put a key there.

## CI (Continuous Integration)

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every pull request to `main` and push to `main`:
1. `npm run typecheck` (`tsc --noEmit`).
2. `npm run coverage` (full vitest test suite; 80% coverage gate on `src/lib`, `src/data`, `src/actions`).
3. `npm run build` (production build with `LOCAL_MOCK=false`), run twice: once with `CLINIC_PROFILE=pawar`, once with `CLINIC_PROFILE=sunrise`.

The `e2e` job is a matrix over clinic profiles, so its check names are **`End-to-end smoke (mock mode) (pawar)`** and **`End-to-end smoke (mock mode) (sunrise)`** (the old unsuffixed name no longer exists). The `ci` job keeps its name `Typecheck, Test & Build`. **Deepak updates the required checks in GitHub branch protection** to the new names; until then the old `End-to-end smoke (mock mode)` requirement can never be satisfied.

Run e2e for the second clinic locally: `CLINIC_PROFILE=sunrise npm run e2e`. The main server then uses its own `.next-sunrise/` and `.local-db-sunrise/` folders (gitignored) and never reuses a server already on port 3100. That run also executes `e2e/clinic-identity.spec.ts` (skipped for pawar), which fails if anything of Pawar's shows.

Older runs on the same branch or PR ref are cancelled automatically (`concurrency`).

### CI environment & secrets
CI **never** uses real secrets or connects to production services. Placeholder environment variables are declared on the Build step of `.github/workflows/ci.yml` (typecheck and tests run with no env at all):
- `LOCAL_MOCK=false`
- `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci`
- `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder`

No GitHub repository secrets are needed for PR checks. A red check means "do not merge".

## Release to production
```bash
# 1. PR merged on GitHub
git checkout main && git pull
npm run db:status:prod     # anything pending?
npm run db:migrate:prod    # only if pending; asks you to type "migrate prod"
npm run deploy:prod        # build → promote → smoke test → auto-rollback on failure
```
Both `:prod` write scripts refuse unless you're on a clean, pushed, up-to-date `main`, and
`deploy:prod` refuses while migrations are pending, `CLINIC_PROFILE` / `LOGIN_PROVIDER` is missing from Vercel Production, or `CRON_SECRET` isn't set locally (shell, `.env`, or `~/.config/clinics/pawar.env`). Its smoke test calls `/api/ping` with that secret and needs 200, which means the database and the active login (Supabase or Neon) both answer. It builds with `--skip-domain`, so a new build never goes live until `vercel promote` and the smoke test pass; if the CLI dies mid-build, production is still the previous deployment. Then log in on the live site and click through.

## Debug with real data (careful)
```bash
npm run dev:prod-db      # local app on 127.0.0.1:3000 against the PRODUCTION database
```
Every change made there changes real client records. Needs the real Supabase login values in `.env`.

## If something goes wrong
| Symptom | Fix |
|---|---|
| Live site 500 on every page, log says *"Your project's URL and Key are required"* | Supabase login vars missing in Vercel **Production** env; add them, redeploy |
| New deploy not showing after a manual rollback | `vercel promote <deployment-url>` (`deploy:prod` does this) |
| Need the previous version back | `vercel rollback <previous-deployment-url> --yes` |
| `deploy:prod` stopped after "Built:" without a smoke-test result | The build is not live (`--skip-domain`); check the Vercel dashboard, then re-run `deploy:prod` (or `vercel promote <url>` and check `/login`, `/api/ping`, an unknown `/s/<token>` by hand) |
| `db:migrate:prod` / `deploy:prod` refuse | Follow the listed reasons (switch to `main`, commit, `git pull`, push via PR) |
| "Generate AI" fails with *GEMINI_API_KEY is not set* | Add `GEMINI_API_KEY` in Vercel Production, deploy |
| Posture / flexibility buttons missing on the live site | `FEATURE_POSTURE=true` in Vercel Production, deploy |
| Uploads or *Delete client* fail with an R2 error | Check the four `R2_*` vars and that the token is Object Read & Write on `patient-files` |

## Restore the database (Neon point-in-time)
- **Window: 6 hours** (free plan, `history_retention_seconds` = 21600). Older mistakes cannot be undone; a paid
  plan raises the window. Notice a bad change fast.
- Never restore over `production` first. Make a branch from the past, check it, then decide:
  ```bash
  export NEON_PROFILE=main P=late-mouse-93599929
  neon branches create --project-id $P --name restore-YYYY-MM-DD --parent 2026-10-22T01:00:00Z --expires-at <tomorrow, UTC>
  # --parent <UTC time> = the default branch (production) as it was at that moment
  ```
- Check it **with counts only** (patient data): pipe `neon connection-string restore-YYYY-MM-DD --project-id $P --pooled`
  into a script that calls `prodStatus(url)` from `scripts/prod/common.ts`. Never print the connection string.
- To roll production back: Neon Console → Branches → `production` → **Restore** to that time (it keeps a backup of
  the current state), or copy the needed rows out of the restore branch by hand. Then delete the restore branch.
- **Drill done 2026-10-22:** branch from 01:00 UTC came back with all 26 migrations and every table's row count
  equal to production; branch deleted.

**Files (R2) are not covered by the database restore.** A deleted file is gone. Orphan check 2026-10-22:
9 files of 4 clients deleted before 2026-10-06 (when *Delete client* started wiping the folder) remain in
`patient-files`; no database row points at a missing file.
**2026-10-24:** re-checked (same 9, none referenced) and deleted with Deepak's OK; bucket = 3 files, all referenced.

## Secrets
- Real values live only in `.env` (gitignored), Vercel, and your password manager. Never paste
  connection strings or keys in chats or PRs; the scripts never print them.
- Server logs never contain query data: use `safeErrorMessage` (`src/lib/log.ts`) when logging errors.
