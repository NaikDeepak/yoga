# Architecture & Code Index

Read this before touching code — it replaces scanning `src/`.

## System shape
Next.js 15 App Router monolith. Supabase = Postgres + Auth + Storage (private bucket `patient-files`).
Drizzle ORM everywhere; tests run the same migrations on in-memory PGlite.

**Local mock mode** (`LOCAL_MOCK=true`, dev-only): file-backed PGlite at `.local-db/` (migrated +
seeded at startup via `src/instrumentation.ts`), cookie-based mock auth
(`dr.pawar@example.com` / `password`), files under `public/uploads/`, canned Gemini draft when no
API key. All branches gate on `isLocalMock()` (`src/lib/local-mock.ts`), which throws in production.

Request flow: page (server component) → `src/actions/*` ('use server': auth → zod → repo → revalidate)
→ `src/data/*` (pure DB functions taking `db`) → `src/db/schema.ts`.

**Design tokens** (spacing, color, typography): `docs/superpowers/specs/2026-06-17-design-language-system.md`, Section 1 — the single source of truth for heading/text/card/button classNames.

## Module map
| Path | Responsibility | Key exports |
|---|---|---|
| `src/db/schema.ts` | 9 tables: patients, patient_problems, documents, treatment_plans, visits, lifestyle_assessments, fees, fee_payments, user_preferences | table objects + row types |
| `src/db/client.ts` | prod DB singleton; local-mock branch reads the PGlite cache | `getDb()` |
| `src/db/types.ts` | DB type shared by prod/test | `Db` |
| `src/db/local-cache.ts` | globalThis handle for the mock PGlite db (HMR-safe, no PGlite import) | `getLocalDbCache`, `setLocalDbCache` |
| `src/db/local-client.ts` | file-backed PGlite at `.local-db/` + migrate-and-seed promise | `getLocalDb`, `LOCAL_DB_DIR` |
| `src/db/seed-mock.ts` | idempotent demo data (patients, visits, fees…; no documents) | `seedMockData` |
| `src/instrumentation.ts` | Next startup hook: awaits mock DB readiness before first request | `register` |
| `src/lib/local-mock.ts` | mock-mode flag + identity; throws if enabled in production | `isLocalMock`, `MOCK_USER`, `MOCK_PASSWORD`, `MOCK_SESSION_COOKIE` |
| `src/lib/bmi.ts` | BMI math | `computeBmi`, `bmiCategory` |
| `src/lib/patient-code.ts` | PYT-0001 sequence | `nextPatientCode`, `formatPatientCode` |
| `src/lib/presets.ts` | 18 Marathi ailments, doc types | `PRESET_PROBLEMS`, `DOC_TYPES` |
| `src/lib/calendar.ts` | pure month-grid date math | `buildMonthGrid`, `shiftMonth`, `parseMonth`, `monthRange` |
| `src/lib/dates.ts` | IST date strings + display formats (`formatDueDate` = "14 Jul" for near-term, `formatFullDate` = "14 Jul 2026" for histories) | `getISTDateString`, `formatDueDate`, `formatFullDate` |
| `src/lib/wellness.ts` | bilingual health-tip library (`wellness-messages.json`) + wa.me share URL without number (opens WhatsApp contact/broadcast picker) | `WELLNESS_MESSAGES`, `wellnessMessageForDay`, `buildWellnessMessage`, `wellnessShareUrl` |
| `src/lib/clinic.ts` | clinic identity constant (name, phone, wa.me digits; used by letterhead + digest) | `CLINIC` |
| `src/lib/whatsapp.ts` | free wa.me deep-link reminders: URL + bilingual message builders (no API) | `waMeUrl`, `reminderUrl`, `buildReminderMessage`, `buildDigestMessage`, `digestUrl` |
| `src/lib/files.ts` | upload rules (4MB — Vercel body limit, pdf/jpg/png) | `validateUpload`, `validatePhoto` |
| `src/lib/validation.ts` | zod schemas, bilingual messages | `patientSchema`, `problemSchema`, `treatmentSchema`, `visitSchema`, `lifestyleSchema`, `docTypeSchema`, `firstError` |
| `src/lib/storage.ts` | file storage abstraction (Supabase / R2 / local-mock fs) | `FileStorage`, `getStorage()`, `localFileStorage`, `BUCKET` |
| `src/lib/r2-storage.ts` | Cloudflare R2 storage implementation | `r2Storage` |
| `src/lib/gemini.ts` | Gemini 2.5 Flash REST client wrapper | `generateTreatmentDraft` |
| `src/lib/auth.ts` / `auth-paths.ts` | session guard; `/login` + `/register` are public; API routes use the non-redirecting check | `requireUser`, `getSessionUser`, `isPublicPath` |
| `src/lib/supabase/*` | vendor cookie glue (coverage-exempt) | `createSupabaseServerClient`, `updateSession` |
| `src/data/patients.ts` | CRUD + search + code assignment (transaction) | `createPatient`, `getPatient`, `updatePatient`, `setPhotoPath`, `searchPatients` |
| `src/data/problems.ts` | ailment rows | `addProblem`, `listProblems`, `removeProblem`, `problemsForPatients` |
| `src/data/documents.ts` | upload-then-insert, cleanup on failure | `addDocument`, `listDocuments`, `deleteDocument` |
| `src/data/treatment.ts` | one plan per patient (upsert) | `getTreatmentPlan`, `upsertTreatmentPlan` |
| `src/data/dashboard.ts` | aggregate queries for global stats | `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` |
| `src/data/fees.ts` | course fee + payments per patient; clinic-wide unpaid list for dashboard | `getPatientFees`, `setCourseFee`, `addPayment`, `deletePayment`, `getOutstandingBalances` |
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits`, `listVisitsWithData`, `getISTDateString`, `getFollowUpsThisWeek`, `getFollowUpsInRange` |
| `src/data/lifestyle.ts` | one assessment per patient (upsert) | `getLifestyleAssessment`, `upsertLifestyleAssessment` |
| `src/data/preferences.ts` | per-user prefs (language, WhatsApp digest number; upserts never clobber each other) | `getUserLanguage`, `setUserLanguage`, `getWhatsappNumber`, `setWhatsappNumber` |
| `src/data/exercises.ts` | bilingual exercise library + per-patient prescriptions (`prescribed_exercises` join table; dose overrides fall back to library defaults; save replaces the whole set; DB enforces unique `exercises.name`, category CHECK, unique `(patient_id, exercise_id)`) | `listAllExercises`, `getPrescribedExercises`, `savePrescribedExercises` |
| `src/db/seed-exercises.ts` | idempotent exercise-library upsert from `src/db/seed-data/*.json`, keyed on `name` (skips no-op updates, preserves `image_path` when image map lacks an entry, warns on DB rows absent from seed JSON; used by tests and `scripts/seed-db.ts`) | `seedExercises` |
| `src/actions/auth.ts` | sign in / sign out / sign up (Supabase Auth) | `signInAction`, `signOutAction`, `signUpAction` |
| `src/actions/preferences.ts` | save language (+ lang cookie) / WhatsApp digest number | `saveLanguageAction`, `saveWhatsappNumberAction` |
| `src/actions/exercises.ts` | save a patient's prescribed-exercise set (JSON payload from the picker form) | `savePrescribedExercisesAction` |
| `src/actions/*` (rest) | server actions per domain; all return `ActionResult` | `*Action` functions |
| `src/components/*` | Client islands: PatientForm (live BMI, grouped sections), InlineForm (error display), DeleteButton (AlertDialog confirm), PrintButton, AilmentBarChart (Recharts horizontal bar), VisitLineChart (Recharts line), TreatmentPlanForm (AI treatment builder), PatientHeader (sticky compact header via IntersectionObserver), TabDropdown (mobile tab select), GlobalSearch (debounced live patient search dropdown in top nav), BranchFilter (branch-scoped dashboard filter), CalendarMonthGrid (read-only month-grid follow-up view with day-click dialog), PrescribedExercisesForm (exercise-library picker with per-patient reps/frequency overrides + custom note), WellnessTipCard (sidebar health tip of the day + WhatsApp share via contact picker), PainScaleInput (segmented 1–10 pain picker, hidden input for server forms) | — |
| `src/components/ui/native-select.tsx` | styled native `<select>` for server-rendered forms (Input-matched look; used by problems/documents/assessment forms) | `NativeSelect` |
| `src/components/ui/*` | shadcn/ui generated components (Button, Input, Label, Card, Badge, AlertDialog, Dialog, Avatar, Separator, Tabs, Textarea, Select) | — |
| `src/lib/utils.ts` | shadcn `cn()` helper (clsx + tailwind-merge) | `cn` |
| `src/app/login` / `src/app/register` | public auth pages (forms post to auth actions) | — |
| `src/app/api/ai/treatment-plan/[patientId]` | API GET route handler to draft treatment plan using Gemini | — |
| `src/app/api/patients/search` | API GET route handler backing the global search dropdown | — |
| `src/app/(app)/dashboard` | clinic-wide stats, ailment bar chart, recent visits, day-grouped follow-up agenda, branch filter, quick-add patient | — |
| `src/app/(app)/calendar` | read-only month-grid view of upcoming follow-ups, branch filter, month navigation | — |
| `src/app/(app)/patients/*` | list/new/detail/edit/print pages. Detail has 5 tabs (overview incl. problems + visit summary, treatment incl. progress charts, documents, fees, assessment); legacy `?tab=problems/progress` map to their new homes | — |
| `src/middleware.ts` | session refresh; redirects unauthenticated → /login (`/api/*` exempt — handlers return 401 JSON) | — |

## Invariants (do not break)
- BMI is never stored; always computed from weight/height.
- Patient codes are assigned only inside `createPatient`'s transaction.
- Document rows exist only if the file upload succeeded (and vice-versa cleanup).
- All file access via signed URLs; bucket is private; service-role key server-only.
- Every mutation goes through a server action that calls `requireUser()` first (auth actions excepted — they create/end the session itself).
- Mock mode never runs in production: `isLocalMock()` throws when `LOCAL_MOCK=true` under `NODE_ENV=production`; never read `process.env.LOCAL_MOCK` directly.

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
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups ✅; global search ✅; branch filter ✅; calendar month view ✅.
Phase 3: fee tracking + receipts ✅; WhatsApp reminders via free wa.me deep links ✅ (spec `2026-07-02-whatsapp-reminders-design.md`; Cloud API/Twilio automation still future); exercise library + prescriptions ✅ (spec `2026-07-16-exercise-library-design.md`, retroactive); CSV export, audit logs.
