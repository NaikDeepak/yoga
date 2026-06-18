# Calendar Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the disabled "Calendar" sidebar item into a real, read-only month-grid view of upcoming patient follow-ups, derived from the existing `visits.nextVisitDate` data — no new tables, no scheduling/booking.

**Architecture:** Generalize the existing `getFollowUpsThisWeek` data-layer function into a range-based `getFollowUpsInRange`. Add a pure date-grid helper (`src/lib/calendar.ts`) for month layout math. Build a client `CalendarMonthGrid` component (month grid + day-click dialog) and a server `/calendar` page that fetches the visible month's follow-ups and wires in the existing `BranchFilter`. Enable the sidebar nav entry last.

**Tech Stack:** Next.js 15 App Router (server components + 'use client' islands), Drizzle ORM, Vitest + PGlite for data tests, shadcn/ui (`Dialog`, `Button`), Tailwind via existing design tokens.

## Global Constraints

- Bilingual UI: every user-facing label must have both an English (`src/lib/i18n/en.ts`) and Marathi (`src/lib/i18n/mr.ts`) entry — `mr.ts` is typechecked against `Translations` (from `en.ts`), so a missing key is a compile error.
- Layering: pure logic → `src/lib`; DB-reading repo functions → `src/data` (take a `db: Db` argument, never the global singleton); UI → `src/app`/`src/components`. Never query the DB from a page directly — always go through `src/data`.
- Coverage gate: 80% lines/functions/branches/statements on `src/lib/**`, `src/data/**`, `src/actions/**` (`vitest.config.ts`). This feature adds no `src/actions` code (read-only).
- Tests never touch real Supabase — use `tests/helpers/db.ts` (`createTestDb()`, PGlite running real migrations).
- `docs/architecture.md` must be updated in the same set of commits as any structural change (per `CLAUDE.md`).
- Existing behavior must not regress: `getFollowUpsThisWeek`'s 7 existing tests in `tests/data/visits.test.ts` must still pass unmodified.

---

### Task 1: Generalize follow-up lookup into `getFollowUpsInRange`

**Files:**
- Modify: `src/data/visits.ts:38-79` (the `getFollowUpsThisWeek` function)
- Modify: `tests/data/visits.test.ts` (add new tests, keep all existing ones)

**Interfaces:**
- Consumes: nothing new — same `Db`, `visits`/`patients` schema, `getISTDateString` already imported in `src/data/visits.ts`.
- Produces: `getFollowUpsInRange(db: Db, start: string, end: string, branch?: string): Promise<FollowUp[]>` — used by Task 5 (calendar page). `getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]>` keeps its exact existing signature and behavior, now implemented as a thin wrapper.

**Key subtlety:** the "latest already-happened visit" cutoff must stay pinned to *real* today (`getISTDateString(0)`), never to the `start` of the browsed range. If a user browses a future month, `start` will be in the future — using `start` as the cutoff would wrongly treat not-yet-attended visits as "the latest visit" and could mask a real follow-up. Today's `getFollowUpsThisWeek` happens to use the same value for both today-cutoff and range-start, which is why this distinction wasn't visible before.

- [ ] **Step 1: Write failing tests for `getFollowUpsInRange`**

Add to `tests/data/visits.test.ts`, after the existing `describe('getFollowUpsThisWeek', ...)` block, and update the import line:

```ts
import { addVisit, getFollowUpsThisWeek, getFollowUpsInRange, getISTDateString } from '@/data/visits';
```

```ts
describe('getFollowUpsInRange', () => {
  it('returns follow-ups within an arbitrary range beyond a week', async () => {
    const p = await createPatient(db, { fullName: 'Month Browser', mobile: '9000000007' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(20),
    });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25));
    expect(result.map((f) => f.patientId)).toContain(p.id);
  });

  it('excludes a follow-up outside the given range', async () => {
    const p = await createPatient(db, { fullName: 'Out Of Range', mobile: '9000000008' });
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'note',
      nextVisitDate: getISTDateString(50),
    });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25));
    expect(result.map((f) => f.patientId)).not.toContain(p.id);
  });

  it('uses real today — not the range start — as the cutoff for the latest-visit lookup, even when browsing a future range', async () => {
    const p = await createPatient(db, { fullName: 'Future Browser', mobile: '9000000009' });
    // A real visit happening today, with a real follow-up far in the future.
    await addVisit(db, p.id, {
      visitDate: getISTDateString(0),
      progressNote: 'visit with a real follow-up',
      nextVisitDate: getISTDateString(40),
    });
    // A later, not-yet-attended visit row dated inside the browsed future range, with no follow-up.
    await addVisit(db, p.id, {
      visitDate: getISTDateString(35),
      progressNote: 'future-dated visit with no follow-up',
    });

    const result = await getFollowUpsInRange(db, getISTDateString(30), getISTDateString(45));
    const entry = result.find((f) => f.patientId === p.id);
    expect(entry?.nextVisitDate).toBe(getISTDateString(40));
  });

  it('filters by branch when provided', async () => {
    const p1 = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543211', branch: 'Manjari BK' });
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000010', branch: 'Kharadi' });
    await addVisit(db, p1.id, { visitDate: getISTDateString(0), progressNote: 'a', nextVisitDate: getISTDateString(20) });
    await addVisit(db, p2.id, { visitDate: getISTDateString(0), progressNote: 'b', nextVisitDate: getISTDateString(20) });

    const result = await getFollowUpsInRange(db, getISTDateString(15), getISTDateString(25), 'Manjari BK');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Asha Pawar');
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- tests/data/visits.test.ts`
Expected: FAIL — `getFollowUpsInRange` is not exported from `@/data/visits`.

- [ ] **Step 3: Implement `getFollowUpsInRange` and refactor `getFollowUpsThisWeek` to wrap it**

Replace `getFollowUpsThisWeek` in `src/data/visits.ts` (lines 38-79) with:

```ts
export async function getFollowUpsInRange(db: Db, start: string, end: string, branch?: string): Promise<FollowUp[]> {
  const cutoff = getISTDateString(0);

  // Use the most recent *already-happened* visit per patient (visitDate <= cutoff) to
  // read the follow-up date from. A new visit with no next-visit-date intentionally
  // clears any earlier one (the patient came back, the old plan is moot) — but a
  // future-dated visit row (not yet attended) must not be treated as "the latest
  // visit", or it would mask a real, still-valid follow-up from an actual visit.
  // `cutoff` is always real "today", independent of `start`/`end` — browsing a future
  // month must not move this cutoff forward, or it would start treating not-yet-attended
  // visits as the latest one.
  const latestPerPatient = db
    .selectDistinctOn([visits.patientId], {
      patientId: visits.patientId,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .where(lte(visits.visitDate, cutoff))
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
        gte(latestPerPatient.nextVisitDate, start),
        lte(latestPerPatient.nextVisitDate, end),
        branch ? eq(patients.branch, branch) : undefined,
      ),
    )
    .orderBy(latestPerPatient.nextVisitDate);

  return rows.filter((r): r is FollowUp => r.nextVisitDate !== null);
}

export async function getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]> {
  return getFollowUpsInRange(db, getISTDateString(0), getISTDateString(7), branch);
}
```

- [ ] **Step 4: Run all visits tests to verify everything passes**

Run: `npm test -- tests/data/visits.test.ts`
Expected: PASS — all 7 existing `getFollowUpsThisWeek` tests plus the 4 new `getFollowUpsInRange` tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/visits.ts tests/data/visits.test.ts
git commit -m "feat: generalize follow-up lookup into getFollowUpsInRange"
```

---

### Task 2: Pure month-grid date math

**Files:**
- Create: `src/lib/calendar.ts`
- Test: `tests/lib/calendar.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no imports beyond plain JS `Date`).
- Produces: `CalendarDay = { date: string; isCurrentMonth: boolean; isToday: boolean }`, `buildMonthGrid(year: number, month: number, todayISO: string): CalendarDay[][]` (weeks of 7, Sunday-first, `month` is 1-indexed), `shiftMonth(year: number, month: number, delta: number): { year: number; month: number }`. Both consumed by Task 4 (`CalendarMonthGrid`).

- [ ] **Step 1: Write failing tests**

Create `tests/lib/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMonthGrid, shiftMonth } from '@/lib/calendar';

describe('buildMonthGrid', () => {
  it('produces only full weeks of 7 days', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('places the 1st of the month at the weekday position JS Date reports', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const firstIndex = flat.findIndex((d) => d.date === '2026-06-01' && d.isCurrentMonth);
    const expectedWeekday = new Date(Date.UTC(2026, 5, 1)).getUTCDay();
    expect(firstIndex % 7).toBe(expectedWeekday);
  });

  it('includes the last day of the month exactly once, marked as current month', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const matches = flat.filter((d) => d.date === '2026-06-30' && d.isCurrentMonth);
    expect(matches).toHaveLength(1);
  });

  it('marks leading/trailing days from adjacent months as not current month', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const firstWeek = weeks[0];
    const leading = firstWeek.filter((d) => d.date < '2026-06-01');
    for (const day of leading) {
      expect(day.isCurrentMonth).toBe(false);
    }
  });

  it('marks exactly the cell matching todayISO as isToday', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const todayCells = flat.filter((d) => d.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toBe('2026-06-18');
  });

  it('handles a leap-year February fully (29 days)', () => {
    const weeks = buildMonthGrid(2024, 2, '2024-02-01');
    const flat = weeks.flat();
    const feb29 = flat.find((d) => d.date === '2024-02-29');
    expect(feb29?.isCurrentMonth).toBe(true);
  });

  it('handles a non-leap-year February correctly (28 days, no Feb 29)', () => {
    const weeks = buildMonthGrid(2026, 2, '2026-02-01');
    const flat = weeks.flat();
    const feb29 = flat.find((d) => d.date === '2026-02-29' && d.isCurrentMonth);
    expect(feb29).toBeUndefined();
  });
});

describe('shiftMonth', () => {
  it('moves forward within the same year', () => {
    expect(shiftMonth(2026, 6, 1)).toEqual({ year: 2026, month: 7 });
  });

  it('moves backward within the same year', () => {
    expect(shiftMonth(2026, 6, -1)).toEqual({ year: 2026, month: 5 });
  });

  it('rolls over to the next year from December', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back to the previous year from January', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/lib/calendar.test.ts`
Expected: FAIL — `src/lib/calendar.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/calendar.ts`**

```ts
export type CalendarDay = {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function buildMonthGrid(year: number, month: number, todayISO: string): CalendarDay[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(Date.UTC(year, month - 1, 1 + (i - startWeekday)));
    const dateStr = formatDate(cellDate);
    days.push({
      date: dateStr,
      isCurrentMonth: cellDate.getUTCFullYear() === year && cellDate.getUTCMonth() === month - 1,
      isToday: dateStr === todayISO,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/lib/calendar.test.ts`
Expected: PASS — all 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar.ts tests/lib/calendar.test.ts
git commit -m "feat: add pure month-grid date math for calendar feature"
```

---

### Task 3: Calendar i18n strings

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/mr.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `t.calendar.*` keys, consumed by Task 4 (`CalendarMonthGrid`) and Task 5 (calendar page).

- [ ] **Step 1: Add the `calendar` namespace to `src/lib/i18n/en.ts`**

Insert after the `nav: { ... }` block (after line 34, before `dashboard: {`):

```ts
  calendar: {
    title: 'Calendar',
    subtitle: 'Browse upcoming follow-ups by month.',
    today: 'Today',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    noFollowUps: 'No follow-ups today',
    patientsDue: '{count} patients due',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as readonly string[],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ] as readonly string[],
  },
```

- [ ] **Step 2: Add the matching `calendar` namespace to `src/lib/i18n/mr.ts`**

Insert after the `nav: { ... }` block (after line 36, before `dashboard: {`):

```ts
  calendar: {
    title: 'दिनदर्शिका',
    subtitle: 'महिन्यानुसार आगामी फॉलो-अप पहा.',
    today: 'आज',
    prevMonth: 'मागील महिना',
    nextMonth: 'पुढील महिना',
    noFollowUps: 'आज फॉलो-अप नाहीत',
    patientsDue: '{count} रुग्ण देय',
    weekdays: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'] as readonly string[],
    months: [
      'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
      'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
    ] as readonly string[],
  },
```

- [ ] **Step 3: Typecheck to confirm `mr.ts` matches the `Translations` type**

Run: `npm run typecheck`
Expected: PASS — no errors. (`mr.ts` is typed as `Translations` from `en.ts`; a missing or misspelled key here would fail this step.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/mr.ts
git commit -m "feat: add bilingual calendar strings"
```

---

### Task 4: `CalendarMonthGrid` client component

**Files:**
- Create: `src/components/CalendarMonthGrid.tsx`

**Interfaces:**
- Consumes: `buildMonthGrid`, `shiftMonth` from `@/lib/calendar` (Task 2); `t.calendar.*` from `useTranslations()` (Task 3); `FollowUp` type from `@/data/visits` (already exists — `{ patientId, fullName, patientCode, mobile, branch, nextVisitDate }`); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` from `@/components/ui/dialog`; `Button` from `@/components/ui/button`; `cn` from `@/lib/utils`.
- Produces: `CalendarMonthGrid` component with props `{ year: number; month: number; todayISO: string; followUpsByDate: Record<string, FollowUp[]> }`, consumed by Task 5 (calendar page).

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, shiftMonth } from '@/lib/calendar';
import type { FollowUp } from '@/data/visits';
import { useTranslations } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type CalendarMonthGridProps = {
  year: number;
  month: number;
  todayISO: string;
  followUpsByDate: Record<string, FollowUp[]>;
};

export function CalendarMonthGrid({ year, month, todayISO, followUpsByDate }: CalendarMonthGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weeks = buildMonthGrid(year, month, todayISO);
  const selectedFollowUps = selectedDate ? followUpsByDate[selectedDate] ?? [] : [];

  function navigateToMonth(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', `${targetYear}-${String(targetMonth).padStart(2, '0')}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('month');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.calendar.months[month - 1]} {year}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>{t.calendar.today}</Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.calendar.prevMonth}
            onClick={() => {
              const prev = shiftMonth(year, month, -1);
              navigateToMonth(prev.year, prev.month);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.calendar.nextMonth}
            onClick={() => {
              const next = shiftMonth(year, month, 1);
              navigateToMonth(next.year, next.month);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground uppercase">
        {t.calendar.weekdays.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const count = followUpsByDate[day.date]?.length ?? 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={count === 0}
              onClick={() => setSelectedDate(day.date)}
              className={cn(
                'relative flex h-20 flex-col items-center justify-start rounded-lg border border-border p-2 text-sm transition-colors',
                day.isCurrentMonth ? 'bg-card text-foreground' : 'bg-muted/30 text-muted-foreground',
                day.isToday && 'border-primary',
                count > 0 && 'hover:bg-accent/50 cursor-pointer',
                count === 0 && 'cursor-default',
              )}
            >
              <span className={cn('text-xs', day.isToday && 'font-bold text-primary')}>
                {Number(day.date.slice(8, 10))}
              </span>
              {count > 0 && (
                <span className="mt-1 min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate} — {t.calendar.patientsDue.replace('{count}', String(selectedFollowUps.length))}
            </DialogTitle>
          </DialogHeader>
          {selectedFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.calendar.noFollowUps}</p>
          ) : (
            <ul className="space-y-2">
              {selectedFollowUps.map((f) => (
                <li key={f.patientId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <Link href={`/patients/${f.patientId}`} className="text-sm font-medium hover:text-primary transition-colors">
                    {f.fullName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{f.patientCode}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarMonthGrid.tsx
git commit -m "feat: add CalendarMonthGrid component"
```

---

### Task 5: `/calendar` page

**Files:**
- Create: `src/app/(app)/calendar/page.tsx`

**Interfaces:**
- Consumes: `getFollowUpsInRange`, `getISTDateString`, `FollowUp` from `@/data/visits` (Task 1); `CalendarMonthGrid` from `@/components/CalendarMonthGrid` (Task 4); `t.calendar.*` (Task 3); `BranchFilter` from `@/components/BranchFilter`; `BRANCHES`/`BranchKey` from `@/lib/presets`; `getTranslations`/`LOCALES`/`Locale` from `@/lib/i18n/translations`; `getUserLanguage` from `@/data/preferences`; `requireUser` from `@/lib/auth`; `getDb` from `@/db/client`. This mirrors the exact pattern already used in `src/app/(app)/dashboard/page.tsx:53-67`.
- Produces: the `/calendar` route, linked from Task 6 (sidebar).

- [ ] **Step 1: Create the page**

```tsx
import { getDb } from '@/db/client';
import { getFollowUpsInRange, getISTDateString, type FollowUp } from '@/data/visits';
import { CalendarMonthGrid } from '@/components/CalendarMonthGrid';
import { BranchFilter } from '@/components/BranchFilter';
import { BRANCHES, type BranchKey } from '@/lib/presets';
import { cookies } from 'next/headers';
import { getTranslations, LOCALES, type Locale } from '@/lib/i18n/translations';
import { getUserLanguage } from '@/data/preferences';
import { requireUser } from '@/lib/auth';

function parseBranch(value?: string): BranchKey | undefined {
  return BRANCHES.some((b) => b.key === value) ? (value as BranchKey) : undefined;
}

function parseMonth(value?: string): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = getISTDateString(0).split('-').map(Number);
  return { year, month };
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string }>;
}) {
  const { branch: branchParam, month: monthParam } = await searchParams;
  const branch = parseBranch(branchParam);
  const { year, month } = parseMonth(monthParam);
  const { start, end } = monthRange(year, month);

  const db = getDb();
  const user = await requireUser();
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(langCookie ?? '')
    ? (langCookie as Locale)
    : await getUserLanguage(db, user.id);
  const t = getTranslations(locale);

  const followUps = await getFollowUpsInRange(db, start, end, branch);

  const followUpsByDate: Record<string, FollowUp[]> = {};
  for (const f of followUps) {
    (followUpsByDate[f.nextVisitDate] ??= []).push(f);
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t.calendar.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.calendar.subtitle}</p>
        </div>
        <BranchFilter />
      </div>

      <CalendarMonthGrid
        year={year}
        month={month}
        todayISO={getISTDateString(0)}
        followUpsByDate={followUpsByDate}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/calendar/page.tsx"
git commit -m "feat: add /calendar page"
```

---

### Task 6: Enable nav entry, update docs, final verification

**Files:**
- Modify: `src/components/Sidebar.tsx:34`
- Modify: `docs/architecture.md`
- Modify: `docs/setup.md:37-46`

**Interfaces:**
- Consumes: everything from Tasks 1-5 (this task makes the feature reachable and documented).
- Produces: nothing further — this is the last task.

- [ ] **Step 1: Enable the Calendar sidebar entry**

In `src/components/Sidebar.tsx`, change line 34 from:

```ts
    { name: t.nav.calendar, href: '#', icon: Calendar, disabled: true },
```

to:

```ts
    { name: t.nav.calendar, href: '/calendar', icon: Calendar },
```

- [ ] **Step 2: Update `docs/architecture.md` module map**

In the module map table, update the `src/data/visits.ts` row's "Key exports" column (currently `addVisit, listVisits, listVisitsWithData, getISTDateString, getFollowUpsThisWeek`) to:

```
| `src/data/visits.ts` | visit log | `addVisit`, `listVisits`, `listVisitsWithData`, `getISTDateString`, `getFollowUpsThisWeek`, `getFollowUpsInRange` |
```

Add a new row directly after the `src/lib/presets.ts` row:

```
| `src/lib/calendar.ts` | pure month-grid date math | `buildMonthGrid`, `shiftMonth` |
```

Update the `src/components/*` row's component list (append after `BranchFilter`):

```
..., BranchFilter (branch-scoped dashboard filter), CalendarMonthGrid (read-only month-grid follow-up view with day-click dialog)
```

Add a new row after the `src/app/(app)/dashboard` row:

```
| `src/app/(app)/calendar` | read-only month-grid view of upcoming follow-ups, branch filter, month navigation | — |
```

In the Phase roadmap section at the bottom, update the Phase 2 line to append `calendar month view ✅`:

```
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups ✅; global search ✅; branch filter ✅; calendar month view ✅.
```

- [ ] **Step 3: Update the manual QA checklist in `docs/setup.md`**

Add these lines after the existing `Branch filter on the dashboard...` checklist item (after line 42):

```
- [ ] Calendar page shows a month grid; days with follow-ups show a count badge, days without do not open a dialog
- [ ] Clicking a day with follow-ups opens a dialog listing those patients, each linking to their profile
- [ ] Prev/Next/Today controls on the calendar navigate months and update the URL's `month` query param
- [ ] Branch filter on the calendar page scopes the visible follow-ups to the selected branch
```

- [ ] **Step 4: Run the full test suite, typecheck, and build**

Run: `npm test`
Expected: PASS — all tests, including the new ones from Tasks 1 and 2.

Run: `npm run typecheck`
Expected: PASS — no errors.

Run: `npm run build`
Expected: PASS — production build succeeds, `/calendar` listed as a route in the build output.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx docs/architecture.md docs/setup.md
git commit -m "feat: enable Calendar nav entry and update docs"
```
