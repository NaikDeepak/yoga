# Follow-up Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "next visit date" field to the Add Visit form and surface a 7-day rolling follow-up list on the dashboard.

**Architecture:** One nullable `next_visit_date` column on the `visits` table is the only schema change. `getFollowUpsThisWeek(db)` uses `DISTINCT ON (patient_id)` ordered by `visitDate DESC` to pick each patient's latest visit, then filters for `nextVisitDate` within IST today+0…today+6. The dashboard renders a new card above existing charts. The action and data `addVisit` function need no code changes — schema + validation changes are sufficient.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PGlite (tests), Zod, Vitest, Tailwind/shadcn

---

## File Map

| File | Change |
|---|---|
| `src/db/schema.ts` | Add `nextVisitDate` column to `visits` table |
| `drizzle/` | Generated migration (via `npm run db:generate`) |
| `src/lib/validation.ts` | Add `nextVisitDate: opt(...)` to `visitSchema` |
| `src/data/visits.ts` | Add `getFollowUpsThisWeek`, `getISTDateString`, `FollowUp` type |
| `src/app/(app)/patients/[id]/page.tsx` | Add `nextVisitDate` input to Add Visit form |
| `src/app/(app)/dashboard/page.tsx` | Add follow-ups card + `formatDueDate` helper |
| `tests/lib/validation.test.ts` | Extend `visitSchema` describe block |
| `tests/data/clinical.test.ts` | Add `getFollowUpsThisWeek` describe block |
| `tests/actions/actions.test.ts` | Extend clinical flow test with `nextVisitDate` cases |
| `docs/architecture.md` | Update Phase 2 roadmap line |

---

## Task 1: Schema — add nextVisitDate column

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add column to visits table**

In `src/db/schema.ts`, locate the `visits` table definition and add `nextVisitDate` after `painScale`:

```ts
export const visits = pgTable('visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  visitDate: date('visit_date').notNull(),
  progressNote: text('progress_note').notNull(),
  weightKg: real('weight_kg'),
  painScale: integer('pain_scale'),
  nextVisitDate: date('next_visit_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();
```

- [ ] **Step 2: Generate and apply migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `drizzle/00XX_*.sql` file is created and applied without error.

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm test
```

Expected: all tests pass (the new column is nullable, so existing `addVisit` calls without it still work).

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add next_visit_date column to visits table"
```

---

## Task 2: Validation — add nextVisitDate to visitSchema

**Files:**
- Modify: `src/lib/validation.ts`
- Test: `tests/lib/validation.test.ts`

- [ ] **Step 1: Write failing tests**

In `tests/lib/validation.test.ts`, extend the existing `visitSchema` describe block:

```ts
describe('visitSchema', () => {
  it('validates date, note, optional measurements', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'good', painScale: '7' });
    expect(r.painScale).toBe(7);
    expect(visitSchema.safeParse({ visitDate: 'June 11', progressNote: 'x' }).success).toBe(false);
    expect(visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'x', painScale: '11' }).success).toBe(false);
  });
  it('accepts a valid nextVisitDate', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: '2026-06-21' });
    expect(r.nextVisitDate).toBe('2026-06-21');
  });
  it('maps empty nextVisitDate to undefined', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: '' });
    expect(r.nextVisitDate).toBeUndefined();
  });
  it('rejects a badly-formatted nextVisitDate', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: 'June 21' }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/lib/validation.test.ts
```

Expected: the three new `nextVisitDate` tests fail with "property does not exist" or similar.

- [ ] **Step 3: Add nextVisitDate to visitSchema**

In `src/lib/validation.ts`, update `visitSchema` (the `opt` helper is already defined at the top of the file — do not re-define it):

```ts
export const visitSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date required / तारीख आवश्यक'),
  progressNote: z.string().trim().min(1, 'Note required / नोंद आवश्यक').max(5000),
  weightKg: opt(z.coerce.number().positive().max(300)),
  painScale: opt(z.coerce.number().int().min(1).max(10)),
  nextVisitDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / चुकीची तारीख')),
});
export type VisitInput = z.infer<typeof visitSchema>;
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test tests/lib/validation.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/lib/validation.test.ts
git commit -m "feat: add optional nextVisitDate to visitSchema"
```

---

## Task 3: Data layer — getFollowUpsThisWeek

**Files:**
- Modify: `src/data/visits.ts`
- Test: `tests/data/clinical.test.ts`

- [ ] **Step 1: Write failing tests**

In `tests/data/clinical.test.ts`, add the import and a helper at the top of the file, then add a new describe block after the existing `visits` describe:

Add to imports:
```ts
import { addVisit, listVisits, getFollowUpsThisWeek } from '@/data/visits';
```

Add helper function before the `describe` blocks (after the imports and before `let db`):
```ts
function istDateStr(offsetDays = 0): string {
  const now = new Date();
  const ms = now.getTime() + (330 + now.getTimezoneOffset()) * 60_000 + offsetDays * 86_400_000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
```

Add after the existing `describe('visits', ...)` block:
```ts
describe('getFollowUpsThisWeek', () => {
  it('returns patient whose latest visit has nextVisitDate within 7 days', async () => {
    const tomorrow = istDateStr(1);
    await addVisit(db, patientId, { visitDate: istDateStr(), progressNote: 'ok', nextVisitDate: tomorrow });
    const results = await getFollowUpsThisWeek(db);
    expect(results).toHaveLength(1);
    expect(results[0].nextVisitDate).toBe(tomorrow);
    expect(results[0].mobile).toBe('9876543210');
  });

  it('excludes patient whose nextVisitDate is beyond 7 days', async () => {
    await addVisit(db, patientId, { visitDate: istDateStr(), progressNote: 'ok', nextVisitDate: istDateStr(10) });
    expect(await getFollowUpsThisWeek(db)).toHaveLength(0);
  });

  it('uses most recent visit — new visit without nextVisitDate clears the follow-up', async () => {
    await addVisit(db, patientId, { visitDate: '2026-06-01', progressNote: 'first', nextVisitDate: istDateStr(1) });
    await addVisit(db, patientId, { visitDate: '2026-06-14', progressNote: 'attended' });
    expect(await getFollowUpsThisWeek(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test tests/data/clinical.test.ts
```

Expected: the three `getFollowUpsThisWeek` tests fail with "not a function" or import error.

- [ ] **Step 3: Implement getFollowUpsThisWeek in src/data/visits.ts**

Replace the full content of `src/data/visits.ts` with:

```ts
import { desc, eq, or, isNotNull, and, gte, lte } from 'drizzle-orm';
import { visits, patients, type Visit } from '@/db/schema';
import type { Db } from '@/db/types';
import type { VisitInput } from '@/lib/validation';

export type FollowUp = {
  patientId: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  nextVisitDate: string;
};

export async function addVisit(db: Db, patientId: string, input: VisitInput): Promise<Visit> {
  const [row] = await db.insert(visits).values({ ...input, patientId }).returning();
  return row;
}

export async function listVisits(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt));
}

export async function listVisitsWithData(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(and(
      eq(visits.patientId, patientId),
      or(isNotNull(visits.weightKg), isNotNull(visits.painScale)),
    ))
    .orderBy(visits.visitDate, visits.createdAt);
}

function getISTDateString(offsetDays = 0): string {
  const now = new Date();
  const ms = now.getTime() + (330 + now.getTimezoneOffset()) * 60_000 + offsetDays * 86_400_000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function getFollowUpsThisWeek(db: Db): Promise<FollowUp[]> {
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
      nextVisitDate: latestPerPatient.nextVisitDate,
    })
    .from(latestPerPatient)
    .innerJoin(patients, eq(latestPerPatient.patientId, patients.id))
    .where(
      and(
        isNotNull(latestPerPatient.nextVisitDate),
        gte(latestPerPatient.nextVisitDate, today),
        lte(latestPerPatient.nextVisitDate, end),
      ),
    )
    .orderBy(latestPerPatient.nextVisitDate);

  return rows.filter((r): r is FollowUp => r.nextVisitDate !== null);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test tests/data/clinical.test.ts
```

Expected: all tests pass including the three new ones.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/data/visits.ts tests/data/clinical.test.ts
git commit -m "feat: add getFollowUpsThisWeek to visits data layer"
```

---

## Task 4: Action tests — verify nextVisitDate passes through

No code changes are needed to `src/actions/visits.ts` or `src/data/visits.ts` (addVisit) — `Object.fromEntries(formData)` already passes `nextVisitDate` to the schema, and `parsed.data` is spread into the insert. This task adds tests to prove it.

**Files:**
- Test: `tests/actions/actions.test.ts`

- [ ] **Step 1: Add nextVisitDate test cases to the clinical flow describe block**

In `tests/actions/actions.test.ts`, add a new describe block after `describe('problems / treatment / visits actions', ...)`:

```ts
describe('addVisitAction with nextVisitDate', () => {
  it('saves nextVisitDate when provided', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: '2026-06-21' }),
    );
    expect(r).toEqual({ ok: true });
    const [v] = await listVisits(db, p.id);
    expect(v.nextVisitDate).toBe('2026-06-21');
  });

  it('saves null nextVisitDate when field is empty string', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: '' }),
    );
    expect(r).toEqual({ ok: true });
    const [v] = await listVisits(db, p.id);
    expect(v.nextVisitDate).toBeNull();
  });

  it('returns ok:false for invalid nextVisitDate format', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: 'not-a-date' }),
    );
    expect(r).toMatchObject({ ok: false });
    expect(await listVisits(db, p.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test tests/actions/actions.test.ts
```

Expected: all tests pass including the three new ones.

- [ ] **Step 3: Commit**

```bash
git add tests/actions/actions.test.ts
git commit -m "test: verify nextVisitDate passes through addVisitAction"
```

---

## Task 5: Visit form — add nextVisitDate input

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`

- [ ] **Step 1: Add the date input field to the Add Visit card**

In `src/app/(app)/patients/[id]/page.tsx`, locate the `Treatment` async function. Find the `<InlineForm>` for Add Visit. Add the `nextVisitDate` field **between** the grid and the progress note:

```tsx
{/* existing grid: Date / Weight / Pain */}
<div className="grid grid-cols-3 gap-3">
  {/* ... unchanged ... */}
</div>

{/* NEW: next visit date */}
<div className="space-y-1.5">
  <Label htmlFor="nextVisitDate">Next visit / पुढील भेट <span className="text-xs text-muted-foreground">(optional)</span></Label>
  <Input id="nextVisitDate" name="nextVisitDate" type="date" min={today} />
</div>

{/* existing: progress note */}
<div className="space-y-1.5">
  <Label htmlFor="progressNote">Progress note / प्रगती नोंद</Label>
  <Textarea id="progressNote" name="progressNote" rows={2} />
</div>
```

The `today` variable is already defined above in the `Treatment` function as:
```ts
const today = new Date().toISOString().slice(0, 10);
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
npm run typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/patients/[id]/page.tsx
git commit -m "feat: add next visit date field to Add Visit form"
```

---

## Task 6: Dashboard — follow-ups card

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add import and fetch follow-ups**

At the top of `src/app/(app)/dashboard/page.tsx`, add the import:

```ts
import { getFollowUpsThisWeek } from '@/data/visits';
```

In `DashboardPage`, update the data fetch to include follow-ups:

```ts
const [stats, ailments, recentVisits, followUps] = await Promise.all([
  getDashboardStats(db),
  getAilmentBreakdown(db),
  getRecentVisits(db),
  getFollowUpsThisWeek(db),
]);
```

- [ ] **Step 2: Add the follow-ups card above the stats grid**

In the JSX return, insert the card as the **first** element inside `<div className="space-y-6">`, before the stats grid:

```tsx
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
        {followUps.map((f) => (
          <li
            key={f.patientId}
            className="flex items-center justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
          >
            <div className="flex flex-col gap-0.5">
              <Link href={`/patients/${f.patientId}`} className="font-medium hover:text-primary">
                {f.fullName}
              </Link>
              <span className="text-xs text-muted-foreground">{f.mobile}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-brand-accent text-brand-accent text-xs">
                {f.patientCode}
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                Due: {formatDueDate(f.nextVisitDate)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 3: Add formatDueDate helper at the bottom of the file**

After the existing `painDotColor` function, add:

```ts
function formatDueDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]}`;
}
```

- [ ] **Step 4: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: exits 0 with no errors or warnings.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat: add follow-ups this week card to dashboard"
```

---

## Task 7: Update architecture docs

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the phase roadmap line**

In `docs/architecture.md`, find and replace:

```
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups (upcoming).
```

with:

```
Phase 2: dashboard + charts ✅; lifestyle assessment form ✅; follow-ups ✅.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: mark follow-ups as complete in architecture roadmap"
```
