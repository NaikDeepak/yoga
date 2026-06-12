# Pawar Yoga Therapy — Patient Management

Single-clinic patient management app (Phase 1 MVP). Next.js 15 + Supabase + Drizzle.

## Read these instead of scanning code
- `docs/architecture.md` — **code index**: module map, invariants, how-to-add-a-feature. Start here.
- `docs/setup.md` — Supabase/env/deploy setup + manual QA checklist.
- `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md` — what Phase 1 is and isn't; Phase 2/3 roadmap.

## Commands
- `npm run dev` — local dev (needs `.env`, see docs/setup.md)
- `npm test` / `npm run coverage` — vitest; coverage gate: 80% on `src/lib`, `src/data`, `src/actions`
- `npm run typecheck` / `npm run build`
- `npm run db:generate` → `npm run db:migrate` — after any `src/db/schema.ts` change

## Conventions
- TDD: failing test → minimal code → commit. Tests live in `tests/`, mirroring `src/`.
- Layering: pure logic `src/lib` → repos `src/data` (take `db` arg) → actions `src/actions` (auth+zod+revalidate) → UI `src/app`. Never query the DB from a page; go through `src/data`.
- Tests never touch real Supabase: PGlite (`tests/helpers/db.ts`) + fakes (`tests/helpers/`).
- Bilingual UI: every user-facing label/error is "English / मराठी".
- Keep `docs/architecture.md` updated in the same commit as any structural change — it is the index future sessions rely on.
