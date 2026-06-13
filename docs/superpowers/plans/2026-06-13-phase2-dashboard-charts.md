# Phase 2: Dashboard & Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clinic-wide dashboard landing page with stat cards, ailment bar chart, and recent activity list, plus a per-patient "Progress" tab with weight/pain line charts.

**Architecture:** Server components fetch all data and pass pre-computed props to Recharts client components (`'use client'`). New `src/data/dashboard.ts` holds three aggregate query functions. The patient detail page gains a 5th tab using the existing URL-based tab pattern. No schema changes needed.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (v0.45), Recharts, shadcn/ui, PGlite (tests), Tailwind v4

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/data/dashboard.ts` | `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` |
| Modify | `src/data/visits.ts` | Add `listVisitsWithData` |
| Create | `tests/data/dashboard.test.ts` | PGlite integration tests for all 4 functions |
| Create | `src/components/AilmentBarChart.tsx` | `'use client'` horizontal bar chart |
| Create | `src/components/VisitLineChart.tsx` | `'use client'` line chart for weight/pain trends |
| Create | `src/app/(app)/dashboard/page.tsx` | Dashboard page (stat cards + chart + activity list) |
| Modify | `src/app/page.tsx` | Redirect `/` → `/dashboard` |
| Modify | `src/app/(app)/layout.tsx` | Add Dashboard + Patients nav links |
| Modify | `src/app/(app)/patients/[id]/page.tsx` | Add Progress tab (5th tab) |
| Modify | `docs/architecture.md` | Update module map |

---

## Task 1: Data layer + tests (TDD)

**Files:**
- Create: `src/data/dashboard.ts`
- Modify: `src/data/visits.ts`
- Create: `tests/data/dashboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/data/dashboard.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { addVisit, listVisitsWithData } from '@/data/visits';
import { createPatient } from '@/data/patients';
import { addProblem } from '@/data/problems';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

function thisMonthDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

function lastMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

describe('getDashboardStats', () => {
  it('returns zeros/nulls when empty', async () => {
    const stats = await getDashboardStats(db);
    expect(stats.totalPatients).toBe(0);
    expect(stats.visitsThisMonth).toBe(0);
    expect(stats.mostCommonProblem).toBeNull();
    expect(stats.avgPainThisMonth).toBeNull();
  });

  it('counts patients, this-month visits, most common problem, avg pain', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 68, painScale: 4 });
    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', weightKg: 67, painScale: 6 });
    // last month — must not count toward visitsThisMonth or avgPainThisMonth
    await addVisit(db, p2.id, { visitDate: lastMonthDate(), progressNote: 'old', painScale: 8 });

    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p1.id, { problem: 'Arthritis', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Back Pain', isCustom: false });

    const stats = await getDashboardStats(db);
    expect(stats.totalPatients).toBe(2);
    expect(stats.visitsThisMonth).toBe(2);
    expect(stats.mostCommonProblem).toBe('Back Pain');
    expect(stats.avgPainThisMonth).toBe(5); // (4+6)/2 = 5.0
  });
});

describe('getAilmentBreakdown', () => {
  it('returns top ailments by patient count, descending', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p1.id, { problem: 'Arthritis', isCustom: false });

    const result = await getAilmentBreakdown(db);
    expect(result[0]).toEqual({ problem: 'Back Pain', count: 2 });
    expect(result[1]).toEqual({ problem: 'Arthritis', count: 1 });
  });
});

describe('getRecentVisits', () => {
  it('joins patient data and orders newest first', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'first', weightKg: 68 });
    await addVisit(db, p.id, { visitDate: '2026-06-10', progressNote: 'second', painScale: 3 });

    const result = await getRecentVisits(db);
    expect(result).toHaveLength(2);
    expect(result[0].visitDate).toBe('2026-06-10');
    expect(result[0].patientName).toBe('Asha Pawar');
    expect(result[0].patientCode).toBe('PYT-0001');
    expect(result[0].painScale).toBe(3);
    expect(result[0].weightKg).toBeNull();
    expect(result[1].weightKg).toBe(68);
  });

  it('respects the limit parameter', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'a' });
    await addVisit(db, p.id, { visitDate: '2026-06-02', progressNote: 'b' });
    await addVisit(db, p.id, { visitDate: '2026-06-03', progressNote: 'c' });

    const result = await getRecentVisits(db, 2);
    expect(result).toHaveLength(2);
  });
});

describe('listVisitsWithData', () => {
  it('excludes visits with no weight or pain, orders oldest first', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-05-01', progressNote: 'note only' });
    await addVisit(db, p.id, { visitDate: '2026-05-15', progressNote: 'with weight', weightKg: 65 });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'with pain', painScale: 5 });

    const result = await listVisitsWithData(db, p.id);
    expect(result).toHaveLength(2);
    expect(result[0].visitDate).toBe('2026-05-15'); // oldest first
    expect(result[1].visitDate).toBe('2026-06-01');
  });

  it('returns empty array when no visits have metrics', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    await addVisit(db, p.id, { visitDate: '2026-06-01', progressNote: 'note only' });
    expect(await listVisitsWithData(db, p.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/data/dashboard.test.ts
```

Expected: `Cannot find module '@/data/dashboard'` and similar import errors.

- [ ] **Step 3: Implement `src/data/dashboard.ts`**

```typescript
import { count, avg, desc, gte, and, eq } from 'drizzle-orm';
import { patients, patientProblems, visits } from '@/db/schema';
import type { Db } from '@/db/types';

export type DashboardStats = {
  totalPatients: number;
  visitsThisMonth: number;
  mostCommonProblem: string | null;
  avgPainThisMonth: number | null;
};

export async function getDashboardStats(db: Db): Promise<DashboardStats> {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [{ totalPatients }] = await db
    .select({ totalPatients: count() })
    .from(patients);

  const [{ visitsThisMonth }] = await db
    .select({ visitsThisMonth: count() })
    .from(visits)
    .where(gte(visits.visitDate, firstOfMonth));

  const cntExpr = count(patientProblems.id);
  const [top] = await db
    .select({ problem: patientProblems.problem, cnt: cntExpr })
    .from(patientProblems)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(1);

  const [{ avgPain }] = await db
    .select({ avgPain: avg(visits.painScale) })
    .from(visits)
    .where(gte(visits.visitDate, firstOfMonth));

  return {
    totalPatients,
    visitsThisMonth,
    mostCommonProblem: top?.problem ?? null,
    avgPainThisMonth: avgPain !== null ? Math.round(Number(avgPain) * 10) / 10 : null,
  };
}

export async function getAilmentBreakdown(
  db: Db,
): Promise<{ problem: string; count: number }[]> {
  const cntExpr = count(patientProblems.id);
  return db
    .select({ problem: patientProblems.problem, count: cntExpr })
    .from(patientProblems)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(8);
}

export async function getRecentVisits(
  db: Db,
  limit = 10,
): Promise<{
  visitDate: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  weightKg: number | null;
  painScale: number | null;
}[]> {
  return db
    .select({
      visitDate: visits.visitDate,
      patientId: visits.patientId,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      weightKg: visits.weightKg,
      painScale: visits.painScale,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt))
    .limit(limit);
}
```

- [ ] **Step 4: Add `listVisitsWithData` to `src/data/visits.ts`**

Add these imports at the top of the existing file (alongside existing imports):

```typescript
import { desc, eq, or, isNotNull, and } from 'drizzle-orm';
```

Then replace the existing import line (which currently only has `desc, eq`) with the line above, and add the new export at the bottom of `src/data/visits.ts`:

```typescript
export async function listVisitsWithData(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(and(
      eq(visits.patientId, patientId),
      or(isNotNull(visits.weightKg), isNotNull(visits.painScale)),
    ))
    .orderBy(visits.visitDate, visits.createdAt);
}
```

The existing `listVisits` import line currently reads:
```typescript
import { desc, eq } from 'drizzle-orm';
```

Update it to:
```typescript
import { desc, eq, or, isNotNull, and } from 'drizzle-orm';
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm test tests/data/dashboard.test.ts
```

Expected: `Tests 7 passed (7)`

- [ ] **Step 6: Run full suite to confirm no regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/data/dashboard.ts src/data/visits.ts tests/data/dashboard.test.ts
git commit -m "feat(data): dashboard stats, ailment breakdown, recent visits, listVisitsWithData"
```

---

## Task 2: Install Recharts

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts
```

Recharts ships its own TypeScript types — no `@types/recharts` needed.

- [ ] **Step 2: Verify install**

```bash
node -e "require('recharts'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts"
```

---

## Task 3: Chart components

**Files:**
- Create: `src/components/AilmentBarChart.tsx`
- Create: `src/components/VisitLineChart.tsx`

No tests needed — pure presentation components with no logic. TypeCheck catches shape errors.

- [ ] **Step 1: Create `src/components/AilmentBarChart.tsx`**

```typescript
'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

export function AilmentBarChart({ data }: { data: { problem: string; count: number }[] }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
      >
        <XAxis type="number" dataKey="count" allowDecimals={false} fontSize={12} />
        <YAxis type="category" dataKey="problem" width={130} fontSize={12} />
        <Tooltip formatter={(value: number) => [value, 'Patients / रुग्ण']} />
        <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create `src/components/VisitLineChart.tsx`**

```typescript
'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export function VisitLineChart({
  data,
  color,
  unit,
}: {
  data: { visitDate: string; value: number }[];
  color: string;
  unit: string;
}) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="visitDate" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip
          formatter={(value: number) => [unit ? `${value} ${unit}` : String(value), '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AilmentBarChart.tsx src/components/VisitLineChart.tsx
git commit -m "feat(components): AilmentBarChart and VisitLineChart Recharts components"
```

---

## Task 4: Dashboard page

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/dashboard/page.tsx`**

```typescript
import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function DashboardPage() {
  const db = getDb();
  const [stats, ailments, recentVisits] = await Promise.all([
    getDashboardStats(db),
    getAilmentBreakdown(db),
    getRecentVisits(db),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard / डॅशबोर्ड</h1>

      {/* Stat cards — 2-col on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Patients / रुग्ण"
          value={String(stats.totalPatients)}
        />
        <StatCard
          title="Visits This Month / भेटी"
          value={String(stats.visitsThisMonth)}
        />
        <StatCard
          title="Most Common / सामान्य आजार"
          value={stats.mostCommonProblem ?? '—'}
        />
        <StatCard
          title="Avg Pain / वेदना"
          value={stats.avgPainThisMonth !== null ? String(stats.avgPainThisMonth) : '—'}
        />
      </div>

      {/* Ailment chart + Recent activity side-by-side on md+ */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ailment Breakdown / आजार</CardTitle>
          </CardHeader>
          <CardContent>
            {ailments.length > 0 ? (
              <AilmentBarChart data={ailments} />
            ) : (
              <p className="text-sm text-muted-foreground">No data yet / माहिती नाही</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity / अलीकडील</CardTitle>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet / भेटी नाहीत</p>
            ) : (
              <ul className="space-y-3">
                {recentVisits.map((v) => (
                  <li
                    key={`${v.patientId}-${v.visitDate}`}
                    className="flex items-start justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/patients/${v.patientId}`}
                        className="font-medium hover:text-primary"
                      >
                        {v.patientName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{v.visitDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-[var(--brand-accent)] text-[var(--brand-accent)] text-xs"
                      >
                        {v.patientCode}
                      </Badge>
                      {v.weightKg !== null && (
                        <span className="text-xs text-muted-foreground">{v.weightKg}kg</span>
                      )}
                      {v.painScale !== null && (
                        <span
                          className={`h-3 w-3 rounded-full ${painDotColor(v.painScale)}`}
                          title={`Pain: ${v.painScale}`}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function painDotColor(scale: number) {
  if (scale <= 3) return 'bg-primary';
  if (scale <= 6) return 'bg-yellow-500';
  return 'bg-destructive';
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(ui): /dashboard page with stat cards, ailment chart, recent activity"
```

---

## Task 5: Routing + navbar update

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Update `src/app/page.tsx`**

Replace the entire file content with:

```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

- [ ] **Step 2: Update `src/app/(app)/layout.tsx`**

The current file (in full):

```typescript
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { signOutAction } from '@/actions/auth';
import { requireUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/patients" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="font-semibold">Pawar Yoga Therapy</span>
          </Link>
          <div className="flex items-center gap-3">
            {user.email && (
              <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            )}
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out / बाहेर पडा
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

Replace with:

```typescript
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { signOutAction } from '@/actions/auth';
import { requireUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-80">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Pawar Yoga Therapy</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Dashboard / डॅशबोर्ड
              </Link>
              <Link
                href="/patients"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Patients / रुग्ण
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user.email && (
              <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            )}
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out / बाहेर पडा
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(nav): redirect / to /dashboard, add Dashboard nav link"
```

---

## Task 6: Progress tab on patient detail page

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`

This file is long (~500 lines). Make targeted edits — do not rewrite the whole file.

- [ ] **Step 1: Add `'progress'` to the TABS constant**

Current `TABS` in the file (around line 27):

```typescript
const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
] as const;
```

Replace with:

```typescript
const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
  ['progress', 'Progress / प्रगती'],
] as const;
```

- [ ] **Step 2: Add imports at the top of the file**

Add these two imports after the existing `import { listVisits } from '@/data/visits';` line:

```typescript
import { listVisitsWithData } from '@/data/visits';
import { VisitLineChart } from '@/components/VisitLineChart';
```

- [ ] **Step 3: Add the Progress tab render in the tab content section**

Find the tab content block (around line 118–123):

```typescript
      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
```

Replace with:

```typescript
      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
      {tab === 'progress' && <Progress patientId={id} />}
```

- [ ] **Step 4: Add the `Progress` async function at the bottom of the file**

Append after the last closing brace of the file (after the existing `Treatment` function):

```typescript
async function Progress({ patientId }: { patientId: string }) {
  const db = getDb();
  const rows = await listVisitsWithData(db, patientId);

  const weightData = rows
    .filter((r): r is typeof r & { weightKg: number } => r.weightKg !== null)
    .map((r) => ({ visitDate: r.visitDate, value: r.weightKg }));

  const painData = rows
    .filter((r): r is typeof r & { painScale: number } => r.painScale !== null)
    .map((r) => ({ visitDate: r.visitDate, value: r.painScale }));

  const firstDate = rows[0]?.visitDate ?? null;
  const latestDate = rows[rows.length - 1]?.visitDate ?? null;

  const weightChange =
    weightData.length >= 2
      ? weightData[weightData.length - 1].value - weightData[0].value
      : null;

  const painChange =
    painData.length >= 2
      ? painData[painData.length - 1].value - painData[0].value
      : null;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Not enough data / पुरेशी माहिती नाही
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Weight trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Weight Trend / वजन (kg)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightData.length >= 2 ? (
            <VisitLineChart data={weightData} color="var(--primary)" unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough data / पुरेशी माहिती नाही
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pain trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pain Trend / वेदना पातळी
          </CardTitle>
        </CardHeader>
        <CardContent>
          {painData.length >= 2 ? (
            <VisitLineChart data={painData} color="var(--destructive)" unit="" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough data / पुरेशी माहिती नाही
            </p>
          )}
        </CardContent>
      </Card>

      {/* Visit summary */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">First visit / पहिली भेट</p>
            <p className="font-medium">{firstDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Latest / शेवटची</p>
            <p className="font-medium">{latestDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Visits with data / माहिती</p>
            <p className="font-medium">{rows.length}</p>
          </div>
          {weightChange !== null && (
            <div>
              <p className="text-muted-foreground">Weight change / बदल</p>
              <p className={`font-medium ${weightChange <= 0 ? 'text-primary' : 'text-destructive'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
              </p>
            </div>
          )}
          {painChange !== null && (
            <div>
              <p className="text-muted-foreground">Pain change / वेदना बदल</p>
              <p className={`font-medium ${painChange <= 0 ? 'text-primary' : 'text-destructive'}`}>
                {painChange < 0 ? '↓' : '↑'} {Math.abs(painChange)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. The `Card`, `CardContent`, `CardHeader`, `CardTitle` imports are already present at the top of the file — no new imports needed for those.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/patients/\[id\]/page.tsx
git commit -m "feat(ui): add Progress tab to patient detail with weight and pain line charts"
```

---

## Task 7: Update architecture docs

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the module map in `docs/architecture.md`**

Find the line:
```
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits` |
```

Replace with:
```
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits`, `listVisitsWithData` |
```

Find the line:
```
| `src/components/*` | Client islands: PatientForm (live BMI, grouped sections), InlineForm (error display), DeleteButton (AlertDialog confirm), PrintButton | — |
```

Replace with:
```
| `src/components/*` | Client islands: PatientForm (live BMI, grouped sections), InlineForm (error display), DeleteButton (AlertDialog confirm), PrintButton, AilmentBarChart (Recharts horizontal bar), VisitLineChart (Recharts line) | — |
```

After the last `src/actions/*` row, add a new row for the dashboard data module. Find:
```
| `src/data/treatment.ts` | one plan per patient (upsert) | `getTreatmentPlan`, `upsertTreatmentPlan` |
```

Add immediately after:
```
| `src/data/dashboard.ts` | aggregate queries for global stats | `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` |
```

Find:
```
| `src/app/(app)/patients/*` | list/new/detail(tabs)/edit/print pages | — |
```

Replace with:
```
| `src/app/(app)/dashboard` | clinic-wide stats, ailment bar chart, recent visits | — |
| `src/app/(app)/patients/*` | list/new/detail(tabs+progress)/edit/print pages | — |
```

Find the Phase roadmap line:
```
Phase 2: lifestyle form, follow-ups, dashboard, charts (weight/pain data already captured per visit).
```

Replace with:
```
Phase 2: dashboard + charts ✅; lifestyle form, follow-ups (upcoming).
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture module map for Phase 2 dashboard + charts"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `/` redirects to `/dashboard` | Task 5 |
| Navbar: Dashboard link + Patients link | Task 5 |
| 4 stat cards (patients, visits, problem, avg pain) | Task 4 |
| Ailment breakdown horizontal BarChart, top 8, 280px | Task 3 + Task 4 |
| Recent Activity: last 10 visits with patient link/badge | Task 4 |
| `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` | Task 1 |
| `listVisitsWithData` (weight OR pain not null, ascending) | Task 1 |
| PGlite tests for all 4 functions | Task 1 |
| `AilmentBarChart.tsx` — `'use client'`, props `{ problem, count }[]` | Task 3 |
| `VisitLineChart.tsx` — `'use client'`, props `{ visitDate, value }[]`, color, unit | Task 3 |
| Progress tab (5th) on patient detail | Task 6 |
| Weight LineChart ≥2 guard | Task 6 |
| Pain LineChart ≥2 guard | Task 6 |
| Visit summary stat row (first date, last date, count, changes) | Task 6 |
| Architecture docs updated | Task 7 |

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `getAilmentBreakdown` returns `{ problem: string; count: number }[]` — matches `AilmentBarChart` prop `data: { problem: string; count: number }[]` ✅
- `getRecentVisits` returns `{ visitDate, patientId, patientName, patientCode, weightKg, painScale }` — all fields used in Task 4 dashboard page ✅
- `listVisitsWithData` returns `Visit[]` — `weightKg: number | null`, `painScale: number | null` — used in Task 6 Progress tab correctly ✅
- `VisitLineChart` prop `data: { visitDate: string; value: number }[]` — Task 6 maps `Visit.weightKg` (number, after filtering null) to `value` ✅
- `TABS` in patient detail page gets `'progress'` added — `isValidTab` guard still works (it checks `TABS.some(([key]) => key === value)`) ✅
