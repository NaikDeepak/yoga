# Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a day-grouped follow-up agenda, a global patient search in the top nav, a branch filter scoping the whole dashboard, and a "+ New Patient" quick action.

**Architecture:** Thread an optional `branch` filter through the existing `src/data/dashboard.ts` and `src/data/visits.ts` query functions; extend `src/data/patients.ts#searchPatients` to also match `patientCode` and accept a result limit; add one new API route (`/api/patients/search`) that auth-checks via Supabase directly (not `requireUser()`, which redirects rather than returning JSON) and backs a new debounced `GlobalSearch` client component mounted in the persistent app header; add a `BranchFilter` client component (shadcn `Select`) that drives a `?branch=` query param read by the dashboard page.

**Tech Stack:** Next.js 15 (App Router, async `searchParams`), Drizzle ORM, PGlite test DB, Vitest + Testing Library, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-16-dashboard-enhancements-design.md`

---

### Task 1: `getFollowUpsThisWeek` gains `branch` field + filter

**Files:**
- Modify: `src/data/visits.ts`
- Test: `tests/data/clinical.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('getFollowUpsThisWeek', ...)` block in `tests/data/clinical.test.ts` (after the last existing `it`, before the closing `});`):

```ts
  it('filters by branch when provided', async () => {
    const p1 = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210', branch: 'Manjari BK' })).id;
    const p2 = (await createPatient(db, { fullName: 'Ravi', mobile: '9000000001', branch: 'Kharadi' })).id;
    const tomorrow = getISTDateString(1);
    await addVisit(db, p1, { visitDate: getISTDateString(), progressNote: 'ok', nextVisitDate: tomorrow });
    await addVisit(db, p2, { visitDate: getISTDateString(), progressNote: 'ok', nextVisitDate: tomorrow });

    const filtered = await getFollowUpsThisWeek(db, 'Manjari BK');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].patientId).toBe(p1);
    expect(filtered[0].branch).toBe('Manjari BK');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data/clinical.test.ts -t "filters by branch"`
Expected: FAIL — `filtered[0].branch` is `undefined` (field doesn't exist yet), or a TS error if type-checked.

- [ ] **Step 3: Implement**

In `src/data/visits.ts`, replace the `FollowUp` type and `getFollowUpsThisWeek` function with:

```ts
export type FollowUp = {
  patientId: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  branch: string | null;
  nextVisitDate: string;
};

export async function getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]> {
  const today = getISTDateString(0);
  const end = getISTDateString(6);

  const latestPerPatient = db
    .selectDistinctOn([visits.patientId], {
      patientId: visits.patientId,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .orderBy(visits.patientId, desc(visits.visitDate), desc(visits.createdAt))
    .as('latest');

  const rows = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      branch: patients.branch,
      nextVisitDate: latestPerPatient.nextVisitDate,
    })
    .from(latestPerPatient)
    .innerJoin(patients, eq(latestPerPatient.patientId, patients.id))
    .where(
      and(
        isNotNull(latestPerPatient.nextVisitDate),
        gte(latestPerPatient.nextVisitDate, today),
        lte(latestPerPatient.nextVisitDate, end),
        branch ? eq(patients.branch, branch) : undefined,
      ),
    )
    .orderBy(latestPerPatient.nextVisitDate);

  return rows.filter((r): r is FollowUp => r.nextVisitDate !== null);
}
```

(Only the `FollowUp` type and `getFollowUpsThisWeek` function change — `addVisit`, `listVisits`, `listVisitsWithData`, and the `getISTDateString` re-export stay as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data/clinical.test.ts`
Expected: PASS (all tests in the file, including the 3 pre-existing `getFollowUpsThisWeek` tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/visits.ts tests/data/clinical.test.ts
git commit -m "feat: add branch filter to getFollowUpsThisWeek"
```

---

### Task 2: `dashboard.ts` functions gain `branch` filter

**Files:**
- Modify: `src/data/dashboard.ts`
- Test: `tests/data/dashboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('getDashboardStats', ...)` in `tests/data/dashboard.test.ts`, after the existing tests:

```ts
  it('filters all stats by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });

    await addVisit(db, p1.id, { visitDate: thisMonthDate(), progressNote: 'ok', painScale: 4 });
    await addVisit(db, p2.id, { visitDate: thisMonthDate(), progressNote: 'ok', painScale: 8 });
    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Arthritis', isCustom: false });

    const stats = await getDashboardStats(db, 'Manjari BK');
    expect(stats.totalPatients).toBe(1);
    expect(stats.visitsThisMonth).toBe(1);
    expect(stats.mostCommonProblem).toBe('Back Pain');
    expect(stats.avgPainThisMonth).toBe(4);
  });
```

Add inside `describe('getAilmentBreakdown', ...)`:

```ts
  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });
    await addProblem(db, p1.id, { problem: 'Back Pain', isCustom: false });
    await addProblem(db, p2.id, { problem: 'Arthritis', isCustom: false });

    const result = await getAilmentBreakdown(db, 'Manjari BK');
    expect(result).toEqual([{ problem: 'Back Pain', count: 1 }]);
  });
```

Add inside `describe('getRecentVisits', ...)`:

```ts
  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001', branch: 'Kharadi' });
    await addVisit(db, p1.id, { visitDate: '2026-06-10', progressNote: 'a' });
    await addVisit(db, p2.id, { visitDate: '2026-06-11', progressNote: 'b' });

    const result = await getRecentVisits(db, 10, 'Manjari BK');
    expect(result).toHaveLength(1);
    expect(result[0].patientName).toBe('Asha Pawar');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data/dashboard.test.ts -t "filters"`
Expected: FAIL — TS error (`getDashboardStats`/`getAilmentBreakdown`/`getRecentVisits` don't accept a `branch` argument yet) or assertion failures once compiled.

- [ ] **Step 3: Implement**

Replace the three functions in `src/data/dashboard.ts`:

```ts
export async function getDashboardStats(db: Db, branch?: string): Promise<DashboardStats> {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstOfNextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const cntExpr = countDistinct(patientProblems.patientId);
  const branchFilter = branch ? eq(patients.branch, branch) : undefined;

  const [
    [{ totalPatients }],
    [{ visitsThisMonth }],
    [top],
    [{ avgPain }],
  ] = await Promise.all([
    db.select({ totalPatients: count() }).from(patients).where(branchFilter),
    db
      .select({ visitsThisMonth: count() })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(
        and(
          gte(visits.visitDate, firstOfMonth),
          lt(visits.visitDate, firstOfNextMonth),
          branchFilter,
        )
      ),
    db
      .select({ problem: patientProblems.problem, cnt: cntExpr })
      .from(patientProblems)
      .innerJoin(patients, eq(patientProblems.patientId, patients.id))
      .where(branchFilter)
      .groupBy(patientProblems.problem)
      .orderBy(desc(cntExpr))
      .limit(1),
    db
      .select({ avgPain: avg(visits.painScale) })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(
        and(
          gte(visits.visitDate, firstOfMonth),
          lt(visits.visitDate, firstOfNextMonth),
          branchFilter,
        )
      ),
  ]);

  return {
    totalPatients,
    visitsThisMonth,
    mostCommonProblem: top?.problem ?? null,
    avgPainThisMonth: avgPain !== null ? Math.round(Number(avgPain) * 10) / 10 : null,
  };
}

export async function getAilmentBreakdown(
  db: Db,
  branch?: string,
): Promise<{ problem: string; count: number }[]> {
  const cntExpr = countDistinct(patientProblems.patientId);
  return db
    .select({ problem: patientProblems.problem, count: cntExpr })
    .from(patientProblems)
    .innerJoin(patients, eq(patientProblems.patientId, patients.id))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(8);
}

export type RecentVisit = {
  visitId: string;
  visitDate: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  weightKg: number | null;
  painScale: number | null;
};

export async function getRecentVisits(
  db: Db,
  limit = 10,
  branch?: string,
): Promise<RecentVisit[]> {
  return db
    .select({
      visitId: visits.id,
      visitDate: visits.visitDate,
      patientId: visits.patientId,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      weightKg: visits.weightKg,
      painScale: visits.painScale,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .orderBy(desc(visits.visitDate), desc(visits.createdAt))
    .limit(limit);
}
```

No import changes needed — `eq`, `and`, `count`, `countDistinct`, `avg`, `desc`, `gte`, `lt` and `patients` are already imported at the top of the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/data/dashboard.test.ts`
Expected: PASS (all tests, including pre-existing ones — confirms the `branch` param is backward-compatible when omitted).

- [ ] **Step 5: Commit**

```bash
git add src/data/dashboard.ts tests/data/dashboard.test.ts
git commit -m "feat: add branch filter to dashboard aggregate queries"
```

---

### Task 3: `searchPatients` matches `patientCode` and accepts a `limit`

**Files:**
- Modify: `src/data/patients.ts`
- Test: `tests/data/patients.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('searchPatients', ...)` in `tests/data/patients.test.ts`, after the existing test:

```ts
  it('matches patient code', async () => {
    const p = await createPatient(db, asha);
    expect(await searchPatients(db, p.patientCode)).toHaveLength(1);
  });

  it('respects limit', async () => {
    await createPatient(db, asha);
    await createPatient(db, { fullName: 'Asha Two', mobile: '9876543211' });
    expect(await searchPatients(db, 'asha', 1)).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/data/patients.test.ts -t "matches patient code"`
Expected: FAIL — searching by patient code returns 0 results (not matched yet); the `limit` test fails with a TS error (3rd argument doesn't exist) until compiled, then an assertion failure.

- [ ] **Step 3: Implement**

In `src/data/patients.ts`, replace `searchPatients`:

```ts
export async function searchPatients(db: Db, q?: string, limit?: number): Promise<Patient[]> {
  const query = q?.trim();
  const where = query
    ? or(
        ilike(patients.fullName, `%${query}%`),
        ilike(patients.mobile, `%${query}%`),
        ilike(patients.patientCode, `%${query}%`),
      )
    : undefined;
  const base = db.select().from(patients).where(where).orderBy(desc(patients.createdAt));
  return limit !== undefined ? base.limit(limit) : base;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/data/patients.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/patients.ts tests/data/patients.test.ts
git commit -m "feat: match patientCode and add limit param to searchPatients"
```

---

### Task 4: `/api/patients/search` route

**Files:**
- Create: `src/app/api/patients/search/route.ts`
- Test: `tests/app/api/patients/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/app/api/patients/search.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/patients', () => ({ searchPatients: vi.fn() }));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { searchPatients } from '@/data/patients';
import { GET } from '@/app/api/patients/search/route';

let mockGetUser: ReturnType<typeof vi.fn>;

function makeRequest(q?: string) {
  const url = q !== undefined
    ? `http://localhost/api/patients/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/patients/search';
  return new Request(url);
}

beforeEach(() => {
  mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    { auth: { getUser: mockGetUser } } as any,
  );
  vi.mocked(searchPatients).mockResolvedValue([]);
});

describe('GET /api/patients/search', () => {
  it('returns 401 JSON when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest('asha'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('returns empty results without querying when q is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it('returns mapped matches, capped at 8', async () => {
    vi.mocked(searchPatients).mockResolvedValue([
      {
        id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210',
        age: null, gender: null, weightKg: null, heightCm: null, email: null, address: null,
        occupation: null, emergencyContact: null, branch: null, photoPath: null, createdAt: new Date(),
      },
    ] as any);
    const res = await GET(makeRequest('asha'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }],
    });
    expect(searchPatients).toHaveBeenCalledWith({}, 'asha', 8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/api/patients/search.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/patients/search/route'`.

- [ ] **Step 3: Implement**

Create `src/app/api/patients/search/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDb } from '@/db/client';
import { searchPatients } from '@/data/patients';

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const db = getDb();
  const matches = await searchPatients(db, q, 8);
  return NextResponse.json({
    results: matches.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      patientCode: p.patientCode,
      mobile: p.mobile,
    })),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/api/patients/search.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/patients/search/route.ts tests/app/api/patients/search.test.ts
git commit -m "feat: add /api/patients/search route for global search"
```

---

### Task 5: `GlobalSearch` client component

**Files:**
- Create: `src/components/GlobalSearch.tsx`
- Test: `tests/components/global-search.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/global-search.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearch } from '@/components/GlobalSearch';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.useFakeTimers();
  push.mockClear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

function mockFetchOnce(results: unknown[]) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    json: async () => ({ results }),
  });
}

describe('GlobalSearch', () => {
  it('debounces and renders dropdown results', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Search patient/), { target: { value: 'asha' } });

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(screen.getByText('Asha Pawar')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      '/api/patients/search?q=asha',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('navigates to the patient on click', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Search patient/), { target: { value: 'asha' } });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => screen.getByText('Asha Pawar'));

    fireEvent.click(screen.getByText('Asha Pawar'));
    expect(push).toHaveBeenCalledWith('/patients/p1');
  });

  it('closes the dropdown on Escape without navigating', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/Search patient/);
    fireEvent.change(input, { target: { value: 'asha' } });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => screen.getByText('Asha Pawar'));

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Asha Pawar')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('aborts the previous in-flight request when typing again before it resolves', async () => {
    const abortSpy = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', abortSpy);
        return new Promise(() => {}); // never resolves
      })
      .mockResolvedValueOnce({ json: async () => ({ results: [] }) });

    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/Search patient/);
    fireEvent.change(input, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(300);
    fireEvent.change(input, { target: { value: 'as' } });
    await vi.advanceTimersByTimeAsync(300);

    expect(abortSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/global-search.test.tsx`
Expected: FAIL — `Cannot find module '@/components/GlobalSearch'`.

- [ ] **Step 3: Implement**

Create `src/components/GlobalSearch.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type SearchResult = {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
        setHighlight(0);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([]);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goTo(id: string) {
    setOpen(false);
    setQuery('');
    router.push(`/patients/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goTo(results[highlight].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search patient / रुग्ण शोधा"
        className="pl-9"
      />
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-border bg-card shadow-md">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches / जुळणारे नाही</div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => goTo(r.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      i === highlight ? 'bg-accent' : ''
                    }`}
                  >
                    <span className="font-medium">{r.fullName}</span>
                    <span className="text-xs text-muted-foreground">{r.patientCode} · {r.mobile}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/global-search.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/GlobalSearch.tsx tests/components/global-search.test.tsx
git commit -m "feat: add GlobalSearch component with debounce and abort-on-restart"
```

---

### Task 6: Mount `GlobalSearch` in the app header

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Edit the layout**

In `src/app/(app)/layout.tsx`, add the import:

```ts
import { GlobalSearch } from '@/components/GlobalSearch';
```

Replace the header's inner row:

```tsx
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-80">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold">Pawar&apos;s Yog Therapy</span>
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
          <GlobalSearch />
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
```

(This only changes `justify-between` → `justify-between gap-4` on the row, and inserts `<GlobalSearch />` between the two existing flex groups — the rest of the file is untouched.)

- [ ] **Step 2: Verify with a build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat: mount GlobalSearch in the app header"
```

---

### Task 7: `BranchFilter` client component

**Files:**
- Create: `src/components/BranchFilter.tsx`

- [ ] **Step 1: Implement**

Create `src/components/BranchFilter.tsx`:

```tsx
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { BRANCHES } from '@/lib/presets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

export function BranchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('branch') ?? ALL;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) {
      params.delete('branch');
    } else {
      params.set('branch', value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All branches / सर्व शाखा" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All branches / सर्व शाखा</SelectItem>
        {BRANCHES.map((b) => (
          <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

No dedicated test for this component — per the spec's testing section, it's covered by the manual QA checklist (Task 9), consistent with how `AilmentBarChart`/`VisitLineChart` are handled.

- [ ] **Step 2: Verify with a build**

Run: `npm run build`
Expected: build succeeds (component isn't mounted anywhere yet, but must type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add src/components/BranchFilter.tsx
git commit -m "feat: add BranchFilter component"
```

---

### Task 8: Wire branch filter, day-grouped agenda, and quick action into the dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/(app)/dashboard/page.tsx` with:

```tsx
import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { getFollowUpsThisWeek, getISTDateString, type FollowUp } from '@/data/visits';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { BranchFilter } from '@/components/BranchFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BRANCHES, type BranchKey } from '@/lib/presets';

function parseBranch(value?: string): BranchKey | undefined {
  return BRANCHES.some((b) => b.key === value) ? (value as BranchKey) : undefined;
}

type AgendaRow =
  | { kind: 'header'; label: string }
  | { kind: 'item'; followUp: FollowUp };

function groupFollowUps(followUps: FollowUp[]): AgendaRow[] {
  const today = getISTDateString(0);
  const tomorrow = getISTDateString(1);
  const rows: AgendaRow[] = [];
  let lastDate: string | null = null;
  for (const f of followUps) {
    if (f.nextVisitDate !== lastDate) {
      rows.push({ kind: 'header', label: dateHeaderLabel(f.nextVisitDate, today, tomorrow) });
      lastDate = f.nextVisitDate;
    }
    rows.push({ kind: 'item', followUp: f });
  }
  return rows;
}

function dateHeaderLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'Today / आज';
  if (date === tomorrow) return 'Tomorrow / उद्या';
  const [year, month, day] = date.split('-').map(Number);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${formatDueDate(date)}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchParam } = await searchParams;
  const branch = parseBranch(branchParam);

  const db = getDb();
  const [stats, ailments, recentVisits, followUps] = await Promise.all([
    getDashboardStats(db, branch),
    getAilmentBreakdown(db, branch),
    getRecentVisits(db, 10, branch),
    getFollowUpsThisWeek(db, branch),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard / डॅशबोर्ड</h1>
        <div className="flex items-center gap-3">
          <BranchFilter />
          <Button asChild size="sm">
            <Link href="/patients/new">+ New Patient / नवीन रुग्ण</Link>
          </Button>
        </div>
      </div>

      {/* Follow-ups card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-ups This Week / या आठवड्यातील पाठपुरावा</CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No follow-ups in the next 7 days / या आठवड्यात कोणी नाही
            </p>
          ) : (
            <ul className="space-y-3">
              {groupFollowUps(followUps).map((row, i) =>
                row.kind === 'header' ? (
                  <li
                    key={`header-${row.label}-${i}`}
                    className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-0"
                  >
                    {row.label}
                  </li>
                ) : (
                  <li
                    key={row.followUp.patientId}
                    className="flex items-center justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/patients/${row.followUp.patientId}`} className="font-medium hover:text-primary">
                        {row.followUp.fullName}
                      </Link>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${row.followUp.mobile}`} className="text-xs text-muted-foreground hover:text-primary">
                          {row.followUp.mobile}
                        </a>
                        <a
                          href={whatsappUrl(row.followUp.mobile, row.followUp.fullName, row.followUp.nextVisitDate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send WhatsApp reminder / WhatsApp आठवण पाठवा"
                          className="text-green-600 hover:text-green-700"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-brand-accent text-brand-accent text-xs">
                        {row.followUp.patientCode}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        Due / देय: {formatDueDate(row.followUp.nextVisitDate)}
                      </span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>

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
                    key={v.visitId}
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
                        className="border-brand-accent text-brand-accent text-xs"
                      >
                        {v.patientCode}
                      </Badge>
                      {v.weightKg !== null && (
                        <span className="text-xs text-muted-foreground">{v.weightKg}kg</span>
                      )}
                      {v.painScale !== null && (
                        <span
                          className={`h-3 w-3 rounded-full ${painDotColor(v.painScale)}`}
                          title={`Pain: ${v.painScale} / वेदना: ${v.painScale}`}
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

function formatDueDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(day).padStart(2, '0')} ${months[month - 1]}`;
}

function whatsappUrl(mobile: string, fullName: string, nextVisitDate: string): string {
  const date = formatDueDate(nextVisitDate);
  const text = `Hello ${fullName}, a reminder from Pawar's Yog Therapy — your next session is on ${date}. / नमस्कार ${fullName}, आपल्या पुढील योग थेरपी भेटीची आठवण — ${date} रोजी आहे.`;
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify with a build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `/dashboard`:
- Confirm "+ New Patient" button and branch dropdown render next to the heading.
- If there's at least one follow-up due this week, confirm it's grouped under a "Today / आज" or weekday header instead of a flat list.
- Pick a branch in the dropdown and confirm the URL gets `?branch=...` and the page reloads with filtered data (or empty states if no patients in that branch).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add day-grouped agenda, branch filter, and quick action to dashboard"
```

---

### Task 9: Update docs

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/setup.md`

- [ ] **Step 1: Update `docs/architecture.md`**

In the module map table, update the components row (currently listing `PatientForm`, `InlineForm`, etc.) by appending two entries to the end of the "Key exports" cell:

```
, GlobalSearch (debounced live patient search dropdown in top nav), BranchFilter (branch-scoped dashboard filter)
```

Add a new row right after the `src/app/api/ai/treatment-plan/[patientId]` row:

```
| `src/app/api/patients/search` | API GET route handler backing the global search dropdown | — |
```

Update the dashboard row:

```
| `src/app/(app)/dashboard` | clinic-wide stats, ailment bar chart, recent visits, day-grouped follow-up agenda, branch filter, quick-add patient | — |
```

Update the Phase roadmap line:

```
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups ✅; global search ✅; branch filter ✅.
```

- [ ] **Step 2: Update `docs/setup.md`**

In the "Manual pre-handover checklist" section, add these lines after the existing `- [ ] Search by name and by mobile` line:

```
- [ ] Global search box in the top nav finds a patient by name, patient code, or mobile and jumps to their profile
- [ ] Branch filter on the dashboard scopes stats, agenda, and recent activity to the selected branch
- [ ] Dashboard follow-ups are grouped under Today/Tomorrow/weekday headers
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md docs/setup.md
git commit -m "docs: document dashboard enhancements in architecture index and QA checklist"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new ones from Tasks 1–5.

- [ ] **Step 2: Run coverage**

Run: `npm run coverage`
Expected: ≥80% coverage maintained on `src/lib`, `src/data`, `src/actions` (per `CLAUDE.md`'s coverage gate).

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Manual QA**

Walk through the new checklist items added to `docs/setup.md` in Task 9 against a running `npm run dev` instance.

No commit for this task — it's verification of work already committed in Tasks 1–9.

---

## Self-Review Notes

- **Spec coverage:** All 4 spec sections map to tasks — Today's Agenda → Task 8; Global Search → Tasks 3–6; Branch Filter → Tasks 2, 7, 8; Quick Actions → Task 8. Testing section → Tasks 1–5 plus Task 10. Files Changed table → every file is touched by exactly one task above.
- **Weekday header format:** the spec's example header text ("Wed, 18 Jun") implied a weekday prefix that the existing `formatDueDate` helper doesn't produce. Task 8 resolves this by computing the weekday separately via `Date.UTC` (timezone-safe, consistent with how `formatDueDate` already avoids local-timezone parsing) rather than modifying the shared `formatDueDate` helper, which is also used for the unchanged per-row "Due" text.
- **Type consistency:** `FollowUp` (Task 1) gains `branch`; `AgendaRow`/`groupFollowUps`/`dateHeaderLabel` (Task 8) consume that exact shape. `getRecentVisits(db, limit, branch)` signature from Task 2 matches the `getRecentVisits(db, 10, branch)` call site in Task 8.

---

### Task 11: Replace "Avg Pain" with "Monthly Revenue" metric

**Files:**
- Modify: `src/data/dashboard.ts`
- Modify: `tests/data/dashboard.test.ts`
- Create: `src/components/RevenueStatCard.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [x] **Step 1: Update `getDashboardStats` and tests**
Replaced `avgPainThisMonth` aggregation with `revenueThisMonth` aggregating from `feePayments`. Updated unit tests to insert payments via `addPayment`.
- [x] **Step 2: Create `RevenueStatCard` component**
Created a new component to display the revenue, which hides the numeric value behind a toggle ("Eye" icon) by default and automatically re-hides after 5 seconds using an `AbortController`/`setTimeout`.
- [x] **Step 3: Update `DashboardPage`**
Swapped the `StatCard` for Avg Pain with `<RevenueStatCard value={stats.revenueThisMonth} />`.
