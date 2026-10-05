# Environments: local vs production (how-to)

Short, practical reference. Details and first-time setup: `docs/setup.md`.

## The two environments

| | **Local (default)** | **Production** |
|---|---|---|
| URL | https://localhost:3000 (`dev:phone`) or http://localhost:3000 (`dev`) | https://yoga-ten-tau.vercel.app |
| Database | PGlite file DB in `.local-db/` (demo data) | **Neon** (`PROD_DATABASE_URL` locally, `DATABASE_URL` in Vercel) |
| Login | Mock: `dr.pawar@example.com` / `password` | **Supabase Auth** (login only) |
| Files | `public/uploads/` | **Cloudflare R2** |
| Switch | `LOCAL_MOCK=true` in `.env` | Vercel env vars; `npm run *:prod` scripts |

**Supabase = login only.** Its old database is unused; never migrate it as "prod".
**Vercel is not connected to GitHub** — merging to `main` does **not** deploy.

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
| `db:migrate:prod` / `deploy:prod` refuse | Follow the listed reasons (switch to `main`, commit, `git pull`, push via PR) |

## Secrets
- Real values live only in `.env` (gitignored) and Vercel. Never paste connection strings or keys in
  chats or PRs; the scripts never print them.
- Vercel marks `DATABASE_URL` / service keys as sensitive — `vercel env pull` returns them empty.
