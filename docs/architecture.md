# Architecture & Code Index

Read this before touching code — it replaces scanning `src/`.

## System shape
Next.js 15 App Router monolith. Supabase = Postgres + Auth + Storage (private bucket `patient-files`).
Drizzle ORM everywhere; tests run the same migrations on in-memory PGlite.

Request flow: page (server component) → `src/actions/*` ('use server': auth → zod → repo → revalidate)
→ `src/data/*` (pure DB functions taking `db`) → `src/db/schema.ts`.

## Module map
| Path | Responsibility | Key exports |
|---|---|---|
| `src/db/schema.ts` | 6 tables: patients, patient_problems, documents, treatment_plans, visits, lifestyle_assessments | table objects + row types |
| `src/db/client.ts` | prod DB singleton | `getDb()` |
| `src/db/types.ts` | DB type shared by prod/test | `Db` |
| `src/lib/bmi.ts` | BMI math | `computeBmi`, `bmiCategory` |
| `src/lib/patient-code.ts` | PYT-0001 sequence | `nextPatientCode`, `formatPatientCode` |
| `src/lib/presets.ts` | 18 Marathi ailments, doc types | `PRESET_PROBLEMS`, `DOC_TYPES` |
| `src/lib/files.ts` | upload rules (10MB, pdf/jpg/png) | `validateUpload`, `validatePhoto` |
| `src/lib/validation.ts` | zod schemas, bilingual messages | `patientSchema`, `problemSchema`, `treatmentSchema`, `visitSchema`, `lifestyleSchema`, `docTypeSchema`, `firstError` |
| `src/lib/storage.ts` | file storage abstraction | `FileStorage`, `getStorage()`, `BUCKET` |
| `src/lib/auth.ts` / `auth-paths.ts` | session guard; `/login` + `/register` are public | `requireUser`, `isPublicPath` |
| `src/lib/supabase/*` | vendor cookie glue (coverage-exempt) | `createSupabaseServerClient`, `updateSession` |
| `src/data/patients.ts` | CRUD + search + code assignment (transaction) | `createPatient`, `getPatient`, `updatePatient`, `setPhotoPath`, `searchPatients` |
| `src/data/problems.ts` | ailment rows | `addProblem`, `listProblems`, `removeProblem`, `problemsForPatients` |
| `src/data/documents.ts` | upload-then-insert, cleanup on failure | `addDocument`, `listDocuments`, `deleteDocument` |
| `src/data/treatment.ts` | one plan per patient (upsert) | `getTreatmentPlan`, `upsertTreatmentPlan` |
| `src/data/dashboard.ts` | aggregate queries for global stats | `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` |
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits`, `listVisitsWithData`, `getISTDateString`, `getFollowUpsThisWeek` |
| `src/data/lifestyle.ts` | one assessment per patient (upsert) | `getLifestyleAssessment`, `upsertLifestyleAssessment` |
| `src/actions/auth.ts` | sign in / sign out / sign up (Supabase Auth) | `signInAction`, `signOutAction`, `signUpAction` |
| `src/actions/*` (rest) | server actions per domain; all return `ActionResult` | `*Action` functions |
| `src/components/*` | Client islands: PatientForm (live BMI, grouped sections), InlineForm (error display), DeleteButton (AlertDialog confirm), PrintButton, AilmentBarChart (Recharts horizontal bar), VisitLineChart (Recharts line) | — |
| `src/components/ui/*` | shadcn/ui generated components (Button, Input, Label, Card, Badge, AlertDialog, Dialog, Avatar, Separator, Tabs, Textarea, Select) | — |
| `src/lib/utils.ts` | shadcn `cn()` helper (clsx + tailwind-merge) | `cn` |
| `src/app/login` / `src/app/register` | public auth pages (forms post to auth actions) | — |
| `src/app/(app)/dashboard` | clinic-wide stats, ailment bar chart, recent visits | — |
| `src/app/(app)/patients/*` | list/new/detail(tabs+progress+assessment)/edit/print pages | — |
| `src/middleware.ts` | session refresh; redirects unauthenticated → /login | — |

## Invariants (do not break)
- BMI is never stored; always computed from weight/height.
- Patient codes are assigned only inside `createPatient`'s transaction.
- Document rows exist only if the file upload succeeded (and vice-versa cleanup).
- All file access via signed URLs; bucket is private; service-role key server-only.
- Every mutation goes through a server action that calls `requireUser()` first (auth actions excepted — they create/end the session itself).

## How to add a feature (pattern)
1. Schema change → `src/db/schema.ts` → `npm run db:generate` → commit migration.
2. Repo function in `src/data/<domain>.ts` + PGlite test in `tests/data/`.
3. Server action in `src/actions/<domain>.ts` + test in `tests/actions/` (mocks in `tests/helpers/action-mocks.ts`).
4. UI in `src/app/(app)/...` using `InlineForm`.

## Testing
- `tests/helpers/db.ts` — in-memory PGlite running real migrations.
- `tests/helpers/fake-storage.ts` — `FileStorage` fake with failure injection.
- `tests/helpers/action-mocks.ts` — vi.mocks for db client, storage, auth, next/cache, next/navigation.
- Auth/storage glue is unit-tested with mocked Supabase clients (`tests/actions/auth.test.ts`, `tests/lib/auth.test.ts`, `tests/lib/storage.test.ts`).
- Coverage: 80% enforced on lib/data/actions. UI = component test (PatientForm) + `next build` + manual checklist in `docs/setup.md`.

## Phase roadmap
Spec: `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md`.
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups ✅.
Phase 3: WhatsApp/SMS (Twilio), fees, CSV export, audit logs.
