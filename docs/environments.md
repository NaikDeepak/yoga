# Environments & operations (how-to)

Practical reference: where everything runs, which environment variable does what, how to add or
remove them in Vercel, and how to release. First-time setup: `docs/setup.md`.

## Where is what

| What | Service | Dashboard | Code |
|---|---|---|---|
| **Hosting** (app + API routes + daily cron) | **Vercel** (project `yoga`, team naikdeepaks-projects) | vercel.com → yoga | `vercel.json` (cron) |
| **Database** (all app data) | **Neon** Postgres, pooled connection | console.neon.tech | `src/db/*`, migrations in `drizzle/` |
| **Login only** | **Supabase Auth** (project `yabzxeetzihtnbumampg`) | supabase.com → project → Authentication | `src/lib/supabase/*`, `src/lib/auth.ts` |
| **Files** (documents, profile + posture + flexibility photos) | **Cloudflare R2**, private bucket `patient-files` | dash.cloudflare.com → R2 | `src/lib/r2-storage.ts`, `src/lib/storage.ts` |
| **AI** (treatment drafts, posture analysis) | **Google Gemini** `gemini-2.5-flash` | aistudio.google.com → API keys | `src/lib/gemini.ts` |
| **Code** | **GitHub** `NaikDeepak/yoga` (PRs reviewed by Kilo) | github.com/NaikDeepak/yoga | — |
| WhatsApp messages | none: free `wa.me` links that open the physio's WhatsApp | — | `src/lib/whatsapp.ts` |

**Supabase = login only.** Its old database is unused; never migrate it as "prod".
**Vercel is not connected to GitHub**, so merging to `main` does **not** deploy (see *Release*).
Every file of a client is stored under `patients/<client id>/` in R2.

## The two environments

| | **Local (default)** | **Production** |
|---|---|---|
| URL | https://localhost:3000 (`dev:phone`) or http://localhost:3000 (`dev`) | https://yoga-ten-tau.vercel.app |
| Database | PGlite file DB in `.local-db/` (demo data) | **Neon** (`PROD_DATABASE_URL` locally, `DATABASE_URL` in Vercel) |
| Login | Mock: `dr.demo@example.com` / `password` | **Supabase Auth** |
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
| `FEATURE_POSTURE` | `true` shows posture analysis + flexibility tests (and lets posture share links work) | on by default in `dev` | `true` to enable · off when unset |
| `APP_URL` | Public site address used in client share links | optional | `https://yoga-ten-tau.vercel.app` |
| `CRON_SECRET` | If set, the daily `/api/ping` keepalive cron must send it | — | optional |
| `PROD_DATABASE_URL`, `PROD_SITE_URL` | Used **only** by the `npm run *:prod` scripts on your Mac | Neon pooled URL / live URL | not used |

As of 2026-10-06: `GEMINI_API_KEY` **and** `FEATURE_POSTURE=true` are set in Production (both added
that day), so AI features, posture analysis, flexibility tests and the ideal reference photos are live.
Check with `vercel env ls production`. Remember: a local demo (`LOCAL_MOCK=true`) without a key returns a
fixed dummy AI plan, so "it works locally" doesn't prove production has the key.

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

## CI (Continuous Integration)

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every pull request to `main` and push to `main`:
1. `npm run typecheck` (`tsc --noEmit`).
2. `npm run coverage` (full vitest test suite; 80% coverage gate on `src/lib`, `src/data`, `src/actions`).
3. `npm run build` (production build with `LOCAL_MOCK=false`).

Older runs on the same branch or PR ref are cancelled automatically (`concurrency`).

### CI environment & secrets
CI **never** uses real secrets or connects to production services. Placeholder environment variables are declared directly in `.github/workflows/ci.yml`:
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
`deploy:prod` refuses while migrations are pending. Then log in on the live site and click through.

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
| `deploy:prod` stopped after "Built:" without a smoke-test result | The new build may be live untested: check `/login`, `/api/ping` and an unknown `/s/<token>` by hand, roll back if any fails |
| `db:migrate:prod` / `deploy:prod` refuse | Follow the listed reasons (switch to `main`, commit, `git pull`, push via PR) |
| "Generate AI" fails with *GEMINI_API_KEY is not set* | Add `GEMINI_API_KEY` in Vercel Production, deploy |
| Posture / flexibility buttons missing on the live site | `FEATURE_POSTURE=true` in Vercel Production, deploy |
| Uploads or *Delete client* fail with an R2 error | Check the four `R2_*` vars and that the token is Object Read & Write on `patient-files` |

## Secrets
- Real values live only in `.env` (gitignored), Vercel, and your password manager. Never paste
  connection strings or keys in chats or PRs; the scripts never print them.
- Server logs never contain query data: use `safeErrorMessage` (`src/lib/log.ts`) when logging errors.
