# Design Language System — UI Streamlining

**Date:** 2026-06-17  
**Status:** Approved  
**Scope:** Codify the dashboard's design language into reusable primitives; apply to `/patients`, `/patients/[id]`, `/patients/[id]/edit`, `/patients/new`; convert patients list to a paginated card grid.

---

## 1. Design Language Tokens

These rules are derived from the existing dashboard and must be applied consistently across every page and future component.

| Element | Tailwind rule |
|---|---|
| Page heading | `text-3xl font-bold tracking-tight text-foreground` |
| Page subtitle | `text-sm text-muted-foreground mt-1` |
| Section heading (H2) | `text-xl font-semibold` |
| Card title (H3) | `text-base font-semibold` |
| Entity name | `text-2xl font-semibold` |
| Body emphasis | `text-sm font-medium` |
| Body | `text-sm font-normal` |
| Stat / field label | `text-sm font-medium text-muted-foreground` |
| Label / meta | `text-xs text-muted-foreground` |
| Caption / badge | `text-xs font-medium uppercase tracking-wide` |
| Card | `rounded-2xl shadow-sm border-border` |
| Primary CTA button | `rounded-full gap-2 px-5 h-10 shadow-md` |
| Outline/secondary button | `rounded-full gap-2 px-5 h-10 border-border` |
| Avatar initials bg | `bg-primary/10 text-primary font-bold` |
| Page section spacing | `space-y-8 pb-10` |
| Page header row | `flex flex-col gap-4 md:flex-row md:items-center md:justify-between` |
| Patient code badge | `border-brand-accent text-brand-accent` (variant="outline") |
| Empty state | Centered muted text inside a card, optional CTA button |

Font: Inter (Latin) + Noto Sans Devanagari (Devanagari), loaded via `next/font/google` in `src/app/layout.tsx`. See `docs/superpowers/specs/2026-06-18-typography-design.md` for rationale.

Color palette (already in `globals.css`, do not change):
- Background: warm cream `oklch(0.977 0.007 75)`
- Primary: sage green `oklch(0.478 0.096 145)`
- Brand accent: amber `oklch(0.632 0.130 52)` — decorative only

---

## 2. Reusable Primitives

All primitives live in `src/components/`. They are presentational — no data fetching, no server actions.

### 2.1 `PageHeader`

**File:** `src/components/PageHeader.tsx`

**Props:**

```ts

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode; // buttons, filters — rendered right-aligned
}

```

**Renders:** the standard dashboard-style header row:

```text

[title (h1)]          [actions slot]
[subtitle (p)]

```

- `h1`: `text-3xl font-bold tracking-tight text-foreground`
- `p`: `text-sm text-muted-foreground mt-1`
- Wrapper: `flex flex-col gap-4 md:flex-row md:items-center md:justify-between`

**Used on:** `/patients`, `/patients/new`, `/patients/[id]/edit`

---

### 2.2 `PatientCard`

**File:** `src/components/PatientCard.tsx`

**Props:**

```ts

interface PatientCardProps {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  problems: string[];          // display names, max 3 shown + overflow count
  completionStatus: {
    filled: number;            // 0–5
    total: 5;
  };
}

```

**Renders:** a `rounded-2xl shadow-sm border-border` card that links to `/patients/[id]`:
- Top: avatar initials circle (`h-12 w-12 bg-primary/10 text-primary`) + name (`font-semibold`) + patient code badge (`border-brand-accent text-brand-accent`)
- Middle: mobile number (`text-sm text-muted-foreground`)
- Bottom row: up to 3 problem badges (`bg-primary/10 text-primary`) + overflow count + assessment chip right-aligned
- Hover: `hover:shadow-md transition-shadow`

Assessment chip states (same logic as current list):
- 5/5 → `bg-primary/10 text-primary` "Assessment ✓"
- 1–4/5 → `bg-yellow-100 text-yellow-800` "Assessment N/5"
- 0/5 → `bg-muted text-muted-foreground` "Assessment —"

---

### 2.3 `SectionCard`

**File:** `src/components/SectionCard.tsx`  
*(Thin wrapper — enforces `rounded-2xl` and consistent padding on all inner-page cards.)*

**Props:**

```ts

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

```

**Renders:** `Card` with `rounded-2xl shadow-sm border-border`. If `title` is provided, renders `CardHeader` with `CardTitle` (`text-base font-semibold`) and optional `headerActions` right-aligned. Always wraps children in `CardContent`.

---

### 2.4 `EmptyState`

**File:** `src/components/EmptyState.tsx`

**Props:**

```ts

interface EmptyStateProps {
  message: string;             // bilingual e.g. "No patients / रुग्ण नाहीत"
  action?: {
    label: string;
    href: string;
  };
}

```

**Renders:** centered layout inside a plain `div` (no card — caller wraps in SectionCard if needed):
- Muted icon placeholder or simple text
- `text-sm text-muted-foreground text-center py-6`
- Optional pill button below

---

### 2.5 `Pagination`

**File:** `src/components/Pagination.tsx`

**Props:**

```ts

interface PaginationProps {
  page: number;                // 1-based current page
  totalPages: number;
  buildHref: (page: number) => string;  // e.g. (p) => `/patients?page=${p}&q=${q}`
}

```

**Renders:** a row of page controls:
- "← Prev" button (disabled + muted when `page === 1`)
- Page number buttons — show up to 5 around current page, ellipsis (`…`) for gaps
- "Next →" button (disabled + muted when `page === totalPages`)
- Active page: `variant="default"` (sage green fill)
- Inactive pages: `variant="outline"` with `rounded-full`
- Hidden when `totalPages <= 1`
- Purely presentational — no JS state, no `useRouter`. All navigation via `<Link href={buildHref(n)}>`

---

## 3. Data Layer Changes

**File:** `src/data/patients.ts`

### 3.1 `searchPatients` — add `offset` param

`searchPatients` already accepts `(db, q?, limit?)` and returns `Patient[]`. Two callers exist:
- `/patients` page — needs pagination
- `/api/patients/search` route — uses `limit=8`, does not need offset or count

To avoid breaking these callers, keep the return type as `Patient[]` and add `offset` as an optional 4th param:

```ts

// Updated signature (backwards-compatible)
searchPatients(db, query?: string, limit?: number, offset?: number)
  => Promise<Patient[]>

```

Default: `limit = 12`, `offset = 0`.

### 3.2 `countPatients` — new function

Add a new `countPatients` function for total count (needed for pagination, and already expected by `layout.tsx`):

```ts

countPatients(db: Db, branch?: string, q?: string): Promise<number>

```

The `/patients` page calls both: `searchPatients(db, q, 12, offset)` for the page slice, and `countPatients(db, undefined, q)` for `totalPages`.

---

## 4. Page Changes

### 4.1 `/patients` — Patients List

**File:** `src/app/(app)/patients/page.tsx`

- Accept `page` from `searchParams` (default `1`), parse to integer.
- Compute `offset = (page - 1) * 12`.
- Call updated `searchPatients(db, q, 12, offset)` → `Promise<Patient[]>`.
- Call `problemsForPatients` and `assessmentCompletionForPatients` on the paginated subset only.
- Render:
  1. `<PageHeader title="Patients / रुग्ण" subtitle="{totalCount} registered" actions={<Link …><Button className="rounded-full …">+ New Patient</Button></Link>} />`
  2. Search `<form>` — preserve existing `?q=` param. Reset to page 1 on new search (form action stays `method="get"`, no hidden page field needed — new query resets pagination naturally).
  3. Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`
  4. Each patient → `<PatientCard … />`
  5. `<EmptyState>` when `patients.length === 0`
  6. `<Pagination page={page} totalPages={Math.ceil(totalCount / 12)} buildHref={(p) => \`/patients?q=${q ?? ''}&page=${p}\`} />`

### 4.2 `/patients/[id]` — Patient Detail

**File:** `src/app/(app)/patients/[id]/page.tsx`  
**File:** `src/components/PatientHeader.tsx`

- `PatientHeader` action buttons: add `rounded-full` to the `variant="outline"` buttons (Edit, Report, Receipt).
- Tab bar: the existing `bg-muted p-1 rounded-lg` bar is already good — no structural change. Ensure it uses `rounded-xl` tabs and `bg-card shadow-sm` for active.
- All inner tab content cards: replace bare `<Card>` with `<SectionCard>` where `rounded-2xl` is not already explicit. This is a systematic find-and-replace within the tab render functions.

### 4.3 `/patients/[id]/edit` — Edit Patient

**File:** `src/app/(app)/patients/[id]/edit/page.tsx`

Replace current bare heading with:

```tsx

<PageHeader
  title="Edit Patient / माहिती बदला"
  subtitle={`${patient.fullName} — ${patient.patientCode}`}
/>

```

### 4.4 `/patients/new` — New Patient

**File:** `src/app/(app)/patients/new/page.tsx`

Replace current heading block (if any) with:

```tsx

<PageHeader
  title="New Patient / नवीन रुग्ण"
  subtitle="Register a new patient / नवीन रुग्ण नोंदवा"
/>

```

---

## 5. What Is NOT Changing

- `globals.css` color tokens — already correct, not touched.
- `PatientForm` internals — form fields, validation, actions unchanged.
- `TreatmentPlanForm`, `InlineForm`, `DeleteButton` — unchanged.
- Print / Receipt pages — out of scope.
- Sidebar, TopNav, AppShell — already match dashboard design language.
- Any test files — the data layer change to `searchPatients` needs its test updated (signature change only).

---

## 6. File Inventory

**New files:**
- `src/components/PageHeader.tsx`
- `src/components/PatientCard.tsx`
- `src/components/SectionCard.tsx`
- `src/components/EmptyState.tsx`
- `src/components/Pagination.tsx`

**Modified files:**
- `src/data/patients.ts` — `searchPatients` pagination params + `countPatients` function
- `src/app/(app)/patients/page.tsx` — card grid + pagination + PageHeader
- `src/app/(app)/layout.tsx` — fix `countPatients` import (was already expected, now exported)
- `src/app/(app)/patients/[id]/page.tsx` — SectionCard sweep + tab polish
- `src/app/(app)/patients/[id]/edit/page.tsx` — PageHeader
- `src/app/(app)/patients/new/page.tsx` — PageHeader
- `src/components/PatientHeader.tsx` — rounded-full action buttons
- `tests/data/patients.test.ts` — add tests for `offset` param and `countPatients`
- `tests/actions/actions.test.ts` — no change needed (return type unchanged)

---

## 7. Testing Notes

- `searchPatients` and `countPatients` tests: verify pagination, offset/limit query parameters, and new branch/query counting logic.
- Visual: run `npm run dev`, visit `/patients` — verify 3-col grid, pagination appears when >12 results, search resets to page 1.
- Visit `/patients/new` and `/patients/[id]/edit` — verify `PageHeader` renders correctly.
- Visit `/patients/[id]` — verify tab content cards have `rounded-2xl`.
