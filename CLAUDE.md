start every response with my name - "Deepak". everytime you are thinking ou tload and discussing with me.

# Pawar Yoga Therapy — Patient Management

Single-clinic patient management app. Next.js 15 + Drizzle; production = Neon (DB) + Cloudflare R2 (files) + Supabase (login only), on Vercel.

## Read these instead of scanning code
- `docs/architecture.md` — **code index**: module map, invariants, how-to-add-a-feature. Start here.
- `docs/environments.md` — **local vs production how-to**: which DB/login/files where, release flow, `*:prod` scripts, troubleshooting.
- `docs/setup.md` — first-time setup (Neon/R2/Supabase-login/Vercel) + manual QA checklist.
- `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md` — what Phase 1 is and isn't; Phase 2/3 roadmap.

## Commands
- `npm run dev` — local dev (needs `.env`, see docs/setup.md)
- `npm test` / `npm run coverage` — vitest; coverage gate: 80% on `src/lib`, `src/data`, `src/actions`
- `npm run typecheck` / `npm run build`
- `npm run db:generate` — after any `src/db/schema.ts` change (local mock DB migrates on dev-server restart)
- Production: `npm run db:status:prod` · `db:migrate:prod` · `deploy:prod` (main only) — see `docs/environments.md`

## Conventions
- TDD: failing test → minimal code → commit. Tests live in `tests/`, mirroring `src/`.
- Layering: pure logic `src/lib` → repos `src/data` (take `db` arg) → actions `src/actions` (auth+zod+revalidate) → UI `src/app`. Never query the DB from a page; go through `src/data`.
- Tests never touch real services: PGlite (`tests/helpers/db.ts`) + fakes (`tests/helpers/`).
- Bilingual UI: every user-facing label/error is "English / मराठी".
  Exception (decided 2026-10-04): clinical posture pattern text (`posture.insights.patterns`) is English-only in both locales — the physio explains it in the client's language; avoids translation errors in clinical wording.
- Keep `docs/architecture.md` updated in the same commit as any structural change — it is the index future sessions rely on.
