# Design Language System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codify the dashboard's design language into reusable primitives and apply them to the patients list (→ card grid with pagination), patient detail, edit, and new pages.

**Architecture:** Extract five presentational components (PageHeader, PatientCard, SectionCard, EmptyState, Pagination); extend the data layer with offset-based pagination and search-aware counting; wire everything into the existing Next.js server-component pages using URL params for state.

**Tech Stack:** Next.js 15 (server components), Tailwind CSS v4, shadcn/ui, Drizzle ORM + PGlite (tests), Vitest.

## Global Constraints

- All bilingual labels follow the pattern "English / मराठी" — copy exactly as in existing code.
- No new DB migrations. No new dependencies.
- TDD: write a failing test before writing implementation code (data layer only — UI components are purely presentational and have no unit tests).
- Run `npm test` after every data-layer task. Run `npm run typecheck` after every UI task.
- Commit after each task with a concise message.
- Branch: `feat/design-language-system`.
- Card style tokens: `rounded-2xl shadow-sm border-border` on every Card surface.
- Button style tokens: primary CTA → `rounded-full gap-2 px-5 h-10 shadow-md`; outline → `rounded-full`.
- Page heading: `text-3xl font-bold tracking-tight text-foreground`.
- Page subtitle: `text-sm text-muted-foreground mt-1`.

---

## File Map

**New files:**
- `src/components/PageHeader.tsx` — page title + subtitle + right-side actions slot
- `src/components/PatientCard.tsx` — card grid tile for a single patient
- `src/components/SectionCard.tsx` — Card wrapper enforcing `rounded-2xl`
- `src/components/EmptyState.tsx` — zero-data UI with optional CTA
- `src/components/Pagination.tsx` — URL-based prev/next/page-numbers

**Modified files:**
- `src/data/patients.ts` — add `offset` param to `searchPatients`; add `q` param to `countPatients`
- `src/app/(app)/patients/page.tsx` — card grid, PageHeader, Pagination
- `src/app/(app)/patients/new/page.tsx` — PageHeader
- `src/app/(app)/patients/[id]/edit/page.tsx` — PageHeader
- `src/app/(app)/patients/[id]/page.tsx` — `rounded-2xl` sweep on inner Cards
- `src/components/PatientHeader.tsx` — `rounded-full` on action buttons
- `src/components/TreatmentPlanForm.tsx` — `rounded-2xl` on its Card

**Modified test files:**
- `tests/data/patients.test.ts` — add offset and countPatients-with-query tests

---

## Task 1: Data layer — pagination offset + search-aware count

**Files:**
- Modify: `src/data/patients.ts`
- Test: `tests/data/patients.test.ts`

**Interfaces:**
- Produces:
  - `searchPatients(db: Db, q?: string, limit?: number, offset?: number): Promise<Patient[]>`
  - `countPatients(db: Db, branch?: string, q?: string): Promise<number>`

- [ ] **Step 1: Write the failing tests**

Add to `tests/data/patients.test.ts` (after the existing `searchPatients` describe block):

```ts
import { countPatients } from '@/data/patients';   // add to existing import line

describe('searchPatients with offset', () => {
  it('skips the first N results', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Asha Two', mobile: '9000000002' });
    await createPatient(db, { fullName: 'Asha Three', mobile: '9000000003' });
    const page2 = await searchPatients(db, 'asha', 2, 2);
    expect(page2).toHaveLength(1);
  });
});

describe('countPatients', () => {
  it('returns total when no filter', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000002' });
    expect(await countPatients(db)).toBe(2);
  });

  it('filters by search query', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000002' });
    expect(await countPatients(db, undefined, 'asha')).toBe(1);
    expect(await countPatients(db, undefined, 'ravi')).toBe(1);
    expect(await countPatients(db, undefined, 'nobody')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- tests/data/patients.test.ts
```

Expected: FAIL — `searchPatients with offset` fails because offset param doesn't exist yet; `countPatients` filter test fails.

- [ ] **Step 3: Implement the changes**

Replace the two functions in `src/data/patients.ts`:

```ts
// Add 'and' to the existing drizzle-orm import
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

export async function searchPatients(
  db: Db,
  q?: string,
  limit?: number,
  offset?: number,
): Promise<Patient[]> {
  const query = q?.trim();
  const where = query
    ? or(
        ilike(patients.fullName, `%${query}%`),
        ilike(patients.mobile, `%${query}%`),
        ilike(patients.patientCode, `%${query}%`),
      )
    : undefined;
  const base = db.select().from(patients).where(where).orderBy(desc(patients.createdAt));
  if (limit !== undefined) {
    return offset !== undefined ? base.limit(limit).offset(offset) : base.limit(limit);
  }
  return base;
}

export async function countPatients(db: Db, branch?: string, q?: string): Promise<number> {
  const query = q?.trim();
  const qWhere = query
    ? or(
        ilike(patients.fullName, `%${query}%`),
        ilike(patients.mobile, `%${query}%`),
        ilike(patients.patientCode, `%${query}%`),
      )
    : undefined;
  const branchWhere = branch ? eq(patients.branch, branch) : undefined;
  const where =
    qWhere && branchWhere ? and(qWhere, branchWhere) : (qWhere ?? branchWhere);
  const [{ value }] = await db.select({ value: count() }).from(patients).where(where);
  return value;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass, including existing `searchPatients` tests (the new params are optional — existing call sites are unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/data/patients.ts tests/data/patients.test.ts
git commit -m "feat: add offset param to searchPatients and q filter to countPatients"
```

---

## Task 2: `PageHeader` component + apply to new/edit pages

**Files:**
- Create: `src/components/PageHeader.tsx`
- Modify: `src/app/(app)/patients/new/page.tsx`
- Modify: `src/app/(app)/patients/[id]/edit/page.tsx`

**Interfaces:**
- Produces: `PageHeader({ title: string, subtitle?: string, actions?: React.ReactNode })`

- [ ] **Step 1: Create `src/components/PageHeader.tsx`**

```tsx
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/(app)/patients/new/page.tsx`**

Replace the entire file content:

```tsx
import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';

export default function NewPatientPage() {
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="New Patient / नवीन रुग्ण"
        subtitle="Fill in the details below to register a new patient."
      />
      <PatientForm action={createPatientAction} submitLabel="Register / नोंदणी करा" />
    </div>
  );
}
```

- [ ] **Step 3: Update `src/app/(app)/patients/[id]/edit/page.tsx`**

Replace the entire file content:

```tsx
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { updatePatientAction } from '@/actions/patients';
import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';

export default async function EditPatientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  const update = updatePatientAction.bind(null, id);
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Edit Patient / माहिती बदला"
        subtitle={`${patient.fullName} — ${patient.patientCode}`}
      />
      <PatientForm action={update} defaultValues={patient} submitLabel="Save / जतन करा" />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npm run typecheck
```

Expected: no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add src/components/PageHeader.tsx src/app/\(app\)/patients/new/page.tsx src/app/\(app\)/patients/\[id\]/edit/page.tsx
git commit -m "feat: add PageHeader component and apply to new/edit patient pages"
```

---

## Task 3: `SectionCard` + `EmptyState` components

**Files:**
- Create: `src/components/SectionCard.tsx`
- Create: `src/components/EmptyState.tsx`

**Interfaces:**
- Produces:
  - `SectionCard({ title?: string, children: ReactNode, className?: string, headerActions?: ReactNode })`
  - `EmptyState({ message: string, action?: { label: string; href: string } })`

- [ ] **Step 1: Create `src/components/SectionCard.tsx`**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function SectionCard({ title, children, className, headerActions }: SectionCardProps) {
  return (
    <Card className={cn('rounded-2xl shadow-sm border-border', className)}>
      {title && (
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {headerActions}
        </CardHeader>
      )}
      <CardContent className={cn(!title && 'pt-6')}>{children}</CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `src/components/EmptyState.tsx`**

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  message: string;
  action?: { label: string; href: string };
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button asChild className="mt-4 rounded-full gap-2 px-5 h-10 shadow-md">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SectionCard.tsx src/components/EmptyState.tsx
git commit -m "feat: add SectionCard and EmptyState primitives"
```

---

## Task 4: `Pagination` component

**Files:**
- Create: `src/components/Pagination.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `Pagination({ page: number, totalPages: number, buildHref: (page: number) => string })`

- [ ] **Step 1: Create `src/components/Pagination.tsx`**

```tsx
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1">
      {page === 1 ? (
        <Button variant="outline" size="sm" className="rounded-full" disabled>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={buildHref(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
      )}

      {pageNumbers(page, totalPages).map((n, i) =>
        n === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground select-none">
            …
          </span>
        ) : n === page ? (
          <Button key={n} size="sm" className="rounded-full h-8 w-8 p-0">
            {n}
          </Button>
        ) : (
          <Button key={n} variant="outline" size="sm" className="rounded-full h-8 w-8 p-0" asChild>
            <Link href={buildHref(n)}>{n}</Link>
          </Button>
        )
      )}

      {page === totalPages ? (
        <Button variant="outline" size="sm" className="rounded-full" disabled>
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link href={buildHref(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Pagination.tsx
git commit -m "feat: add Pagination component with URL-based page controls"
```

---

## Task 5: `PatientCard` component

**Files:**
- Create: `src/components/PatientCard.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
```ts
PatientCard({
  id: string,
  fullName: string,
  patientCode: string,
  mobile: string,
  problems: string[],          // display names
  completionStatus: { filled: number; total: 5 },
})
```

- [ ] **Step 1: Create `src/components/PatientCard.tsx`**

```tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PatientCardProps {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  problems: string[];
  completionStatus: { filled: number; total: 5 };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function assessmentChip(filled: number): { text: string; cls: string } {
  if (filled === 5)
    return { text: 'Assessment ✓ / मूल्यांकन ✓', cls: 'bg-primary/10 text-primary' };
  if (filled > 0)
    return {
      text: `Assessment ${filled}/5 / मूल्यांकन ${filled}/5`,
      cls: 'bg-yellow-100 text-yellow-800',
    };
  return { text: 'Assessment — / मूल्यांकन —', cls: 'bg-muted text-muted-foreground' };
}

export function PatientCard({
  id,
  fullName,
  patientCode,
  mobile,
  problems,
  completionStatus,
}: PatientCardProps) {
  const visible = problems.slice(0, 3);
  const overflow = problems.length - visible.length;
  const chip = assessmentChip(completionStatus.filled);

  return (
    <Link href={`/patients/${id}`} className="block h-full">
      <div className="rounded-2xl border border-border bg-card shadow-sm p-5 hover:shadow-md transition-shadow h-full flex flex-col gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            {initials(fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground truncate">{fullName}</span>
              <Badge
                variant="outline"
                className="border-brand-accent text-brand-accent shrink-0"
              >
                {patientCode}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{mobile}</p>
          </div>
        </div>

        {/* Problems + assessment chip */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto">
          {visible.map((p) => (
            <Badge key={p} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
              {p}
            </Badge>
          ))}
          {overflow > 0 && (
            <span className="text-xs text-muted-foreground">+{overflow} more</span>
          )}
          <span
            className={cn(
              'ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              chip.cls,
            )}
          >
            {chip.text}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PatientCard.tsx
git commit -m "feat: add PatientCard grid tile component"
```

---

## Task 6: `/patients` page — card grid + PageHeader + Pagination

**Files:**
- Modify: `src/app/(app)/patients/page.tsx`

**Interfaces:**
- Consumes:
  - `searchPatients(db, q?, 12, offset)` → `Patient[]`
  - `countPatients(db, undefined, q)` → `number`
  - `PageHeader`, `PatientCard`, `EmptyState`, `Pagination` from earlier tasks
  - `problemsForPatients(db, ids)` → `Record<string, { id: string; problem: string }[]>`
  - `assessmentCompletionForPatients(db, ids)` → `Record<string, number>`

- [ ] **Step 1: Replace `src/app/(app)/patients/page.tsx`**

```tsx
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { getDb } from '@/db/client';
import { searchPatients, countPatients } from '@/data/patients';
import { problemsForPatients } from '@/data/problems';
import { assessmentCompletionForPatients } from '@/data/lifestyle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { PatientCard } from '@/components/PatientCard';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 12;

function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const offset = (page - 1) * PAGE_SIZE;
  const db = getDb();

  const [list, totalCount] = await Promise.all([
    searchPatients(db, q, PAGE_SIZE, offset),
    countPatients(db, undefined, q),
  ]);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const [problems, completions] = await Promise.all([
    problemsForPatients(db, list.map((p) => p.id)),
    assessmentCompletionForPatients(db, list.map((p) => p.id)),
  ]);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Patients / रुग्ण"
        subtitle={`${totalCount} registered`}
        actions={
          <Button asChild className="rounded-full gap-2 px-5 h-10 shadow-md">
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              New Patient / नवीन रुग्ण
            </Link>
          </Button>
        }
      />

      <form method="get">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            aria-label="Search patients"
            defaultValue={q ?? ''}
            placeholder="Search name or mobile / नाव किंवा मोबाईल"
            className="pl-9 rounded-full"
          />
        </div>
      </form>

      {list.length === 0 ? (
        <EmptyState
          message="No patients found / रुग्ण सापडले नाहीत"
          action={
            !q
              ? { label: 'Register first patient / पहिला रुग्ण नोंदवा', href: '/patients/new' }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const pts = (problems[p.id] ?? []).map((pr) => pr.problem);
              const filled = completions[p.id] ?? 0;
              return (
                <PatientCard
                  key={p.id}
                  id={p.id}
                  fullName={p.fullName}
                  patientCode={p.patientCode}
                  mobile={p.mobile}
                  problems={pts}
                  completionStatus={{ filled, total: 5 }}
                />
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) =>
              `/patients?q=${encodeURIComponent(q ?? '')}&page=${p}`
            }
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4: Visual check**

Start dev server (`npm run dev`), visit `http://localhost:3000/patients`.

Verify:
- 3-column card grid with avatar initials, name, code badge, problem badges, assessment chip
- `PageHeader` shows "Patients / रुग्ण" in bold with count subtitle and pill CTA button
- Pagination appears if > 12 patients; hidden otherwise
- Search still filters results; page param resets when a new search is submitted

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/patients/page.tsx
git commit -m "feat: convert patients list to card grid with pagination"
```

---

## Task 7: Patient detail polish — PatientHeader buttons + card radius sweep

**Files:**
- Modify: `src/components/PatientHeader.tsx` (lines 57–76)
- Modify: `src/app/(app)/patients/[id]/page.tsx` (all Card usages in tab functions)
- Modify: `src/components/TreatmentPlanForm.tsx` (Card inside)

**Interfaces:**
- Consumes: nothing new

- [ ] **Step 1: Round the PatientHeader action buttons**

In `src/components/PatientHeader.tsx`, add `className="rounded-full"` to each outline Button:

```tsx
{/* Replace the three Button elements starting at line ~57 */}
<div className="flex gap-2">
  <Button variant="outline" size="sm" className="rounded-full" asChild>
    <Link href={`/patients/${patient.id}/edit`}>
      <Pencil className="mr-1.5 h-3.5 w-3.5" />
      Edit / बदला
    </Link>
  </Button>
  <Button variant="outline" size="sm" className="rounded-full" asChild>
    <Link href={`/patients/${patient.id}/print`}>
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      Report / अहवाल
    </Link>
  </Button>
  {hasCourseFee && (
    <Button variant="outline" size="sm" className="rounded-full" asChild>
      <Link href={`/patients/${patient.id}/receipt`}>
        <Receipt className="mr-1.5 h-3.5 w-3.5" />
        Receipt / पावती
      </Link>
    </Button>
  )}
</div>
```

- [ ] **Step 2: Sweep `rounded-2xl` onto every Card in the patient detail page**

In `src/app/(app)/patients/[id]/page.tsx`, find every `<Card` that does **not** already have `rounded-2xl` in its className and add it. Use this search/replace pattern:

Specific instances to update:

**Overview tab (function `Overview`):**
```tsx
// Personal card — line ~128
<Card className="rounded-2xl">

// Body Metrics card — line ~143
<Card className="rounded-2xl">

// Contact card — line ~167
<Card className="rounded-2xl sm:col-span-2">

// Assessment Snapshot card — line ~187
<Card className="rounded-2xl sm:col-span-2">
```

**Problems tab (function `Problems`):**
```tsx
// Preset form card — line ~265
<Card className="rounded-2xl">

// Custom form card — line ~292
<Card className="rounded-2xl">
```

**Documents tab (function `Documents`):**
```tsx
// Upload form card — line ~319
<Card className="rounded-2xl">

// Documents list card — line ~352
<Card className="rounded-2xl">
```

**Treatment tab (function `Treatment`):**
```tsx
// Add Visit card — line ~395
<Card className="rounded-2xl">

// Individual visit cards (inside the visits.map) — line ~441
<Card className="rounded-2xl">
```

**Progress tab (function `Progress`):**
```tsx
// Weight chart card — line ~509
<Card className="rounded-2xl">

// Pain chart card — line ~527
<Card className="rounded-2xl">

// Stats summary card — line ~544
<Card className="rounded-2xl">
```

**Assessment tab (function `Assessment`):**
```tsx
// All five section cards — they have border-l-4, keep that:
<Card className="rounded-2xl border-l-4 border-l-primary/40">
// (replace the bare `border-l-4 border-l-primary/40` on each of the 5 cards)

// Goals & Safety card uses border-l-destructive/40:
<Card className="rounded-2xl border-l-4 border-l-destructive/40">
```

**Fees tab (function `Fees`):**
```tsx
// Three summary cards (grid-cols-3) — line ~881
<Card className="rounded-2xl">   {/* × 3 */}

// Course fee card — line ~907
<Card className="rounded-2xl">

// Record payment card — line ~933
<Card className="rounded-2xl">

// Payment history card — line ~959
<Card className="rounded-2xl">
```

- [ ] **Step 3: Round the Card in `TreatmentPlanForm`**

Read `src/components/TreatmentPlanForm.tsx`. Find any `<Card` without `rounded-2xl` and add it:

```tsx
// Whatever Card is at the top level of TreatmentPlanForm, add rounded-2xl
<Card className="rounded-2xl">
```

- [ ] **Step 4: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Visual check**

Visit `http://localhost:3000/patients/<any-id>`.

Verify:
- PatientHeader Edit/Report/Receipt buttons are pill-shaped
- All tab content cards are consistently `rounded-2xl`
- Assessment cards keep their left border accent
- No layout shifts or broken styles

- [ ] **Step 7: Commit**

```bash
git add src/components/PatientHeader.tsx src/app/\(app\)/patients/\[id\]/page.tsx src/components/TreatmentPlanForm.tsx
git commit -m "feat: apply rounded-2xl to patient detail cards and pill buttons to PatientHeader"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Design tokens codified (in Global Constraints + task descriptions)
- ✅ PageHeader — Task 2
- ✅ PatientCard — Task 5
- ✅ SectionCard — Task 3
- ✅ EmptyState — Task 3
- ✅ Pagination — Task 4
- ✅ searchPatients offset — Task 1
- ✅ countPatients q filter — Task 1
- ✅ /patients card grid + pagination — Task 6
- ✅ /patients/new PageHeader — Task 2
- ✅ /patients/[id]/edit PageHeader — Task 2
- ✅ PatientHeader rounded-full — Task 7
- ✅ Patient detail card radius sweep — Task 7
- ✅ TreatmentPlanForm card — Task 7

**No placeholders:** All steps contain actual code.

**Type consistency:**
- `searchPatients(db, q?, limit?, offset?)` defined Task 1, consumed Task 6 ✅
- `countPatients(db, branch?, q?)` defined Task 1, consumed Task 6 ✅
- `PatientCard` props defined Task 5, consumed Task 6 ✅
- `Pagination` props defined Task 4, consumed Task 6 ✅
- `PageHeader` props defined Task 2, consumed Tasks 2 and 6 ✅
- `EmptyState` props defined Task 3, consumed Task 6 ✅
