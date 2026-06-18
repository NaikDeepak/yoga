# Calendar Feature — Design Spec

Date: 2026-06-18
Status: Approved for planning

## Purpose

The sidebar has a disabled "Calendar" menu item (`src/components/Sidebar.tsx`). Today, upcoming follow-ups exist only as a 7-day day-grouped agenda on the dashboard (`getFollowUpsThisWeek`, sourced from `visits.nextVisitDate`). Staff have no way to see follow-ups beyond a week out, or to browse a given month at a glance.

This feature turns that stub into a real, read-only month calendar so staff can see which patients are due for a follow-up on any day, in any month — without leaving the existing data model.

## Scope

**In scope:**
- New `/calendar` page: month grid view of upcoming follow-ups, derived from existing `visits.nextVisitDate`.
- Branch filter, consistent with the dashboard.
- Click a day to see the list of patients due that day, linking to their patient page.
- Month navigation (prev/next/today).

**Out of scope (not this feature):**
- Any new "appointment" concept, time slots, booking, rescheduling, or cancellation.
- Editing follow-up dates from the calendar (still edited via the visit form, as today).
- Past-visit history on the calendar (only forward-looking follow-ups are shown).
- Week/day views — month grid only.

## Data layer

`src/data/visits.ts` currently has `getFollowUpsThisWeek(db, branch?)`, hardcoded to a 7-day window via `getISTDateString(0)` / `getISTDateString(7)`. It's generalized into a range-based function, and the week version becomes a thin wrapper so dashboard behavior is byte-for-byte unchanged:

```ts
export async function getFollowUpsInRange(db: Db, start: string, end: string, branch?: string): Promise<FollowUp[]>

export async function getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]> {
  return getFollowUpsInRange(db, getISTDateString(0), getISTDateString(7), branch);
}
```

The "latest visit per patient" dedup logic (a future-dated visit row must not mask a real follow-up — see existing comment in `getFollowUpsThisWeek`) is unchanged, just parameterized by `start`/`end` instead of hardcoded.

The calendar page fetches the **strict calendar month** range (1st to last day of the displayed month) — not the full 6-week grid that includes leading/trailing days from adjacent months. Those leading/trailing cells render as muted, non-interactive padding with no data, which is a deliberate simplification to avoid a second fetch per page load for cells outside the focal month.

## Pure date-grid logic

A new `src/lib/calendar.ts` holds the pure month-grid construction, kept out of the component so it's unit-testable under the `src/lib` 80% coverage gate:

```ts
export type CalendarDay = { date: string; isCurrentMonth: boolean; isToday: boolean };

export function buildMonthGrid(year: number, month: number, todayISO: string): CalendarDay[][]
```

Returns an array of weeks (each a 7-element array of `CalendarDay`), Sunday-first, always 5 or 6 weeks to fully tile the month. `month` is 1-indexed to match the rest of the codebase's date-string conventions (`YYYY-MM`).

## Page

`src/app/(app)/calendar/page.tsx` — server component, mirrors the dashboard's `searchParams` pattern:

```ts
searchParams: Promise<{ branch?: string; month?: string }>
```

- `month` query param is `YYYY-MM`; defaults to the current IST month if absent or malformed.
- `branch` reuses the existing `BranchFilter` component and `parseBranch` validation, same as the dashboard.
- Fetches `getFollowUpsInRange` for the month, groups results into a `Record<dateString, FollowUp[]>`, and passes that plus the `buildMonthGrid` output into the client component.
- Auth via `requireUser()`, same as every other page in `(app)`.

## Component

`src/components/CalendarMonthGrid.tsx` — client island:

- Renders the week-day header row (bilingual via `t.calendar.*`) and the grid from `buildMonthGrid`.
- Each in-month day cell shows the day number and, if it has follow-ups, a count badge (same visual treatment as the existing patient-count badge in the sidebar).
- Prev / Next / Today controls update the `month` query param via `router.push`, following the same `useSearchParams`/`URLSearchParams` pattern as `BranchFilter` — this re-triggers the server fetch for the new month.
- Clicking a day with follow-ups opens the existing shadcn `Dialog` component listing each patient (name, code, mobile) as a `Link` to `/patients/[id]`. Clicking an empty day does nothing.
- Today's cell gets a distinct highlight (border/background using existing primary token), independent of whether it has follow-ups.

## Navigation

`src/components/Sidebar.tsx`: change the Calendar entry from `{ href: '#', disabled: true }` to `{ href: '/calendar' }`, dropping the "soon" badge — same shape as the existing `patients` entry.

## i18n

Add a `calendar` namespace to `src/lib/i18n/en.ts` and `mr.ts`: page title/subtitle, weekday short labels, "No follow-ups" empty state, "N patients due" dialog heading, nav month label format. Month/weekday names are rendered via the existing locale-aware formatting already used elsewhere (not hardcoded English names), so only UI chrome strings need bilingual entries — not calendar-standard names.

## Testing

- `tests/lib/calendar.test.ts`: `buildMonthGrid` — correct week count for short/long months, Feb in leap vs. non-leap years, `isCurrentMonth`/`isToday` flags, month-boundary correctness.
- `tests/data/visits.test.ts`: extend with `getFollowUpsInRange` cases (multi-week range, branch filter, dedup-per-patient behavior already covered for the week case); confirm `getFollowUpsThisWeek` still passes unchanged given it's now a wrapper.
- `tests/actions`: none needed — this feature adds no server actions (read-only, no mutations).
- UI: manual checklist entry in `docs/setup.md` (month navigation, branch filter interaction, day-click dialog, today highlight) — consistent with the project's existing bar of "component test + build + manual checklist" for UI.

## Errors / edge cases

- Malformed or out-of-range `month` query param → falls back to current IST month (same defensive pattern as `parseBranch` falling back to "all branches").
- Month with zero follow-ups across all days → grid renders normally with no badges; no special empty state needed beyond the per-day "no follow-ups" dialog text being unreachable (dialog only opens on click of a day that already has a count).
