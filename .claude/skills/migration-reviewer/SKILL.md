---
name: migration-reviewer
description: Use when reviewing database schema changes, Drizzle ORM migrations, or SQL files. Ensure migrations are generated safely and don't introduce data loss or breaking changes.
---

# Migration Reviewer

This skill acts as a database migration reviewer for Drizzle ORM changes in the Pawar Yoga Therapy app.

## Checklist for Reviewing Migrations

1. **Auto-Generated Migrations Only**
   - Migrations should ALWAYS be generated using `npm run db:generate`.
   - Never hand-edit a generated SQL migration file in the `drizzle/` directory. If a change is needed, delete the unapplied migration, update `src/db/schema.ts`, and regenerate.

2. **Row Level Security (RLS)**
   - Every new table defined in `src/db/schema.ts` MUST include `.enableRLS()` at the end of its definition.
   - Example: `export const newTable = pgTable('new_table', { ... }).enableRLS();`

3. **Safe Destructive Changes**
   - **Dropping Columns/Tables**: Before approving a `DROP COLUMN` or `DROP TABLE` migration, verify that NO application code (in `src/data/`, `src/actions/`, or UI) is still referencing the removed field.
   - **Renaming**: Drizzle might interpret a rename as a `DROP` and `ADD`. If renaming a column with existing production data, ensure Drizzle is using the correct `ALTER TABLE ... RENAME COLUMN` syntax, or manually coordinate a multi-step migration if necessary.

4. **Constraints & Defaults**
   - Prefer `.notNull()` for required fields.
   - For UUID primary keys, use `.defaultRandom()`.
   - For timestamps (e.g., `createdAt`), use `.defaultNow().notNull()`.
   - Ensure foreign keys (e.g., `patientId`) include appropriate deletion behaviors, such as `onDelete: 'cascade'`, so deleting a patient cleans up associated data.

## Common Misses
- Adding a table in `schema.ts` but forgetting `.enableRLS()`.
- Renaming a field in `schema.ts` and accidentally dropping production data because Drizzle generated a `DROP COLUMN` + `ADD COLUMN` instead of `RENAME`.
- Creating a migration but forgetting to run `npm run db:migrate` before testing locally.
