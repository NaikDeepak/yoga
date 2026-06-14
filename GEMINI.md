# GEMINI.md — Pawar Yoga Therapy (Session Context)

> Read this first. It replaces scanning `src/`. See also `docs/architecture.md` for the canonical module map.

## What this is

Single-clinic patient management app for **Pawar Yoga Therapy** (a yoga therapist practice in Maharashtra, India). Bilingual: all UI labels are `English / मराठी`. One authenticated user (Dr. Pawar).

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, server components, server actions) |
| DB | Postgres via `DATABASE_URL` — works with **Supabase** (default) or **Neon** (free tier, never pauses). Drizzle ORM, `postgres` driver, `prepare: false` for pooler compat |
| Auth | Supabase Auth (email/password), enforced via `requireUser()` in actions + middleware. Daily `/api/ping` cron keeps free-tier project active |
| Storage | **Supabase Storage** (default) or **Cloudflare R2** (auto-selected when `R2_ACCOUNT_ID` is set). Private bucket `patient-files`, accessed via signed URLs. R2 uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| UI | shadcn/ui + Tailwind CSS 4 + Radix UI + Lucide icons + Recharts |
| Validation | Zod 4 (bilingual error messages) |
| Testing | Vitest + PGlite (in-memory Postgres) + Testing Library. 80% coverage gate on `src/lib`, `src/data`, `src/actions` |
| Deploy | Vercel |

## Database schema (6 tables, all RLS-enabled)

```
patients          — id, patient_code (PYT-0001), full_name, photo_path, age, gender, weight_kg, height_cm, mobile, email, address, occupation, emergency_contact, created_at
patient_problems  — id, patient_id FK, problem, is_custom, note, created_at
documents         — id, patient_id FK, doc_type, file_path, original_name, mime_type, size_bytes, created_at
treatment_plans   — id, patient_id FK (unique), yoga_program, pranayam, massage, yoga_therapy, diet_plan, medicines, panchkarma, updated_at, created_at
visits            — id, patient_id FK, visit_date, progress_note, weight_kg, pain_scale (1-10), next_visit_date, created_at
lifestyle_assessments — id, patient_id FK (unique), chief_complaint, duration, aggravating_factors, relieving_factors, previous_treatment, current_medications, doctor_diagnosis, doctor_restrictions, work_type, daily_sitting, activity_level, sleep_hours, sleep_quality (1-10), stress_level (1-10), screen_time, previous_exercise, fitness_level, fear_of_movement, primary_goal, activity_struggle, has_contraindications, contraindication_details, updated_at, created_at
```

Key constraints: `treatment_plans` and `lifestyle_assessments` are 1:1 with patient (upsert pattern). BMI is never stored — computed from weight/height. Patient codes are assigned only inside `createPatient`'s transaction.

## File structure (what goes where)

```
src/
├── db/
│   ├── schema.ts         — all 6 table definitions + types
│   ├── client.ts         — getDb() singleton (prod), prepare:false for pooler compat
│   └── types.ts          — Db type (shared prod/test)
├── lib/
│   ├── validation.ts     — zod schemas: patientSchema, problemSchema, treatmentSchema, visitSchema, lifestyleSchema, docTypeSchema, firstError()
│   ├── bmi.ts            — computeBmi(), bmiCategory()
│   ├── patient-code.ts   — nextPatientCode(), formatPatientCode()
│   ├── presets.ts        — PRESET_PROBLEMS (18 Marathi ailments), DOC_TYPES
│   ├── files.ts          — validateUpload(), validatePhoto() (10MB, pdf/jpg/png)
│   ├── storage.ts        — FileStorage interface, getStorage() (auto-selects Supabase or R2), BUCKET, re-exports r2Storage
│   ├── r2-storage.ts     — Cloudflare R2 FileStorage impl via @aws-sdk/client-s3 (coverage-exempt)
│   ├── auth.ts           — requireUser()
│   ├── auth-paths.ts     — isPublicPath() (/login, /register)
│   ├── dates.ts          — getISTDateString(offsetDays) — IST via UTC+5:30
│   ├── utils.ts          — cn() (clsx + tailwind-merge)
│   └── supabase/         — cookie-based Supabase client glue (coverage-exempt)
├── data/                 — pure DB functions (all take `db` as first arg)
│   ├── patients.ts       — createPatient, getPatient, updatePatient, setPhotoPath, searchPatients
│   ├── problems.ts       — addProblem, listProblems, removeProblem, problemsForPatients
│   ├── documents.ts      — addDocument, listDocuments, deleteDocument
│   ├── treatment.ts      — getTreatmentPlan, upsertTreatmentPlan
│   ├── visits.ts         — addVisit, listVisits, listVisitsWithData, getFollowUpsThisWeek
│   ├── lifestyle.ts      — getLifestyleAssessment, upsertLifestyleAssessment, getLifestyleAssessmentSnapshot, assessmentCompletionForPatients
│   └── dashboard.ts      — getDashboardStats, getAilmentBreakdown, getRecentVisits
├── actions/              — server actions ('use server'): auth → zod → repo → revalidatePath
│   ├── auth.ts           — signInAction, signOutAction, signUpAction
│   ├── patients.ts       — createPatientAction, updatePatientAction, uploadPhotoAction
│   ├── problems.ts       — addProblemAction, removeProblemAction
│   ├── documents.ts      — uploadDocumentAction, deleteDocumentAction
│   ├── treatment.ts      — saveTreatmentPlanAction
│   ├── visits.ts         — addVisitAction
│   └── lifestyle.ts      — saveLifestyleAssessmentAction
├── components/
│   ├── PatientForm.tsx   — client component: live BMI calc, grouped sections, photo upload
│   ├── InlineForm.tsx    — client component: form with error display (useActionState)
│   ├── DeleteButton.tsx  — client component: AlertDialog confirm → delete
│   ├── PrintButton.tsx   — client component: window.print() trigger
│   ├── AilmentBarChart.tsx — Recharts horizontal bar chart
│   ├── VisitLineChart.tsx  — Recharts line chart (weight/pain trends)
│   └── ui/               — shadcn/ui: alert-dialog, avatar, badge, button, card, dialog, input, label, select, separator, tabs, textarea
├── app/
│   ├── api/ping/route.ts — Supabase Auth keepalive (daily Vercel cron, unauthenticated)
│   ├── login/page.tsx    — public login form
│   ├── register/page.tsx — public registration form
│   └── (app)/            — authenticated routes (layout has nav header + sign out)
│       ├── layout.tsx    — sticky header: logo, Dashboard link, Patients link, user email, sign out
│       ├── dashboard/page.tsx — follow-ups this week, 4 stat cards, ailment bar chart, recent activity
│       └── patients/
│           ├── page.tsx          — patient list with search, problem badges, assessment completion
│           ├── new/page.tsx      — create patient form
│           └── [id]/
│               ├── page.tsx      — tabbed detail: overview, problems, documents, treatment & visits, progress, assessment (URL-based tabs)
│               ├── edit/page.tsx  — edit patient form
│               └── print/page.tsx — printable patient report
└── middleware.ts         — session refresh, redirect unauthenticated → /login
```

## Data flow (strict layering)

```
Page (server component) → src/data/* (query DB via `db` arg)
                        → display data

User action (form submit) → src/actions/* → requireUser() → zod parse → src/data/* → revalidatePath
```

Never query DB from a page directly — always through `src/data/*`. Never call `src/data/*` from client components — always through server actions.

## Dashboard (current state)

The dashboard at `/dashboard` currently shows:
1. **Follow-ups This Week** — patients with `next_visit_date` in next 7 days, each with WhatsApp reminder link
2. **4 stat cards** — total patients, visits this month, most common problem, avg pain this month
3. **Ailment Breakdown** — horizontal bar chart (top 8 ailments by patient count)
4. **Recent Activity** — last 10 visits with patient name, code, weight, pain dot

## Patient detail page (tabbed)

6 tabs (URL-based via `?tab=`): overview (personal/body metrics/contact/assessment snapshot), problems (preset + custom), documents (upload/download), treatment & visits (plan form + visit log), progress (weight + pain line charts), assessment (5-section lifestyle form).

## Conventions

- **Bilingual**: every user-facing label is `English / मराठी`
- **TDD**: failing test → minimal code → commit
- **Tests mirror src**: `tests/data/`, `tests/actions/`, `tests/lib/`
- **Test helpers**: `tests/helpers/db.ts` (PGlite), `tests/helpers/fake-storage.ts`, `tests/helpers/action-mocks.ts`
- **IST timezone**: all date logic uses `getISTDateString()` (UTC+5:30 offset)
- **ActionResult pattern**: all actions return `{ error?: string }` for InlineForm error display
- **Docs sync**: update `docs/architecture.md` in same commit as structural changes

## Commands

```bash
npm run dev              # local dev server
npm test                 # vitest run
npm run coverage         # vitest with coverage (80% gate)
npm run typecheck        # tsc --noEmit
npm run build            # production build
npm run db:generate      # drizzle-kit generate (after schema changes)
npm run db:migrate       # drizzle-kit migrate
```

## Phase roadmap

- **Phase 1** ✅: Core CRUD (patients, problems, documents, treatment plans, visits)
- **Phase 2** ✅: Dashboard + charts, lifestyle assessment form, follow-up tracking
- **Phase 3** (upcoming): WhatsApp/SMS (Twilio), fees, CSV export, audit logs, dashboard enhancements

## Infra architecture (zero-cost path)

The app supports a **zero-cost infrastructure** deployment by swapping paid Supabase services for free alternatives while keeping Supabase Auth:

| Service | Default (Supabase) | Zero-cost alternative |
|---|---|---|
| Database | Supabase Postgres | **Neon** (free tier, never pauses) — just swap `DATABASE_URL` |
| File storage | Supabase Storage | **Cloudflare R2** (10GB free, zero egress) — set `R2_ACCOUNT_ID` |
| Auth | Supabase Auth | Supabase Auth (kept — `/api/ping` cron prevents free-tier pause) |

- `getStorage()` in `src/lib/storage.ts` auto-selects R2 vs Supabase based on `R2_ACCOUNT_ID` env var
- `vercel.json` configures a daily cron (`0 3 * * *`) hitting `/api/ping` to keep Supabase Auth alive
- See `docs/setup.md` for Neon and R2 migration guides

## Active planning docs

- `docs/superpowers/specs/` — design specs for features
- `docs/superpowers/plans/` — implementation plans
- `docs/architecture.md` — canonical module map (keep in sync)

## Env vars needed

```
# Always required (Supabase Auth)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Database (Supabase default, or Neon pooled URL)
DATABASE_URL

# Optional — set all 4 to use Cloudflare R2 instead of Supabase Storage
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
```
