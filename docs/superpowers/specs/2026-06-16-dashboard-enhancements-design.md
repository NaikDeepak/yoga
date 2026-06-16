# Dashboard Enhancements — Design Spec

**Date:** 2026-06-16
**Branch:** `feat/dashboard`
**Status:** Approved

## Problem

The dashboard (`src/app/(app)/dashboard/page.tsx`) is a flat list of stats and a flat Follow-ups list. As a daily front-desk tool across multiple active branches, it has three gaps:

- The Follow-ups list doesn't say *when* — "Today" vs "in 5 days" requires reading dates one at a time.
- Finding a specific patient requires going to `/patients` and scrolling/filtering a table, even when the front desk already has a name, code, or phone number in hand.
- There is no way to scope the dashboard to a single branch, even though the clinic operates more than one (`src/lib/presets.ts` → `BRANCHES`), and no fast path to start a new patient record from the dashboard itself.

## Solution

1. Group the existing Follow-ups list by date (Today / Tomorrow / weekday) instead of a flat list.
2. Add a Google-style global search box to the persistent top nav, with a live dropdown that jumps straight to a patient's profile.
3. Add a branch filter to the dashboard that scopes every widget on the page.
4. Add a "+ New Patient" quick action near the dashboard title.

---

## 1. Today's Agenda (day-grouped Follow-ups)

**File:** `src/data/visits.ts` — `getFollowUpsThisWeek`

- Add `branch: string | null` to the returned row shape (joined from `patients.branch`).
- Add an optional second param: `getFollowUpsThisWeek(db: Db, branch?: string)`. When provided, adds `eq(patients.branch, branch)` to the existing `where`.
- No change to the underlying window logic (today through today+6, most-recent-visit-per-patient via `selectDistinctOn`).

**File:** `src/app/(app)/dashboard/page.tsx`

- Grouping happens at render time, not in the query — the rows are already ordered by `nextVisitDate` ascending. Walk the array once; whenever the date differs from the previous row's date, render a header before that row.
- Header labels: `Today / आज`, `Tomorrow / उद्या`, otherwise the existing `formatDueDate` format (e.g. `Wed, 18 Jun`). Computed by comparing the row's date string to `getISTDateString(0)` / `getISTDateString(1)`.
- Row content (name, mobile, WhatsApp icon, code badge) is unchanged — only the grouping wrapper is new.
- Empty state unchanged: "No follow-ups in the next 7 days / या आठवड्यात कोणी नाही".

---

## 2. Global Quick Search

**File:** `src/data/patients.ts` — `searchPatients`

- Extend the `or(...)` clause to also match `ilike(patients.patientCode, ...)`.
- Add an optional `limit?: number` param (default: unlimited, preserving the existing `/patients` list page behavior). The new search route will pass `8`.

**New file:** `src/app/api/patients/search/route.ts`

- `GET` handler. **Does not call `requireUser()`** — that helper calls `redirect('/login')` on `next/navigation`, which is meant for page components. In a `route.ts` handler invoked via `fetch` from a client component, a redirect sends the browser a 307 to `/login`; the client's `response.json()` then tries to parse the login page's HTML and throws. Instead, mirror the existing `src/app/api/ai/treatment-plan/[patientId]/route.ts` pattern: call `createSupabaseServerClient()` + `supabase.auth.getUser()` directly, and return `NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 })` when there's no user.
- Reads `?q=`, calls `searchPatients(db, q, 8)`.
- Returns `{ results: { id, fullName, patientCode, mobile }[] }`. Empty/missing `q` → `{ results: [] }` without querying.

**New file:** `src/components/GlobalSearch.tsx` (client component)

- Text input with bilingual placeholder: "Search patient / रुग्ण शोधा".
- 300ms debounce on keystroke; fetches `/api/patients/search?q=...`. Each fetch is issued with an `AbortController`; starting a new fetch aborts the previous in-flight one, so a slow earlier response can't land after a faster later one and overwrite the dropdown with stale results.
- Renders a dropdown under the input listing matches: `Full Name · PYT-0042 · 98765xxxxx`. The first result is highlighted by default; arrow up/down moves the highlight, Enter navigates to the highlighted result, click navigates to the clicked result.
- Escape or click-outside closes the dropdown without navigating. Clearing the input (empty `q`) also closes the dropdown without firing a fetch.
- No results and query non-empty → "No matches / जुळणारे नाही" row in the dropdown.

**File:** `src/app/(app)/layout.tsx`

- Mount `<GlobalSearch />` in the header, between the existing nav links (`Dashboard`/`Patients`) and the user-email/sign-out group. Visible on every authenticated page, not just the dashboard.
- On narrow viewports the input shrinks (`max-w` + `flex-1` between the two existing flex groups); no separate mobile-only treatment is introduced since the primary device target is desktop/tablet.

---

## 3. Branch Filter

**File:** `src/app/(app)/dashboard/page.tsx`

- Next.js 15 passes `searchParams` as a `Promise` to page components; the page becomes `async function DashboardPage({ searchParams }: { searchParams: Promise<{ branch?: string }> })` and awaits it to get `branch`.
- `branch` (if present and a valid `BranchKey`) is threaded into all four data calls: `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits`, `getFollowUpsThisWeek`. An invalid/unknown value is treated as "all branches" (no filter applied) rather than erroring.

**New file:** `src/components/BranchFilter.tsx` (client component)

- Uses the existing `src/components/ui/select.tsx` (shadcn `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`) rather than a plain HTML `<select>`, to match the rest of the app's UI — `PatientForm` already uses this component for `branch`/`gender` fields.
- Options: "All branches / सर्व शाखा" + each `BRANCHES` entry's `label`.
- `onValueChange` calls `router.push` / `router.replace` with the updated `?branch=` query param (or removes it for "all").
- Placed at the top of the dashboard, next to the `Dashboard / डॅशबोर्ड` heading.

**File:** `src/data/dashboard.ts`

- `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits` each gain an optional `branch?: string` param. Where the query doesn't already join `patients` (e.g. the ailment breakdown groups by `patientProblems.problem`), add the join needed to filter by `patients.branch`.

---

## 4. Quick Actions

**File:** `src/app/(app)/dashboard/page.tsx`

- One button, "+ New Patient / नवीन रुग्ण", linking to `/patients/new`, placed next to the page heading (same row as the new `BranchFilter`). Reuses the existing `Button` + `Link` — no new component.

---

## 5. Testing

| Layer | Test file | What to test |
|---|---|---|
| `src/data/visits.ts` | `tests/data/clinical.test.ts` | `getFollowUpsThisWeek` returns `branch`; optional `branch` param filters correctly |
| `src/data/dashboard.ts` | `tests/data/dashboard.test.ts` | Each of the three functions filters by `branch` when provided; unfiltered behavior unchanged when omitted |
| `src/data/patients.ts` | `tests/data/patients.test.ts` | `searchPatients` matches on `patientCode`; `limit` param caps results |
| `src/app/api/patients/search` | `tests/app/api/patients/search.test.ts` (new) | Returns `401` JSON (not a redirect) when unauthenticated; returns matches; empty `q` returns `{ results: [] }` without querying; mirrors `tests/app/api/ai/treatment-plan.test.ts` |
| `src/components/GlobalSearch.tsx` | `tests/components/global-search.test.tsx` (new) | Debounced fetch fires once per pause in typing; aborts a stale in-flight fetch when a new one starts; renders dropdown results; clicking a result navigates; Escape closes dropdown; mirrors `tests/components/patient-form.test.tsx` |
| UI (day-grouping, `BranchFilter`, quick action button) | manual / `next build` | Covered by the manual QA checklist in `docs/setup.md`, consistent with how `AilmentBarChart`/`VisitLineChart` are currently handled (no dedicated component test) |

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/data/visits.ts` | `getFollowUpsThisWeek` gains `branch` field + optional filter param |
| `src/data/dashboard.ts` | Three functions gain optional `branch` filter param |
| `src/data/patients.ts` | `searchPatients` matches `patientCode`; gains optional `limit` param |
| `src/app/api/patients/search/route.ts` | New — backs the global search dropdown |
| `src/components/GlobalSearch.tsx` | New — debounced search input + dropdown |
| `src/components/BranchFilter.tsx` | New — shadcn `Select` driving the `?branch=` query param |
| `src/app/(app)/layout.tsx` | Mount `GlobalSearch` in the top nav |
| `src/app/(app)/dashboard/page.tsx` | Day-grouped agenda rendering, `BranchFilter` + "+ New Patient" near the heading, thread `branch` through all four data calls |
| `tests/data/clinical.test.ts` | Extend for `branch` field/filter |
| `tests/data/dashboard.test.ts` | Extend for `branch` filter |
| `tests/data/patients.test.ts` | Extend for `patientCode` match + `limit` |
| `tests/app/api/patients/search.test.ts` | New |
| `tests/components/global-search.test.tsx` | New |
| `docs/architecture.md` | Update module map (new API route, new components) + phase roadmap line |

---

## Out of Scope

Considered during design, deliberately deferred:

- **Outstanding Payments widget** — a Follow-ups-style card listing patients with `balance > 0` from `src/data/fees.ts`, with call/WhatsApp actions. Direct payoff from fee tracking, but parked for a future iteration to keep this change focused.
- **7-day calendar-grid agenda** — a Mon–Sun grid view instead of a day-grouped list. More visually distinct but materially more build effort (grid layout, day navigation); day-grouped list chosen as the lower-risk evolution of the existing card.
- **"Log Visit" quick action** — dropped because there's no patient-less visit form; visits are logged from a patient's detail page. Global Search already covers "get to a patient fast."
- Cancellation/rescheduling of follow-ups, push/email notifications, audit logs — unrelated to this change, tracked in the Phase 3 roadmap (`docs/architecture.md`).
