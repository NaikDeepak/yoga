# Pawar Yoga Therapy — Patient Management

Phase 1 MVP per `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md`.

**READ `docs/architecture.md` FIRST** — it is the code index; do not scan src/ blindly.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck`
- `npm test` / `npm run coverage` (80% threshold on src/lib, src/data, src/actions)
- `npm run db:generate` then `npm run db:migrate` after schema changes

## Conventions
- TDD: failing test first, minimal implementation, then commit.
- Pure logic → `src/lib`. DB queries → `src/data` (functions take `db` param). Server actions → `src/actions`. UI → `src/app`.
- Tests use in-memory PGlite (`tests/helpers/db.ts`), never a real Supabase DB.
