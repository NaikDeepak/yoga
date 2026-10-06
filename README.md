# Pawar Yoga Therapy — Patient Management

Single-clinic patient management app: clients, visits, treatment plans, fees and receipts, home-exercise
links, posture analysis and flexibility tests. Bilingual (English / मराठी).

Live: https://yoga-ten-tau.vercel.app

## Where things run

| What | Service |
|---|---|
| Hosting | Vercel (manual deploys, not connected to GitHub) |
| Database | Neon Postgres |
| Login | Supabase Auth (login only, no app data) |
| Files and photos | Cloudflare R2 (private bucket) |
| AI | Google Gemini |

How to add or remove Vercel environment variables, deploy, roll back, and what every variable does:
**[docs/environments.md](docs/environments.md)**.

## Quick start (local, demo data)

```bash
cp .env.example .env      # keep LOCAL_MOCK=true
npm install
npm run dev               # http://localhost:3000 · sign in: dr.pawar@example.com / password
npm run dev:phone         # same over HTTPS on your Wi-Fi, to use a phone's camera
```

## Docs

- [docs/environments.md](docs/environments.md): where is what, environment variables, Vercel env how-to, release, troubleshooting
- [docs/setup.md](docs/setup.md): first-time setup of Neon / R2 / Supabase / Vercel, manual QA checklist
- [docs/architecture.md](docs/architecture.md): code index (module map, invariants, how to add a feature)
- [docs/backlog.md](docs/backlog.md): what's next: open items, decisions waiting on people, roadmap
- [docs/superpowers/specs/](docs/superpowers/specs/): design spec for each feature

## Commands

| | |
|---|---|
| `npm test` / `npm run coverage` | tests (80% coverage gate on `src/lib`, `src/data`, `src/actions`) |
| `npm run typecheck` / `npm run build` | type check / production build |
| `npm run db:generate` | new migration after changing `src/db/schema.ts` |
| `npm run db:status:prod` | production: pending migrations (read-only) |
| `npm run db:migrate:prod` → `npm run deploy:prod` | release, from a clean, up-to-date `main` |
