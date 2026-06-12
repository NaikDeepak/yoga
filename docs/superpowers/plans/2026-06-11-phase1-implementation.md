# Yoga Patient Management Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 MVP from `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md` — admin login, patient registration (live BMI, auto codes), health problems, document uploads, treatment plan + visits, print/PDF export — TDD with ≥80% coverage on logic layers, plus CLAUDE.md and an architecture index doc.

**Architecture:** One Next.js 15 (App Router, TypeScript, `src/` dir) app. Supabase provides Postgres, Auth (single admin), and Storage (private `patient-files` bucket). Drizzle ORM for typed queries; tests run the same schema against in-memory PGlite. Pure logic in `src/lib`, repository functions in `src/data` (take `db` as a parameter — testable), server actions in `src/actions` (auth + wiring), UI in `src/app`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, Drizzle ORM + postgres-js, @electric-sql/pglite (tests), Supabase (@supabase/supabase-js, @supabase/ssr), Zod, Vitest + @vitest/coverage-v8 + Testing Library.

**Coverage policy:** `vitest --coverage` enforces 80% lines/functions/branches/statements over `src/lib/**`, `src/data/**`, `src/actions/**`. UI pages (server components) are validated by `next build` + a component test for the BMI form + the manual checklist. This is documented in CLAUDE.md.

---

## File Structure

```
yoga/
├── CLAUDE.md                          # entry point: commands, conventions, doc index
├── docs/
│   ├── architecture.md                # CODE INDEX: module map, data flow, how-to-extend
│   ├── setup.md                       # Supabase project/bucket/admin-user setup
│   └── superpowers/{specs,plans}/     # existing
├── package.json / tsconfig.json / next.config.ts / postcss.config.mjs
├── vitest.config.ts / drizzle.config.ts / .env.example / .gitignore
├── drizzle/                           # generated SQL migrations
├── middleware.ts                      # auth gate (Supabase session refresh + redirect)
└── src/
    ├── db/
    │   ├── schema.ts                  # 5 tables
    │   ├── client.ts                  # getDb() — prod postgres-js singleton
    │   └── types.ts                   # Db type (prod + test compatible)
    ├── lib/
    │   ├── bmi.ts                     # computeBmi, bmiCategory
    │   ├── patient-code.ts            # nextPatientCode, formatPatientCode
    │   ├── presets.ts                 # 18 Marathi ailments, doc types
    │   ├── files.ts                   # upload validation (mime/size)
    │   ├── validation.ts              # zod schemas (shared client/server)
    │   ├── auth-paths.ts              # isPublicPath (pure, testable)
    │   ├── auth.ts                    # requireUser()
    │   ├── storage.ts                 # FileStorage interface + supabase impl + getStorage()
    │   └── supabase/{server.ts,middleware.ts}
    ├── data/                          # repositories: (db, ...) => rows
    │   ├── patients.ts  ├── problems.ts  ├── documents.ts
    │   ├── treatment.ts └── visits.ts
    ├── actions/                       # 'use server': auth + validate + repo + revalidate
    │   ├── auth.ts ├── patients.ts ├── problems.ts
    │   ├── documents.ts ├── treatment.ts └── visits.ts
    ├── components/
    │   ├── PatientForm.tsx            # client: live BMI, create+edit
    │   ├── DeleteButton.tsx           # client: confirm-then-submit
    │   └── PrintButton.tsx            # client: window.print()
    └── app/
        ├── layout.tsx / globals.css
        ├── login/page.tsx
        └── (app)/
            ├── layout.tsx             # header/nav/signout
            └── patients/
                ├── page.tsx           # list + search
                ├── new/page.tsx
                └── [id]/
                    ├── page.tsx       # tabs: overview|problems|documents|treatment
                    ├── edit/page.tsx
                    └── print/page.tsx
tests/
    ├── helpers/{db.ts,fake-storage.ts}
    ├── lib/*.test.ts  ├── data/*.test.ts  ├── actions/*.test.ts
    └── components/patient-form.test.tsx
```

---

### Task 1: Project scaffold + test runner

**Files:** Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `.gitignore`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/smoke.test.ts`, initial `CLAUDE.md`

- [x] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "yoga-patient-management",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Install (exact commands):
```bash
npm install next@15 react@19 react-dom@19 drizzle-orm postgres @supabase/supabase-js @supabase/ssr zod
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss drizzle-kit vitest @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths @electric-sql/pglite jsdom @testing-library/react @testing-library/dom
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false, "skipLibCheck": true, "strict": true,
    "noEmit": true, "esModuleInterop": true, "module": "esnext",
    "moduleResolution": "bundler", "resolveJsonModule": true,
    "isolatedModules": true, "jsx": "preserve", "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/data/**', 'src/actions/**'],
      exclude: ['src/lib/supabase/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```
(`src/lib/supabase/**` holds vendor-glue cookie plumbing copied from Supabase docs; excluded as untestable I/O glue. Everything else in lib/data/actions is measured.)

`.gitignore`:
```
node_modules/
.next/
.env*.local
coverage/
*.tsbuildinfo
next-env.d.ts
```

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.YOUR-PROJECT:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

`src/app/globals.css`:
```css
@import 'tailwindcss';
```

`src/app/layout.tsx`:
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pawar Yoga Therapy' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/patients');
}
```

- [x] **Step 2: Write smoke test** — `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('test runner', () => {
  it('runs', () => expect(1 + 1).toBe(2));
});
```

- [x] **Step 3: Run** `npm test` — Expected: 1 passed.

- [x] **Step 4: Write initial `CLAUDE.md`** (finalized in Task 15):
```markdown
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
```

- [x] **Step 5: Commit**
```bash
git add -A && git commit -m "chore: scaffold Next.js app with vitest, tailwind, drizzle tooling"
```

---

### Task 2: DB schema + migrations + PGlite test harness

**Files:** Create: `src/db/schema.ts`, `src/db/types.ts`, `src/db/client.ts`, `drizzle.config.ts`, `tests/helpers/db.ts` — Test: `tests/data/schema.test.ts`

- [x] **Step 1: Write the failing test** — `tests/data/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers/db';
import { patients, patientProblems } from '@/db/schema';

describe('schema', () => {
  it('inserts and reads a patient', async () => {
    const db = await createTestDb();
    const [row] = await db.insert(patients).values({
      patientCode: 'PYT-0001', fullName: 'Asha Pawar', mobile: '9876543210',
    }).returning();
    expect(row.id).toBeTruthy();
    expect(row.patientCode).toBe('PYT-0001');
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate patient codes', async () => {
    const db = await createTestDb();
    const base = { fullName: 'A', mobile: '9876543210' };
    await db.insert(patients).values({ ...base, patientCode: 'PYT-0001' });
    await expect(
      db.insert(patients).values({ ...base, patientCode: 'PYT-0001' }),
    ).rejects.toThrow();
  });

  it('cascades problems on patient delete', async () => {
    const db = await createTestDb();
    const [p] = await db.insert(patients).values({
      patientCode: 'PYT-0001', fullName: 'A', mobile: '9876543210',
    }).returning();
    await db.insert(patientProblems).values({ patientId: p.id, problem: 'कंबर दुखी' });
    await db.delete(patients);
    expect(await db.select().from(patientProblems)).toHaveLength(0);
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/data/schema.test.ts` — Expected: FAIL (cannot resolve `@/db/schema`).

- [x] **Step 3: Implement**

`src/db/schema.ts`:
```ts
import {
  pgTable, uuid, text, integer, real, boolean, date, timestamp,
} from 'drizzle-orm/pg-core';

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientCode: text('patient_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  photoPath: text('photo_path'),
  age: integer('age'),
  gender: text('gender'),
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),
  mobile: text('mobile').notNull(),
  email: text('email'),
  address: text('address'),
  occupation: text('occupation'),
  emergencyContact: text('emergency_contact'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const patientProblems = pgTable('patient_problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  problem: text('problem').notNull(),
  isCustom: boolean('is_custom').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  docType: text('doc_type').notNull(),
  filePath: text('file_path').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const treatmentPlans = pgTable('treatment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  yogaProgram: text('yoga_program'),
  pranayam: text('pranayam'),
  massage: text('massage'),
  yogaTherapy: text('yoga_therapy'),
  dietPlan: text('diet_plan'),
  medicines: text('medicines'),
  panchkarma: text('panchkarma'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const visits = pgTable('visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  visitDate: date('visit_date').notNull(),
  progressNote: text('progress_note').notNull(),
  weightKg: real('weight_kg'),
  painScale: integer('pain_scale'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type PatientProblem = typeof patientProblems.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type Visit = typeof visits.$inferSelect;
```

`src/db/types.ts`:
```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

// Base type satisfied by both the postgres-js prod client and the PGlite test client.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
```

`src/db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { Db } from './types';

let _db: Db | undefined;

export function getDb(): Db {
  if (!_db) {
    // prepare:false required for Supabase transaction pooler
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://localhost/placeholder' },
});
```

Generate migrations: `npm run db:generate` — Expected: creates `drizzle/0000_*.sql`.

`tests/helpers/db.ts`:
```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db as unknown as Db;
}
```

- [x] **Step 4: Run** `npx vitest run tests/data/schema.test.ts` — Expected: 3 passed.

- [x] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: drizzle schema, migrations, pglite test harness"
```

---

### Task 3: BMI logic (TDD)

**Files:** Create: `src/lib/bmi.ts` — Test: `tests/lib/bmi.test.ts`

- [x] **Step 1: Write the failing test** — `tests/lib/bmi.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeBmi, bmiCategory } from '@/lib/bmi';

describe('computeBmi', () => {
  it('computes weight/height² rounded to 1 decimal', () => {
    expect(computeBmi(70, 175)).toBe(22.9);
    expect(computeBmi(45, 160)).toBe(17.6);
  });
  it('returns null for missing or non-positive inputs', () => {
    expect(computeBmi(0, 175)).toBeNull();
    expect(computeBmi(70, 0)).toBeNull();
    expect(computeBmi(-5, 170)).toBeNull();
    expect(computeBmi(NaN, 170)).toBeNull();
    expect(computeBmi(undefined, 170)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('maps WHO bands with bilingual labels', () => {
    expect(bmiCategory(17)).toBe('Underweight / कमी वजन');
    expect(bmiCategory(18.5)).toBe('Normal / सामान्य');
    expect(bmiCategory(24.9)).toBe('Normal / सामान्य');
    expect(bmiCategory(25)).toBe('Overweight / जास्त वजन');
    expect(bmiCategory(30)).toBe('Obese / स्थूलता');
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/lib/bmi.test.ts` — Expected: FAIL (module not found).

- [x] **Step 3: Implement** — `src/lib/bmi.ts`:
```ts
export function computeBmi(
  weightKg: number | undefined | null,
  heightCm: number | undefined | null,
): number | null {
  if (!weightKg || !heightCm || !Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight / कमी वजन';
  if (bmi < 25) return 'Normal / सामान्य';
  if (bmi < 30) return 'Overweight / जास्त वजन';
  return 'Obese / स्थूलता';
}
```

- [x] **Step 4: Run** `npx vitest run tests/lib/bmi.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: BMI computation and category"`

---

### Task 4: Patient code generation (TDD)

**Files:** Create: `src/lib/patient-code.ts` — Test: `tests/lib/patient-code.test.ts`

- [x] **Step 1: Write the failing test** — `tests/lib/patient-code.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatPatientCode, nextPatientCode } from '@/lib/patient-code';

describe('formatPatientCode', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatPatientCode(1)).toBe('PYT-0001');
    expect(formatPatientCode(42)).toBe('PYT-0042');
  });
  it('grows beyond 4 digits without truncation', () => {
    expect(formatPatientCode(10001)).toBe('PYT-10001');
  });
});

describe('nextPatientCode', () => {
  it('starts at PYT-0001 when no patients exist', () => {
    expect(nextPatientCode(null)).toBe('PYT-0001');
  });
  it('increments the last code', () => {
    expect(nextPatientCode('PYT-0007')).toBe('PYT-0008');
    expect(nextPatientCode('PYT-0999')).toBe('PYT-1000');
  });
  it('falls back to PYT-0001 on malformed input', () => {
    expect(nextPatientCode('garbage')).toBe('PYT-0001');
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/lib/patient-code.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement** — `src/lib/patient-code.ts`:
```ts
const PREFIX = 'PYT-';

export function formatPatientCode(n: number): string {
  return `${PREFIX}${String(n).padStart(4, '0')}`;
}

export function nextPatientCode(lastCode: string | null): string {
  const match = lastCode?.match(/^PYT-(\d+)$/);
  const last = match ? parseInt(match[1], 10) : 0;
  return formatPatientCode(last + 1);
}
```

- [x] **Step 4: Run** `npx vitest run tests/lib/patient-code.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: patient code generation"`

---

### Task 5: Presets + upload validation (TDD)

**Files:** Create: `src/lib/presets.ts`, `src/lib/files.ts` — Test: `tests/lib/files.test.ts`

- [x] **Step 1: Write the failing test** — `tests/lib/files.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateUpload, validatePhoto, MAX_FILE_BYTES } from '@/lib/files';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';

describe('presets', () => {
  it('has 18 preset problems and 5 doc types', () => {
    expect(PRESET_PROBLEMS).toHaveLength(18);
    expect(PRESET_PROBLEMS).toContain('कंबर दुखी');
    expect(DOC_TYPES).toEqual(['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other']);
  });
});

describe('validateUpload', () => {
  it('accepts pdf, jpeg, png under 10MB', () => {
    expect(validateUpload({ type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validateUpload({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validateUpload({ type: 'image/png', size: MAX_FILE_BYTES })).toBeNull();
  });
  it('rejects wrong type and oversize', () => {
    expect(validateUpload({ type: 'application/zip', size: 10 })).toMatch(/PDF/);
    expect(validateUpload({ type: 'image/png', size: MAX_FILE_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe('validatePhoto', () => {
  it('accepts jpeg/png, rejects pdf', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validatePhoto({ type: 'application/pdf', size: 100 })).toMatch(/JPG/);
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/lib/files.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement**

`src/lib/presets.ts`:
```ts
// 18 preset ailments from the proposal (Module 2), shown in Marathi.
export const PRESET_PROBLEMS = [
  'कंबर दुखी', 'मान दुखी', 'सायटिका', 'थायरॉईड', 'PCOD/PCOS', 'डायबिटीस',
  'बीपी', 'माइग्रेन', 'निद्रानाश', 'Anxiety', 'स्थूलता', 'गुडघे दुखी',
  'स्लिप डिस्क', 'गॅसेस', 'बद्धकोष्ठता', 'सांधेदुखी', 'पाठ दुखी', 'स्ट्रेस',
] as const;

export const DOC_TYPES = ['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other'] as const;
export type DocType = (typeof DOC_TYPES)[number];
```

`src/lib/files.ts`:
```ts
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const PHOTO_MIME = ['image/jpeg', 'image/png'];

type FileLike = { type: string; size: number };

export function validateUpload(file: FileLike): string | null {
  if (!DOC_MIME.includes(file.type)) return 'Only PDF, JPG, PNG allowed / फक्त PDF, JPG, PNG';
  if (file.size > MAX_FILE_BYTES) return 'File too large, max 10 MB / फाईल 10 MB पेक्षा लहान हवी';
  return null;
}

export function validatePhoto(file: FileLike): string | null {
  if (!PHOTO_MIME.includes(file.type)) return 'Photo must be JPG or PNG / फोटो JPG किंवा PNG हवा';
  if (file.size > MAX_FILE_BYTES) return 'File too large, max 10 MB / फाईल 10 MB पेक्षा लहान हवी';
  return null;
}
```

- [x] **Step 4: Run** `npx vitest run tests/lib/files.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: ailment/doc-type presets and upload validation"`

---

### Task 6: Zod validation schemas (TDD)

**Files:** Create: `src/lib/validation.ts` — Test: `tests/lib/validation.test.ts`

- [x] **Step 1: Write the failing test** — `tests/lib/validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  patientSchema, problemSchema, treatmentSchema, visitSchema, docTypeSchema,
} from '@/lib/validation';

describe('patientSchema', () => {
  it('accepts a minimal valid patient', () => {
    const r = patientSchema.safeParse({ fullName: 'Asha Pawar', mobile: '9876543210' });
    expect(r.success).toBe(true);
  });
  it('coerces numerics and drops empty strings', () => {
    const r = patientSchema.parse({
      fullName: 'A', mobile: '9876543210',
      age: '45', weightKg: '70.5', heightCm: '160', email: '', address: '',
    });
    expect(r.age).toBe(45);
    expect(r.weightKg).toBe(70.5);
    expect(r.email).toBeUndefined();
    expect(r.address).toBeUndefined();
  });
  it('rejects bad mobile, bad email, out-of-range age', () => {
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '12345' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', email: 'nope' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', age: '150' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: '', mobile: '9876543210' }).success).toBe(false);
  });
});

describe('problemSchema', () => {
  it('requires a problem name, allows note', () => {
    expect(problemSchema.parse({ problem: 'कंबर दुखी' }).isCustom).toBe(false);
    expect(problemSchema.parse({ problem: 'Vertigo', isCustom: 'true' }).isCustom).toBe(true);
    expect(problemSchema.safeParse({ problem: '  ' }).success).toBe(false);
  });
});

describe('visitSchema', () => {
  it('validates date, note, optional measurements', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'good', painScale: '7' });
    expect(r.painScale).toBe(7);
    expect(visitSchema.safeParse({ visitDate: 'June 11', progressNote: 'x' }).success).toBe(false);
    expect(visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'x', painScale: '11' }).success).toBe(false);
  });
});

describe('treatmentSchema', () => {
  it('all fields optional, empties dropped', () => {
    const r = treatmentSchema.parse({ yogaProgram: 'Surya Namaskar x12', dietPlan: '' });
    expect(r.yogaProgram).toBe('Surya Namaskar x12');
    expect(r.dietPlan).toBeUndefined();
  });
});

describe('docTypeSchema', () => {
  it('accepts known types only', () => {
    expect(docTypeSchema.safeParse('MRI').success).toBe(true);
    expect(docTypeSchema.safeParse('Selfie').success).toBe(false);
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/lib/validation.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement** — `src/lib/validation.ts`:
```ts
import { z } from 'zod';
import { DOC_TYPES } from './presets';

const blankToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndef, s.optional());

export const patientSchema = z.object({
  fullName: z.string().trim().min(1, 'Name required / नाव आवश्यक'),
  mobile: z.string().trim().regex(/^\d{10}$/, '10-digit mobile required / १० अंकी मोबाईल आवश्यक'),
  age: opt(z.coerce.number().int().min(1).max(120)),
  gender: opt(z.enum(['male', 'female', 'other'])),
  weightKg: opt(z.coerce.number().positive().max(300)),
  heightCm: opt(z.coerce.number().positive().max(250)),
  email: opt(z.string().trim().email('Invalid email / चुकीचा ईमेल')),
  address: opt(z.string().trim().max(500)),
  occupation: opt(z.string().trim().max(100)),
  emergencyContact: opt(z.string().trim().max(100)),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const problemSchema = z.object({
  problem: z.string().trim().min(1, 'Problem required / आजार आवश्यक').max(200),
  isCustom: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  note: opt(z.string().trim().max(500)),
});
export type ProblemInput = z.infer<typeof problemSchema>;

export const treatmentSchema = z.object({
  yogaProgram: opt(z.string().trim().max(2000)),
  pranayam: opt(z.string().trim().max(2000)),
  massage: opt(z.string().trim().max(2000)),
  yogaTherapy: opt(z.string().trim().max(2000)),
  dietPlan: opt(z.string().trim().max(2000)),
  medicines: opt(z.string().trim().max(2000)),
  panchkarma: opt(z.string().trim().max(2000)),
});
export type TreatmentInput = z.infer<typeof treatmentSchema>;

export const visitSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date required / तारीख आवश्यक'),
  progressNote: z.string().trim().min(1, 'Note required / नोंद आवश्यक').max(5000),
  weightKg: opt(z.coerce.number().positive().max(300)),
  painScale: opt(z.coerce.number().int().min(1).max(10)),
});
export type VisitInput = z.infer<typeof visitSchema>;

export const docTypeSchema = z.enum(DOC_TYPES);

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input / चुकीची माहिती';
}
```

- [x] **Step 4: Run** `npx vitest run tests/lib/validation.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: zod validation schemas for all forms"`

---

### Task 7: Patients repository (TDD)

**Files:** Create: `src/data/patients.ts` — Test: `tests/data/patients.test.ts`

- [x] **Step 1: Write the failing test** — `tests/data/patients.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient, getPatient, searchPatients, updatePatient, setPhotoPath } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const asha = { fullName: 'Asha Pawar', mobile: '9876543210' };

describe('createPatient', () => {
  it('assigns sequential codes', async () => {
    const p1 = await createPatient(db, asha);
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    expect(p1.patientCode).toBe('PYT-0001');
    expect(p2.patientCode).toBe('PYT-0002');
  });
});

describe('getPatient / updatePatient', () => {
  it('round-trips and updates', async () => {
    const p = await createPatient(db, asha);
    expect((await getPatient(db, p.id))?.fullName).toBe('Asha Pawar');
    await updatePatient(db, p.id, { ...asha, weightKg: 68 });
    expect((await getPatient(db, p.id))?.weightKg).toBe(68);
  });
  it('returns undefined for unknown id', async () => {
    expect(await getPatient(db, '00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });
});

describe('setPhotoPath', () => {
  it('stores the storage path', async () => {
    const p = await createPatient(db, asha);
    await setPhotoPath(db, p.id, 'patients/x/photo.jpg');
    expect((await getPatient(db, p.id))?.photoPath).toBe('patients/x/photo.jpg');
  });
});

describe('searchPatients', () => {
  it('matches name (case-insensitive) and mobile, newest first', async () => {
    await createPatient(db, asha);
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    expect(await searchPatients(db, 'asha')).toHaveLength(1);
    expect(await searchPatients(db, '90000')).toHaveLength(1);
    expect(await searchPatients(db, '')).toHaveLength(2);
    expect((await searchPatients(db)).map((p) => p.fullName)).toContain('Asha Pawar');
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/data/patients.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement** — `src/data/patients.ts`:
```ts
import { desc, eq, ilike, or } from 'drizzle-orm';
import { patients, type Patient } from '@/db/schema';
import type { Db } from '@/db/types';
import { nextPatientCode } from '@/lib/patient-code';
import type { PatientInput } from '@/lib/validation';

export async function createPatient(db: Db, input: PatientInput): Promise<Patient> {
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ code: patients.patientCode })
      .from(patients)
      .orderBy(desc(patients.patientCode))
      .limit(1);
    const [row] = await tx
      .insert(patients)
      .values({ ...input, patientCode: nextPatientCode(last?.code ?? null) })
      .returning();
    return row;
  });
}

export async function getPatient(db: Db, id: string): Promise<Patient | undefined> {
  const [row] = await db.select().from(patients).where(eq(patients.id, id));
  return row;
}

export async function updatePatient(db: Db, id: string, input: PatientInput): Promise<void> {
  await db.update(patients).set(input).where(eq(patients.id, id));
}

export async function setPhotoPath(db: Db, id: string, photoPath: string): Promise<void> {
  await db.update(patients).set({ photoPath }).where(eq(patients.id, id));
}

export async function searchPatients(db: Db, q?: string): Promise<Patient[]> {
  const query = q?.trim();
  const where = query
    ? or(ilike(patients.fullName, `%${query}%`), ilike(patients.mobile, `%${query}%`))
    : undefined;
  return db.select().from(patients).where(where).orderBy(desc(patients.createdAt));
}
```

- [x] **Step 4: Run** `npx vitest run tests/data/patients.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: patients repository with sequential codes and search"`

---

### Task 8: Problems, treatment, visits repositories (TDD)

**Files:** Create: `src/data/problems.ts`, `src/data/treatment.ts`, `src/data/visits.ts` — Test: `tests/data/clinical.test.ts`

- [x] **Step 1: Write the failing test** — `tests/data/clinical.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { addProblem, listProblems, removeProblem, problemsForPatients } from '@/data/problems';
import { getTreatmentPlan, upsertTreatmentPlan } from '@/data/treatment';
import { addVisit, listVisits } from '@/data/visits';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
});

describe('problems', () => {
  it('adds, lists, removes', async () => {
    const p = await addProblem(db, patientId, { problem: 'कंबर दुखी', isCustom: false });
    await addProblem(db, patientId, { problem: 'Vertigo', isCustom: true, note: 'mild' });
    expect(await listProblems(db, patientId)).toHaveLength(2);
    await removeProblem(db, p.id);
    expect((await listProblems(db, patientId)).map((x) => x.problem)).toEqual(['Vertigo']);
  });
  it('groups problems for many patients', async () => {
    await addProblem(db, patientId, { problem: 'बीपी', isCustom: false });
    const grouped = await problemsForPatients(db, [patientId]);
    expect(grouped[patientId].map((p) => p.problem)).toEqual(['बीपी']);
    expect(await problemsForPatients(db, [])).toEqual({});
  });
});

describe('treatment plan', () => {
  it('upserts a single plan per patient', async () => {
    expect(await getTreatmentPlan(db, patientId)).toBeUndefined();
    await upsertTreatmentPlan(db, patientId, { yogaProgram: 'Surya Namaskar' });
    await upsertTreatmentPlan(db, patientId, { yogaProgram: 'Surya Namaskar x12', dietPlan: 'No sugar' });
    const plan = await getTreatmentPlan(db, patientId);
    expect(plan?.yogaProgram).toBe('Surya Namaskar x12');
    expect(plan?.dietPlan).toBe('No sugar');
  });
});

describe('visits', () => {
  it('adds and lists newest-first', async () => {
    await addVisit(db, patientId, { visitDate: '2026-06-01', progressNote: 'start', weightKg: 72, painScale: 8 });
    await addVisit(db, patientId, { visitDate: '2026-06-10', progressNote: 'better', painScale: 5 });
    const all = await listVisits(db, patientId);
    expect(all).toHaveLength(2);
    expect(all[0].visitDate).toBe('2026-06-10');
    expect(all[1].weightKg).toBe(72);
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/data/clinical.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement**

`src/data/problems.ts`:
```ts
import { asc, eq, inArray } from 'drizzle-orm';
import { patientProblems, type PatientProblem } from '@/db/schema';
import type { Db } from '@/db/types';
import type { ProblemInput } from '@/lib/validation';

export async function addProblem(db: Db, patientId: string, input: ProblemInput): Promise<PatientProblem> {
  const [row] = await db.insert(patientProblems).values({ ...input, patientId }).returning();
  return row;
}

export async function listProblems(db: Db, patientId: string): Promise<PatientProblem[]> {
  return db.select().from(patientProblems)
    .where(eq(patientProblems.patientId, patientId))
    .orderBy(asc(patientProblems.createdAt));
}

export async function removeProblem(db: Db, problemId: string): Promise<void> {
  await db.delete(patientProblems).where(eq(patientProblems.id, problemId));
}

export async function problemsForPatients(
  db: Db, patientIds: string[],
): Promise<Record<string, PatientProblem[]>> {
  if (patientIds.length === 0) return {};
  const rows = await db.select().from(patientProblems)
    .where(inArray(patientProblems.patientId, patientIds));
  const grouped: Record<string, PatientProblem[]> = {};
  for (const row of rows) (grouped[row.patientId] ??= []).push(row);
  return grouped;
}
```

`src/data/treatment.ts`:
```ts
import { eq } from 'drizzle-orm';
import { treatmentPlans, type TreatmentPlan } from '@/db/schema';
import type { Db } from '@/db/types';
import type { TreatmentInput } from '@/lib/validation';

export async function getTreatmentPlan(db: Db, patientId: string): Promise<TreatmentPlan | undefined> {
  const [row] = await db.select().from(treatmentPlans).where(eq(treatmentPlans.patientId, patientId));
  return row;
}

export async function upsertTreatmentPlan(db: Db, patientId: string, input: TreatmentInput): Promise<void> {
  await db.insert(treatmentPlans)
    .values({ ...input, patientId })
    .onConflictDoUpdate({
      target: treatmentPlans.patientId,
      set: { ...input, updatedAt: new Date() },
    });
}
```

`src/data/visits.ts`:
```ts
import { desc, eq } from 'drizzle-orm';
import { visits, type Visit } from '@/db/schema';
import type { Db } from '@/db/types';
import type { VisitInput } from '@/lib/validation';

export async function addVisit(db: Db, patientId: string, input: VisitInput): Promise<Visit> {
  const [row] = await db.insert(visits).values({ ...input, patientId }).returning();
  return row;
}

export async function listVisits(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt));
}
```

- [x] **Step 4: Run** `npx vitest run tests/data/clinical.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: problems, treatment plan, visits repositories"`

---

### Task 9: Storage interface + documents repository (TDD)

**Files:** Create: `src/lib/storage.ts`, `src/data/documents.ts`, `tests/helpers/fake-storage.ts` — Test: `tests/data/documents.test.ts`

- [x] **Step 1: Write the failing test**

`tests/helpers/fake-storage.ts`:
```ts
import type { FileStorage } from '@/lib/storage';

export class FakeStorage implements FileStorage {
  files = new Map<string, Uint8Array>();
  failNextUpload = false;

  async upload(path: string, file: File): Promise<void> {
    if (this.failNextUpload) { this.failNextUpload = false; throw new Error('storage down'); }
    this.files.set(path, new Uint8Array(await file.arrayBuffer()));
  }
  async remove(path: string): Promise<void> { this.files.delete(path); }
  async createSignedUrl(path: string): Promise<string> { return `https://fake.local/${path}?signed`; }
}
```

`tests/data/documents.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { createPatient } from '@/data/patients';
import { addDocument, listDocuments, deleteDocument } from '@/data/documents';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;

const pdf = () => new File([new Uint8Array([1, 2, 3])], 'mri-scan.pdf', { type: 'application/pdf' });

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
});

describe('addDocument', () => {
  it('uploads file then inserts row with metadata', async () => {
    const doc = await addDocument(db, storage, { patientId, docType: 'MRI', file: pdf() });
    expect(doc.originalName).toBe('mri-scan.pdf');
    expect(doc.sizeBytes).toBe(3);
    expect(storage.files.has(doc.filePath)).toBe(true);
    expect(doc.filePath).toContain(`patients/${patientId}/documents/`);
  });
  it('does not insert a row when upload fails', async () => {
    storage.failNextUpload = true;
    await expect(addDocument(db, storage, { patientId, docType: 'MRI', file: pdf() }))
      .rejects.toThrow('storage down');
    expect(await db.select().from(documents)).toHaveLength(0);
  });
});

describe('listDocuments / deleteDocument', () => {
  it('lists by patient and deletes row + file', async () => {
    const doc = await addDocument(db, storage, { patientId, docType: 'Prescription', file: pdf() });
    expect(await listDocuments(db, patientId)).toHaveLength(1);
    await deleteDocument(db, storage, doc.id);
    expect(await listDocuments(db, patientId)).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });
  it('ignores delete of unknown id', async () => {
    await expect(deleteDocument(db, storage, '00000000-0000-0000-0000-000000000000'))
      .resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/data/documents.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement**

`src/lib/storage.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'patient-files';

export interface FileStorage {
  upload(path: string, file: File): Promise<void>;
  remove(path: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export function supabaseStorage(client: SupabaseClient): FileStorage {
  return {
    async upload(path, file) {
      const { error } = await client.storage.from(BUCKET).upload(path, file);
      if (error) throw new Error(`Upload failed: ${error.message}`);
    },
    async remove(path) {
      const { error } = await client.storage.from(BUCKET).remove([path]);
      if (error) throw new Error(`Remove failed: ${error.message}`);
    },
    async createSignedUrl(path, expiresInSeconds = 3600) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
      return data.signedUrl;
    },
  };
}

let _storage: FileStorage | undefined;
export function getStorage(): FileStorage {
  if (!_storage) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    _storage = supabaseStorage(client);
  }
  return _storage;
}
```

`src/data/documents.ts`:
```ts
import { desc, eq } from 'drizzle-orm';
import { documents, type DocumentRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import type { DocType } from '@/lib/presets';

export async function addDocument(
  db: Db,
  storage: FileStorage,
  input: { patientId: string; docType: DocType; file: File },
): Promise<DocumentRow> {
  const safeName = input.file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `patients/${input.patientId}/documents/${crypto.randomUUID()}-${safeName}`;
  await storage.upload(filePath, input.file); // upload first: no DB row unless the file exists
  try {
    const [row] = await db.insert(documents).values({
      patientId: input.patientId,
      docType: input.docType,
      filePath,
      originalName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    }).returning();
    return row;
  } catch (err) {
    await storage.remove(filePath); // no orphan files on insert failure
    throw err;
  }
}

export async function listDocuments(db: Db, patientId: string): Promise<DocumentRow[]> {
  return db.select().from(documents)
    .where(eq(documents.patientId, patientId))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(db: Db, storage: FileStorage, id: string): Promise<void> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  if (!row) return;
  await db.delete(documents).where(eq(documents.id, id));
  await storage.remove(row.filePath);
}
```

- [x] **Step 4: Run** `npx vitest run tests/data/documents.test.ts` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: file storage interface and documents repository with orphan prevention"`

---

### Task 10: Auth — Supabase clients, middleware, login page

**Files:** Create: `src/lib/auth-paths.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth.ts`, `middleware.ts`, `src/actions/auth.ts`, `src/app/login/page.tsx` — Test: `tests/lib/auth-paths.test.ts`

- [x] **Step 1: Write the failing test** — `tests/lib/auth-paths.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isPublicPath } from '@/lib/auth-paths';

describe('isPublicPath', () => {
  it('login and next internals are public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/_next/static/x.js')).toBe(true);
    expect(isPublicPath('/favicon.ico')).toBe(true);
  });
  it('app pages are protected', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/patients')).toBe(false);
    expect(isPublicPath('/patients/abc/print')).toBe(false);
  });
});
```

- [x] **Step 2: Run** `npx vitest run tests/lib/auth-paths.test.ts` — Expected: FAIL.

- [x] **Step 3: Implement**

`src/lib/auth-paths.ts`:
```ts
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}
```

`src/lib/supabase/server.ts` (standard @supabase/ssr pattern):
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    },
  );
}
```

`src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/auth-paths';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}
```

`middleware.ts` (repo root):
```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`src/lib/auth.ts`:
```ts
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}
```

`src/actions/auth.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) redirect('/login?error=1');
  redirect('/patients');
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

`src/app/login/page.tsx`:
```tsx
import { signInAction } from '@/actions/auth';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Pawar Yoga Therapy</h1>
      <p className="mb-6 text-sm text-stone-500">Admin Login / प्रवेश</p>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">
          Wrong email or password / चुकीचा ईमेल किंवा पासवर्ड
        </p>
      )}
      <form action={signInAction} className="space-y-4">
        <label className="block text-sm">
          Email / ईमेल
          <input name="email" type="email" required
            className="mt-1 w-full rounded border border-stone-300 p-2" />
        </label>
        <label className="block text-sm">
          Password / पासवर्ड
          <input name="password" type="password" required
            className="mt-1 w-full rounded border border-stone-300 p-2" />
        </label>
        <button className="w-full rounded bg-emerald-700 p-2 font-medium text-white hover:bg-emerald-800">
          Sign in / लॉगिन
        </button>
      </form>
    </main>
  );
}
```

- [x] **Step 4: Run** `npx vitest run tests/lib/auth-paths.test.ts && npm run typecheck` — Expected: PASS, no type errors.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: supabase auth, middleware gate, login page"`

---

### Task 11: Server actions (TDD)

**Files:** Create: `src/actions/patients.ts`, `src/actions/problems.ts`, `src/actions/documents.ts`, `src/actions/treatment.ts`, `src/actions/visits.ts`, `tests/helpers/action-mocks.ts` — Test: `tests/actions/actions.test.ts`

All actions: `requireUser()` → validate with zod → call repository → `revalidatePath` → return `{ ok: true }` or `{ ok: false, error }`. Create-patient redirects on success.

- [x] **Step 1: Write mocks helper** — `tests/helpers/action-mocks.ts`:
```ts
import { vi } from 'vitest';
import { createTestDb } from './db';
import { FakeStorage } from './fake-storage';
import type { Db } from '@/db/types';

export const storage = new FakeStorage();
export let testDb: Db;

export async function freshTestDb(): Promise<Db> {
  testDb = await createTestDb();
  storage.files.clear();
  return testDb;
}

vi.mock('@/db/client', () => ({ getDb: () => testDb }));
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStorage: () => storage,
}));
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn().mockResolvedValue({ id: 'admin' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));
```

- [x] **Step 2: Write the failing test** — `tests/actions/actions.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { createPatientAction, updatePatientAction } from '@/actions/patients';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { addVisitAction } from '@/actions/visits';
import { createPatient, searchPatients, getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('createPatientAction', () => {
  it('creates and redirects to detail page', async () => {
    await expect(createPatientAction(fd({ fullName: 'Asha Pawar', mobile: '9876543210' })))
      .rejects.toThrow(/REDIRECT:\/patients\//);
    expect(await searchPatients(db)).toHaveLength(1);
  });
  it('returns validation error without creating', async () => {
    const r = await createPatientAction(fd({ fullName: '', mobile: '12' }));
    expect(r).toMatchObject({ ok: false });
    expect(await searchPatients(db)).toHaveLength(0);
  });
  it('uploads photo when provided', async () => {
    const photo = new File([new Uint8Array([9])], 'face.png', { type: 'image/png' });
    await expect(createPatientAction(fd({ fullName: 'A', mobile: '9876543210', photo })))
      .rejects.toThrow(/REDIRECT/);
    const [p] = await searchPatients(db);
    expect(p.photoPath).toContain(`patients/${p.id}/`);
    expect(storage.files.has(p.photoPath!)).toBe(true);
  });
  it('rejects bad photo type before creating', async () => {
    const photo = new File([new Uint8Array([9])], 'x.pdf', { type: 'application/pdf' });
    const r = await createPatientAction(fd({ fullName: 'A', mobile: '9876543210', photo }));
    expect(r).toMatchObject({ ok: false });
    expect(await searchPatients(db)).toHaveLength(0);
  });
});

describe('updatePatientAction', () => {
  it('updates fields', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await updatePatientAction(p.id, fd({ fullName: 'Asha Pawar', mobile: '9876543210', weightKg: '68' }));
    expect(r).toEqual({ ok: true });
    expect((await getPatient(db, p.id))?.weightKg).toBe(68);
  });
});

describe('problems / treatment / visits actions', () => {
  it('full clinical flow', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    expect(await addProblemAction(p.id, fd({ problem: 'कंबर दुखी' }))).toEqual({ ok: true });
    const [prob] = await listProblems(db, p.id);
    expect(await removeProblemAction(p.id, prob.id)).toEqual({ ok: true });

    expect(await saveTreatmentPlanAction(p.id, fd({ yogaProgram: 'Bhujangasana' }))).toEqual({ ok: true });
    expect((await getTreatmentPlan(db, p.id))?.yogaProgram).toBe('Bhujangasana');

    expect(await addVisitAction(p.id, fd({ visitDate: '2026-06-11', progressNote: 'good', painScale: '6' })))
      .toEqual({ ok: true });
    expect(await listVisits(db, p.id)).toHaveLength(1);

    expect(await addVisitAction(p.id, fd({ visitDate: 'bad', progressNote: '' })))
      .toMatchObject({ ok: false });
  });
});

describe('documents actions', () => {
  it('uploads and deletes', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const file = new File([new Uint8Array([1])], 'rx.pdf', { type: 'application/pdf' });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'Prescription', file }))).toEqual({ ok: true });
    const [doc] = await listDocuments(db, p.id);
    expect(await deleteDocumentAction(p.id, doc.id)).toEqual({ ok: true });
    expect(await listDocuments(db, p.id)).toHaveLength(0);
  });
  it('rejects bad file type and missing file', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const bad = new File([new Uint8Array([1])], 'x.zip', { type: 'application/zip' });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'MRI', file: bad }))).toMatchObject({ ok: false });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'MRI' }))).toMatchObject({ ok: false });
  });
});
```

- [x] **Step 3: Run** `npx vitest run tests/actions/actions.test.ts` — Expected: FAIL.

- [x] **Step 4: Implement**

`src/actions/patients.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validatePhoto } from '@/lib/files';
import { patientSchema, firstError } from '@/lib/validation';
import { createPatient, setPhotoPath, updatePatient } from '@/data/patients';

export type ActionResult = { ok: true } | { ok: false; error: string };

function getPhoto(formData: FormData): File | null {
  const photo = formData.get('photo');
  return photo instanceof File && photo.size > 0 ? photo : null;
}

export async function createPatientAction(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photo = getPhoto(formData);
  if (photo) {
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
  }

  const db = getDb();
  const patient = await createPatient(db, parsed.data);
  if (photo) {
    const path = `patients/${patient.id}/photo-${Date.now()}-${photo.name.replace(/[^\w.\-]+/g, '_')}`;
    await getStorage().upload(path, photo);
    await setPhotoPath(db, patient.id, path);
  }
  revalidatePath('/patients');
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(id: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photo = getPhoto(formData);
  if (photo) {
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
  }

  const db = getDb();
  await updatePatient(db, id, parsed.data);
  if (photo) {
    const path = `patients/${id}/photo-${Date.now()}-${photo.name.replace(/[^\w.\-]+/g, '_')}`;
    await getStorage().upload(path, photo);
    await setPhotoPath(db, id, path);
  }
  revalidatePath(`/patients/${id}`);
  return { ok: true };
}
```

`src/actions/problems.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { problemSchema, firstError } from '@/lib/validation';
import { addProblem, removeProblem } from '@/data/problems';
import type { ActionResult } from './patients';

export async function addProblemAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = problemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await addProblem(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function removeProblemAction(patientId: string, problemId: string): Promise<ActionResult> {
  await requireUser();
  await removeProblem(getDb(), problemId);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

`src/actions/documents.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validateUpload } from '@/lib/files';
import { docTypeSchema } from '@/lib/validation';
import { addDocument, deleteDocument } from '@/data/documents';
import type { ActionResult } from './patients';

export async function uploadDocumentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const docType = docTypeSchema.safeParse(formData.get('docType'));
  if (!docType.success) return { ok: false, error: 'Choose a document type / प्रकार निवडा' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file / फाईल निवडा' };
  }
  const err = validateUpload(file);
  if (err) return { ok: false, error: err };

  await addDocument(getDb(), getStorage(), { patientId, docType: docType.data, file });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deleteDocumentAction(patientId: string, documentId: string): Promise<ActionResult> {
  await requireUser();
  await deleteDocument(getDb(), getStorage(), documentId);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

`src/actions/treatment.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { treatmentSchema, firstError } from '@/lib/validation';
import { upsertTreatmentPlan } from '@/data/treatment';
import type { ActionResult } from './patients';

export async function saveTreatmentPlanAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await upsertTreatmentPlan(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

`src/actions/visits.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { visitSchema, firstError } from '@/lib/validation';
import { addVisit } from '@/data/visits';
import type { ActionResult } from './patients';

export async function addVisitAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = visitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await addVisit(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
```

- [x] **Step 5: Run** `npx vitest run tests/actions/actions.test.ts` — Expected: all PASS.

- [x] **Step 6: Commit** — `git add -A && git commit -m "feat: server actions for patients, problems, documents, treatment, visits"`

---

### Task 12: Patient form (live BMI) + list page + app layout

**Files:** Create: `src/components/PatientForm.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/patients/page.tsx`, `src/app/(app)/patients/new/page.tsx`, `src/app/(app)/patients/[id]/edit/page.tsx` — Test: `tests/components/patient-form.test.tsx`

- [x] **Step 1: Write the failing component test** — `tests/components/patient-form.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientForm } from '@/components/PatientForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('PatientForm live BMI', () => {
  it('shows BMI as weight and height are typed', () => {
    render(<PatientForm action={vi.fn()} submitLabel="Save" />);
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText(/Height/), { target: { value: '175' } });
    expect(screen.getByTestId('bmi')).toHaveTextContent('22.9');
    expect(screen.getByTestId('bmi')).toHaveTextContent('Normal');
  });
  it('shows placeholder when inputs incomplete', () => {
    render(<PatientForm action={vi.fn()} submitLabel="Save" />);
    expect(screen.getByTestId('bmi')).toHaveTextContent('—');
  });
});
```
(Needs `@testing-library/jest-dom`: add `npm install -D @testing-library/jest-dom` and a `tests/setup.ts` with `import '@testing-library/jest-dom/vitest';`, registered in `vitest.config.ts` via `test.setupFiles: ['tests/setup.ts']`.)

- [x] **Step 2: Run** `npx vitest run tests/components/patient-form.test.tsx` — Expected: FAIL.

- [x] **Step 3: Implement**

`src/components/PatientForm.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import type { Patient } from '@/db/schema';
import type { ActionResult } from '@/actions/patients';

const field = 'mt-1 w-full rounded border border-stone-300 p-2';
const label = 'block text-sm font-medium';

export function PatientForm({
  action, defaultValues, submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  defaultValues?: Patient;
  submitLabel: string;
}) {
  const [weight, setWeight] = useState(defaultValues?.weightKg?.toString() ?? '');
  const [height, setHeight] = useState(defaultValues?.heightCm?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bmi = computeBmi(parseFloat(weight), parseFloat(height));

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-4">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className={label}>Full Name / पूर्ण नाव *
        <input name="fullName" required defaultValue={defaultValues?.fullName} className={field} />
      </label>
      <label className={label}>Photo / फोटो
        <input name="photo" type="file" accept="image/jpeg,image/png" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className={label}>Age / वय
          <input name="age" type="number" defaultValue={defaultValues?.age ?? ''} className={field} />
        </label>
        <label className={label}>Gender / लिंग
          <select name="gender" defaultValue={defaultValues?.gender ?? ''} className={field}>
            <option value="">—</option>
            <option value="male">Male / पुरुष</option>
            <option value="female">Female / स्त्री</option>
            <option value="other">Other / इतर</option>
          </select>
        </label>
        <label className={label}>Weight (kg) / वजन
          <input name="weightKg" type="number" step="0.1" value={weight}
            onChange={(e) => setWeight(e.target.value)} className={field} />
        </label>
        <label className={label}>Height (cm) / उंची
          <input name="heightCm" type="number" step="0.1" value={height}
            onChange={(e) => setHeight(e.target.value)} className={field} />
        </label>
      </div>
      <p data-testid="bmi" className="rounded bg-emerald-50 p-2 text-sm">
        BMI: {bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : '—'}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>Mobile / मोबाईल *
          <input name="mobile" required defaultValue={defaultValues?.mobile} className={field} />
        </label>
        <label className={label}>Email / ईमेल
          <input name="email" type="email" defaultValue={defaultValues?.email ?? ''} className={field} />
        </label>
        <label className={label}>Occupation / व्यवसाय
          <input name="occupation" defaultValue={defaultValues?.occupation ?? ''} className={field} />
        </label>
        <label className={label}>Emergency Contact / आपत्कालीन संपर्क
          <input name="emergencyContact" defaultValue={defaultValues?.emergencyContact ?? ''} className={field} />
        </label>
      </div>
      <label className={label}>Address / पत्ता
        <textarea name="address" defaultValue={defaultValues?.address ?? ''} className={field} rows={2} />
      </label>
      <button disabled={pending}
        className="rounded bg-emerald-700 px-6 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
        {pending ? 'Saving… / जतन होत आहे…' : submitLabel}
      </button>
    </form>
  );
}
```

`src/app/(app)/layout.tsx`:
```tsx
import Link from 'next/link';
import { signOutAction } from '@/actions/auth';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <Link href="/patients" className="font-semibold text-emerald-800">
            Pawar Yoga Therapy / रुग्ण व्यवस्थापन
          </Link>
          <form action={signOutAction}>
            <button className="text-sm text-stone-500 hover:text-stone-800">Sign out / बाहेर पडा</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
```

`src/app/(app)/patients/page.tsx`:
```tsx
import Link from 'next/link';
import { getDb } from '@/db/client';
import { searchPatients } from '@/data/patients';
import { problemsForPatients } from '@/data/problems';

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = getDb();
  const list = await searchPatients(db, q);
  const problems = await problemsForPatients(db, list.map((p) => p.id));
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <form className="flex-1">
          <input name="q" defaultValue={q ?? ''} placeholder="Search name or mobile / नाव किंवा मोबाईल शोधा"
            className="w-full max-w-md rounded border border-stone-300 p-2" />
        </form>
        <Link href="/patients/new"
          className="rounded bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
          + New Patient / नवीन रुग्ण
        </Link>
      </div>
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {list.length === 0 && <li className="p-4 text-stone-500">No patients found / रुग्ण सापडले नाहीत</li>}
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/patients/${p.id}`} className="block p-4 hover:bg-stone-50">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{p.fullName}</span>
                <span className="text-sm text-stone-500">{p.patientCode}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                <span>{p.mobile}</span>
                {(problems[p.id] ?? []).map((pr) => (
                  <span key={pr.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    {pr.problem}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/app/(app)/patients/new/page.tsx`:
```tsx
import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';

export default function NewPatientPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New Patient / नवीन रुग्ण नोंदणी</h1>
      <PatientForm action={createPatientAction} submitLabel="Register / नोंदणी करा" />
    </div>
  );
}
```

`src/app/(app)/patients/[id]/edit/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { updatePatientAction } from '@/actions/patients';
import { PatientForm } from '@/components/PatientForm';

export default async function EditPatientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  const update = updatePatientAction.bind(null, id);
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Edit Patient / माहिती बदला — {patient.fullName}</h1>
      <PatientForm action={update} defaultValues={patient} submitLabel="Save / जतन करा" />
    </div>
  );
}
```

- [x] **Step 4: Run** `npx vitest run tests/components/patient-form.test.tsx && npm run typecheck` — Expected: PASS.

- [x] **Step 5: Commit** — `git add -A && git commit -m "feat: patient form with live BMI, list page, app layout"`

---

### Task 13: Patient detail page with tabs

**Files:** Create: `src/app/(app)/patients/[id]/page.tsx`, `src/components/DeleteButton.tsx`, `src/components/InlineForm.tsx`

- [x] **Step 1: Implement client helpers**

`src/components/DeleteButton.tsx`:
```tsx
'use client';

export function DeleteButton({
  action, confirmText, label = 'Delete / काढा',
}: { action: () => Promise<unknown>; confirmText: string; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }}
    >
      <button className="text-sm text-red-600 hover:underline">{label}</button>
    </form>
  );
}
```

`src/components/InlineForm.tsx` (client wrapper that shows action errors as inline text — used by tab forms):
```tsx
'use client';

import { useState, useRef } from 'react';
import type { ActionResult } from '@/actions/patients';

export function InlineForm({
  action, children, className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        const result = await action(formData);
        if (result && !result.ok) setError(result.error);
        else { setError(null); ref.current?.reset(); }
      }}
    >
      {error && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {children}
    </form>
  );
}
```

- [x] **Step 2: Implement detail page** — `src/app/(app)/patients/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { addVisitAction } from '@/actions/visits';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';

const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
] as const;
type Tab = (typeof TABS)[number][0];

const field = 'mt-1 w-full rounded border border-stone-300 p-2';
const btn = 'rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800';

export default async function PatientPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tab = ((await searchParams).tab ?? 'overview') as Tab;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {patient.fullName} <span className="text-sm font-normal text-stone-500">{patient.patientCode}</span>
        </h1>
        <div className="flex gap-3">
          <Link href={`/patients/${id}/edit`} className="text-sm text-emerald-700 hover:underline">Edit / बदला</Link>
          <Link href={`/patients/${id}/print`} className="text-sm text-emerald-700 hover:underline">
            Download PDF / प्रिंट
          </Link>
        </div>
      </div>
      <nav className="mb-4 flex gap-1 border-b border-stone-200">
        {TABS.map(([key, title]) => (
          <Link key={key} href={`/patients/${id}?tab=${key}`}
            className={`rounded-t px-3 py-2 text-sm ${tab === key
              ? 'border border-b-0 border-stone-200 bg-white font-medium'
              : 'text-stone-500 hover:text-stone-800'}`}>
            {title}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
    </div>
  );
}

async function Overview({ patient }: { patient: NonNullable<Awaited<ReturnType<typeof getPatient>>> }) {
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const photoUrl = patient.photoPath ? await getStorage().createSignedUrl(patient.photoPath) : null;
  const rows: [string, string | number | null][] = [
    ['Age / वय', patient.age], ['Gender / लिंग', patient.gender],
    ['Weight / वजन (kg)', patient.weightKg], ['Height / उंची (cm)', patient.heightCm],
    ['BMI', bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : null],
    ['Mobile / मोबाईल', patient.mobile], ['Email / ईमेल', patient.email],
    ['Occupation / व्यवसाय', patient.occupation],
    ['Emergency / आपत्कालीन', patient.emergencyContact],
    ['Address / पत्ता', patient.address],
  ];
  return (
    <div className="flex flex-wrap gap-6">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={patient.fullName} className="h-32 w-32 rounded-lg object-cover" />
      )}
      <dl className="grid flex-1 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-stone-100 py-1 text-sm">
            <dt className="text-stone-500">{k}</dt>
            <dd className="text-right">{v ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function Problems({ patientId }: { patientId: string }) {
  const problems = await listProblems(getDb(), patientId);
  const add = addProblemAction.bind(null, patientId);
  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {problems.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border border-stone-200 bg-white p-3">
            <span>
              {p.problem}
              {p.note && <span className="ml-2 text-sm text-stone-500">({p.note})</span>}
            </span>
            <DeleteButton
              action={removeProblemAction.bind(null, patientId, p.id)}
              confirmText={`Remove ${p.problem}?`} label="Remove / काढा" />
          </li>
        ))}
        {problems.length === 0 && <li className="text-sm text-stone-500">No problems recorded / नोंद नाही</li>}
      </ul>
      <InlineForm action={add} className="space-y-2 rounded border border-stone-200 bg-white p-3">
        <label className="block text-sm">Preset / आजार निवडा
          <select name="problem" className={field}>
            {PRESET_PROBLEMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block text-sm">Note / टीप
          <input name="note" className={field} />
        </label>
        <button className={btn}>Add / जोडा</button>
      </InlineForm>
      <InlineForm action={add} className="space-y-2 rounded border border-stone-200 bg-white p-3">
        <input type="hidden" name="isCustom" value="true" />
        <label className="block text-sm">Other problem / इतर आजार
          <input name="problem" className={field} placeholder="Type custom problem / आजार लिहा" />
        </label>
        <button className={btn}>Add custom / इतर जोडा</button>
      </InlineForm>
    </div>
  );
}

async function Documents({ patientId }: { patientId: string }) {
  const docs = await listDocuments(getDb(), patientId);
  const storage = getStorage();
  const withUrls = await Promise.all(
    docs.map(async (d) => ({ ...d, url: await storage.createSignedUrl(d.filePath) })),
  );
  return (
    <div className="max-w-2xl space-y-4">
      <InlineForm action={uploadDocumentAction.bind(null, patientId)}
        className="flex flex-wrap items-end gap-3 rounded border border-stone-200 bg-white p-3">
        <label className="block text-sm">Type / प्रकार
          <select name="docType" className={field}>
            {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">File (PDF/JPG/PNG, max 10MB)
          <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" className={field} />
        </label>
        <button className={btn}>Upload / अपलोड</button>
      </InlineForm>
      <ul className="divide-y divide-stone-100 rounded border border-stone-200 bg-white">
        {withUrls.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div>
              <span className="mr-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">{d.docType}</span>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                {d.originalName}
              </a>
              <span className="ml-2 text-stone-400">{new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
            </div>
            <DeleteButton action={deleteDocumentAction.bind(null, patientId, d.id)}
              confirmText={`Delete ${d.originalName}?`} />
          </li>
        ))}
        {docs.length === 0 && <li className="p-3 text-sm text-stone-500">No documents / कागदपत्रे नाहीत</li>}
      </ul>
    </div>
  );
}

async function Treatment({ patientId }: { patientId: string }) {
  const db = getDb();
  const plan = await getTreatmentPlan(db, patientId);
  const visits = await listVisits(db, patientId);
  const planFields: [keyof NonNullable<typeof plan> & string, string][] = [
    ['yogaProgram', 'Yoga Program / योग कार्यक्रम'], ['pranayam', 'Pranayam / प्राणायाम'],
    ['massage', 'Massage / मसाज'], ['yogaTherapy', 'Yoga Therapy / योग थेरपी'],
    ['dietPlan', 'Diet Plan / आहार योजना'], ['medicines', 'Medicines / औषधे'],
    ['panchkarma', 'Panchkarma / पंचकर्म'],
  ];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InlineForm action={saveTreatmentPlanAction.bind(null, patientId)}
        className="space-y-3 rounded border border-stone-200 bg-white p-4">
        <h2 className="font-medium">Treatment Plan / उपचार योजना</h2>
        {planFields.map(([name, title]) => (
          <label key={name} className="block text-sm">{title}
            <textarea name={name} rows={2} defaultValue={(plan?.[name] as string | null) ?? ''} className={field} />
          </label>
        ))}
        <button className={btn}>Save plan / योजना जतन करा</button>
      </InlineForm>
      <div className="space-y-4">
        <InlineForm action={addVisitAction.bind(null, patientId)}
          className="space-y-3 rounded border border-stone-200 bg-white p-4">
          <h2 className="font-medium">Add Visit / नवीन भेट</h2>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">Date / तारीख
              <input name="visitDate" type="date" defaultValue={today} className={field} />
            </label>
            <label className="block text-sm">Weight (kg)
              <input name="weightKg" type="number" step="0.1" className={field} />
            </label>
            <label className="block text-sm">Pain (1–10)
              <input name="painScale" type="number" min="1" max="10" className={field} />
            </label>
          </div>
          <label className="block text-sm">Progress note / प्रगती नोंद
            <textarea name="progressNote" rows={2} className={field} />
          </label>
          <button className={btn}>Add visit / भेट जोडा</button>
        </InlineForm>
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>{v.visitDate}</span>
                <span>
                  {v.weightKg != null && `${v.weightKg} kg `}
                  {v.painScale != null && `· pain ${v.painScale}/10`}
                </span>
              </div>
              <p className="mt-1">{v.progressNote}</p>
            </li>
          ))}
          {visits.length === 0 && <li className="text-sm text-stone-500">No visits yet / भेटी नाहीत</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Verify** `npm run typecheck && npm test` — Expected: clean, all tests pass.

- [x] **Step 4: Commit** — `git add -A && git commit -m "feat: patient detail page with overview, problems, documents, treatment tabs"`

---

### Task 14: Print view (PDF export)

**Files:** Create: `src/app/(app)/patients/[id]/print/page.tsx`, `src/components/PrintButton.tsx`

- [x] **Step 1: Implement**

`src/components/PrintButton.tsx`:
```tsx
'use client';

export function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 print:hidden">
      Print / Save as PDF — प्रिंट करा
    </button>
  );
}
```

`src/app/(app)/patients/[id]/print/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { PrintButton } from '@/components/PrintButton';

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();
  const [problems, plan, visits] = await Promise.all([
    listProblems(db, id), getTreatmentPlan(db, id), listVisits(db, id),
  ]);
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const planRows = plan ? ([
    ['Yoga Program / योग कार्यक्रम', plan.yogaProgram], ['Pranayam / प्राणायाम', plan.pranayam],
    ['Massage / मसाज', plan.massage], ['Yoga Therapy / योग थेरपी', plan.yogaTherapy],
    ['Diet Plan / आहार योजना', plan.dietPlan], ['Medicines / औषधे', plan.medicines],
    ['Panchkarma / पंचकर्म', plan.panchkarma],
  ] as const).filter(([, v]) => v) : [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <header className="mb-6 border-b-2 border-emerald-700 pb-3 text-center">
        <h1 className="text-2xl font-bold text-emerald-800">Pawar Yoga Therapy Center</h1>
        <p className="text-sm text-stone-500">Patient Summary / रुग्ण सारांश — {patient.patientCode}</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Registration / नोंदणी</h2>
        <table className="w-full text-sm">
          <tbody>
            {([
              ['Name / नाव', patient.fullName], ['Age / वय', patient.age], ['Gender / लिंग', patient.gender],
              ['Weight / वजन', patient.weightKg && `${patient.weightKg} kg`],
              ['Height / उंची', patient.heightCm && `${patient.heightCm} cm`],
              ['BMI', bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : null],
              ['Mobile / मोबाईल', patient.mobile], ['Email / ईमेल', patient.email],
              ['Address / पत्ता', patient.address], ['Occupation / व्यवसाय', patient.occupation],
              ['Emergency / आपत्कालीन', patient.emergencyContact],
            ] as const).filter(([, v]) => v != null).map(([k, v]) => (
              <tr key={k} className="border-b border-stone-100">
                <td className="w-48 py-1 text-stone-500">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Health Problems / आजार</h2>
        {problems.length === 0
          ? <p className="text-sm text-stone-500">None recorded / नोंद नाही</p>
          : <ul className="list-inside list-disc text-sm">
              {problems.map((p) => <li key={p.id}>{p.problem}{p.note && ` — ${p.note}`}</li>)}
            </ul>}
      </section>

      {planRows.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 border-b border-stone-300 font-semibold">Treatment Plan / उपचार योजना</h2>
          <table className="w-full text-sm">
            <tbody>
              {planRows.map(([k, v]) => (
                <tr key={k} className="border-b border-stone-100 align-top">
                  <td className="w-48 py-1 text-stone-500">{k}</td>
                  <td className="py-1 whitespace-pre-wrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Visit History / भेटींचा इतिहास</h2>
        {visits.length === 0
          ? <p className="text-sm text-stone-500">No visits / भेटी नाहीत</p>
          : <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-1">Date</th><th>Weight</th><th>Pain</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-stone-100 align-top">
                    <td className="py-1 whitespace-nowrap">{v.visitDate}</td>
                    <td>{v.weightKg ?? '—'}</td>
                    <td>{v.painScale ? `${v.painScale}/10` : '—'}</td>
                    <td className="whitespace-pre-wrap">{v.progressNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>
      <footer className="mt-8 border-t border-stone-200 pt-2 text-center text-xs text-stone-400 print:fixed print:bottom-0 print:left-0 print:right-0">
        Generated on {new Date().toLocaleDateString('en-IN')} — Pawar Yoga Therapy Center
      </footer>
    </div>
  );
}
```

- [x] **Step 2: Verify** `npm run typecheck` — Expected: clean.

- [x] **Step 3: Commit** — `git add -A && git commit -m "feat: print view for patient summary PDF export"`

---

### Task 15: Coverage gate, docs (architecture index, setup), final CLAUDE.md

**Files:** Create: `docs/architecture.md`, `docs/setup.md` — Modify: `CLAUDE.md`

- [x] **Step 1: Run the full gate**
```bash
npm run typecheck && npm run coverage && npm run build
```
Expected: typecheck clean; all tests pass; coverage table shows ≥80% on lines/functions/branches/statements for `src/lib`, `src/data`, `src/actions` (thresholds fail the run otherwise); `next build` succeeds. If a threshold fails, add targeted tests for the uncovered branches (the coverage report names them) — do not lower thresholds.

- [x] **Step 2: Write `docs/architecture.md`** — the code index. Contents (write this actual structure, updating only if implementation diverged):

```markdown
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
| `src/db/schema.ts` | 5 tables: patients, patient_problems, documents, treatment_plans, visits | table objects + row types |
| `src/db/client.ts` | prod DB singleton | `getDb()` |
| `src/db/types.ts` | DB type shared by prod/test | `Db` |
| `src/lib/bmi.ts` | BMI math | `computeBmi`, `bmiCategory` |
| `src/lib/patient-code.ts` | PYT-0001 sequence | `nextPatientCode`, `formatPatientCode` |
| `src/lib/presets.ts` | 18 Marathi ailments, doc types | `PRESET_PROBLEMS`, `DOC_TYPES` |
| `src/lib/files.ts` | upload rules (10MB, pdf/jpg/png) | `validateUpload`, `validatePhoto` |
| `src/lib/validation.ts` | zod schemas, bilingual messages | `patientSchema`, `problemSchema`, `treatmentSchema`, `visitSchema`, `docTypeSchema`, `firstError` |
| `src/lib/storage.ts` | file storage abstraction | `FileStorage`, `getStorage()`, `BUCKET` |
| `src/lib/auth.ts` / `auth-paths.ts` | session guard | `requireUser`, `isPublicPath` |
| `src/lib/supabase/*` | vendor cookie glue (coverage-exempt) | `createSupabaseServerClient`, `updateSession` |
| `src/data/patients.ts` | CRUD + search + code assignment (transaction) | `createPatient`, `getPatient`, `updatePatient`, `setPhotoPath`, `searchPatients` |
| `src/data/problems.ts` | ailment rows | `addProblem`, `listProblems`, `removeProblem`, `problemsForPatients` |
| `src/data/documents.ts` | upload-then-insert, cleanup on failure | `addDocument`, `listDocuments`, `deleteDocument` |
| `src/data/treatment.ts` | one plan per patient (upsert) | `getTreatmentPlan`, `upsertTreatmentPlan` |
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits` |
| `src/actions/*` | server actions per domain; all return `ActionResult` | `*Action` functions |
| `src/components/*` | client islands: PatientForm (live BMI), InlineForm (error display), DeleteButton (confirm), PrintButton | — |
| `src/app/(app)/patients/*` | list/new/detail(tabs)/edit/print pages | — |
| `middleware.ts` | redirects unauthenticated → /login | — |

## Invariants (do not break)
- BMI is never stored; always computed from weight/height.
- Patient codes are assigned only inside `createPatient`'s transaction.
- Document rows exist only if the file upload succeeded (and vice-versa cleanup).
- All file access via signed URLs; bucket is private; service-role key server-only.
- Every mutation goes through a server action that calls `requireUser()` first.

## How to add a feature (pattern)
1. Schema change → `src/db/schema.ts` → `npm run db:generate` → commit migration.
2. Repo function in `src/data/<domain>.ts` + PGlite test in `tests/data/`.
3. Server action in `src/actions/<domain>.ts` + test in `tests/actions/` (mocks in `tests/helpers/action-mocks.ts`).
4. UI in `src/app/(app)/...` using `InlineForm`.

## Testing
- `tests/helpers/db.ts` — in-memory PGlite running real migrations.
- `tests/helpers/fake-storage.ts` — `FileStorage` fake with failure injection.
- `tests/helpers/action-mocks.ts` — vi.mocks for db client, storage, auth, next/cache, next/navigation.
- Coverage: 80% enforced on lib/data/actions. UI = component test (PatientForm) + `next build` + manual checklist.

## Phase roadmap
Spec: `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md`.
Phase 2: lifestyle form, follow-ups, dashboard, charts (weight/pain data already captured per visit).
Phase 3: WhatsApp/SMS (Twilio), fees, CSV export, audit logs.
```

- [x] **Step 3: Write `docs/setup.md`**:

```markdown
# Setup (one-time)

1. Create a Supabase project (free tier, region ap-south-1).
2. SQL editor → run nothing manually; locally run `npm run db:migrate` with `DATABASE_URL` set to the
   **session pooler** connection string (drizzle migrations need it once), then switch `DATABASE_URL`
   in the app env to the transaction pooler string.
3. Storage → create **private** bucket `patient-files`.
4. Auth → Users → Add user: the admin email + strong password. Disable public signups
   (Auth → Providers → Email → turn off "Allow new users to sign up").
5. Copy `.env.example` → `.env.local`, fill all four values (Project Settings → API / Database).
6. `npm install && npm run dev` → log in at /login.
7. Deploy: push to GitHub → import in Vercel → set the same 4 env vars → deploy.

## Manual pre-handover checklist
- [x] Register patient with photo on a phone-sized viewport
- [x] Each tab works: add/remove problem, upload/view/delete document, save plan, add visit
- [x] Search by name and by mobile
- [x] Print view → Save as PDF produces clean A4
- [x] Logged-out user hitting /patients is redirected to /login
```

- [x] **Step 4: Finalize `CLAUDE.md`** (replace the initial version):

```markdown
# Pawar Yoga Therapy — Patient Management

Single-clinic patient management app (Phase 1 MVP). Next.js 15 + Supabase + Drizzle.

## Read these instead of scanning code
- `docs/architecture.md` — **code index**: module map, invariants, how-to-add-a-feature. Start here.
- `docs/setup.md` — Supabase/env/deploy setup + manual QA checklist.
- `docs/superpowers/specs/2026-06-11-yoga-patient-management-phase1-design.md` — what Phase 1 is and isn't; Phase 2/3 roadmap.

## Commands
- `npm run dev` — local dev (needs `.env.local`, see docs/setup.md)
- `npm test` / `npm run coverage` — vitest; coverage gate: 80% on `src/lib`, `src/data`, `src/actions`
- `npm run typecheck` / `npm run build`
- `npm run db:generate` → `npm run db:migrate` — after any `src/db/schema.ts` change

## Conventions
- TDD: failing test → minimal code → commit. Tests live in `tests/`, mirroring `src/`.
- Layering: pure logic `src/lib` → repos `src/data` (take `db` arg) → actions `src/actions` (auth+zod+revalidate) → UI `src/app`. Never query the DB from a page; go through `src/data`.
- Tests never touch real Supabase: PGlite (`tests/helpers/db.ts`) + fakes (`tests/helpers/`).
- Bilingual UI: every user-facing label/error is "English / मराठी".
- Keep `docs/architecture.md` updated in the same commit as any structural change — it is the index future sessions rely on.
```

- [x] **Step 5: Commit**
```bash
git add -A && git commit -m "docs: architecture index, setup guide, final CLAUDE.md; coverage gate green"
```

---

## Self-review (done)
- **Spec coverage:** login (T10), registration+BMI+codes+photo (T3,4,7,11,12), 18 presets+custom (T5,8,13), documents+signed URLs+orphan prevention (T9,11,13), treatment+visits with weight/pain (T8,11,13), search (T7,12), print/PDF (T14), validation+bilingual errors (T6), no-silent-failures (InlineForm + ActionResult), tests/coverage (throughout, gate in T15), docs+CLAUDE.md (T1,15). Deferred items match spec's out-of-scope list.
- **Placeholder scan:** none — every step has full code or exact commands.
- **Type consistency:** `Db`, `ActionResult`, `FileStorage`, `PatientInput`/`ProblemInput`/`TreatmentInput`/`VisitInput`, repo signatures checked across tasks 2–14.
```
