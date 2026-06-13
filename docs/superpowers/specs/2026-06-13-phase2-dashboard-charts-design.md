# Pawar Yoga Therapy — Phase 2: Dashboard & Charts

**Date:** 2026-06-13
**Status:** Approved
**Scope:** Global admin dashboard (landing page) + per-patient progress charts

## Goal

Give the therapist a clinic-wide overview on login (patient count, visit activity, ailment breakdown, recent visits) and per-patient weight/pain trend charts on the patient detail page.

## Approach

Option A — Dashboard-first, charts as a detail panel. Build `/dashboard` as the new landing page (clinic-wide stats + Recharts ailment bar chart + recent activity list), then add a "Progress" tab to the patient detail page (weight/pain line charts). Recharts loaded only on routes that use it. Server components fetch data; client components receive pre-computed props.

## Routing & Navigation

- `/` redirects to `/dashboard` (replaces current `/patients` redirect)
- `/dashboard` — new protected page inside the `(app)` layout group
- Navbar gains a **Dashboard / डॅशबोर्ड** link alongside the existing **Patients / रुग्ण** link
- `/patients` remains accessible; dashboard becomes the landing page

## Global Dashboard (`/dashboard`)

### Stat Cards (top row, 2×2 on mobile → 4-col on desktop)

| Card | Data |
|---|---|
| Total Patients | COUNT of all patients |
| Visits This Month | COUNT of visits in current calendar month |
| Most Common Problem | ailment with highest patient_problems count |
| Avg Pain This Month | AVG(pain_scale) for visits this month, rounded to 1dp |

### Ailment Breakdown (left column below cards)

Horizontal `BarChart` (Recharts). Top 8 ailments by patient count. X = patient count, Y = ailment name. Sage green bars (`fill` via CSS variable). Height 280px. Card wrapper with `CardTitle`.

### Recent Activity (right column below cards)

Plain list (no chart). Last 10 visits across all patients, ordered by visit_date desc. Each row: visit date, patient name (Link → detail page), patient code badge, weight if recorded, pain dot if recorded.

### Data fetch

All data fetched server-side in `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits`. Chart component receives pre-computed array prop — no client-side DB calls.

## Per-Patient Progress Tab

New **"Progress / प्रगती"** tab — 5th tab on the patient detail page.

### Weight Trend Chart

`LineChart` (Recharts). X = visit date, Y = weight (kg). Sage green line with dots. Height 200px. Only rendered if patient has ≥2 visits with `weight_kg` non-null. Otherwise: muted message "Not enough data / पुरेशी माहिती नाही".

### Pain Scale Trend Chart

`LineChart` (Recharts). X = visit date, Y = pain scale (1–10). Destructive red line with dots. Height 200px. Same ≥2 data point guard.

### Visit Summary

Below charts: small stat row — first visit date, latest visit date, total visit count, weight change (first→latest with sign), pain change (first→latest with colored arrow ↑↓).

### Data fetch

Server component calls `listVisitsWithData(db, patientId)` — visits filtered to those with at least one metric (weight or pain) recorded. Passes array to client chart components as props.

## Data Layer

### New file: `src/data/dashboard.ts`

| Function | Returns | Query |
|---|---|---|
| `getDashboardStats(db)` | `{ totalPatients, visitsThisMonth, mostCommonProblem, avgPainThisMonth }` | 4 aggregate queries |
| `getAilmentBreakdown(db)` | `{ problem: string; count: number }[]` top 8 desc | GROUP BY patient_problems.problem |
| `getRecentVisits(db, limit?)` | `{ visitDate, patientId, patientName, patientCode, weightKg, painScale }[]` | visits JOIN patients ORDER BY visit_date desc LIMIT 10 |

### Extend: `src/data/visits.ts`

Add `listVisitsWithData(db, patientId)` — same as `listVisits` but filtered to rows where `weight_kg IS NOT NULL OR pain_scale IS NOT NULL`.

### Tests

New `tests/data/dashboard.test.ts` — PGlite integration tests for all three dashboard functions and `listVisitsWithData`. Happy path per function. No chart component tests (pure presentation).

## Chart Components

### `src/components/AilmentBarChart.tsx`

- `'use client'`
- Props: `data: { problem: string; count: number }[]`
- Recharts: `ResponsiveContainer` → `BarChart` (layout="vertical") → `Bar`, `XAxis`, `YAxis`, `Tooltip`
- Bar fill: `var(--primary)` (sage green via CSS variable string, not Tailwind class)
- Height: 280px
- Empty state: returns null (parent handles guard)

### `src/components/VisitLineChart.tsx`

- `'use client'`
- Props: `data: { visitDate: string; value: number }[]`, `color: string`, `unit: string`
- Recharts: `ResponsiveContainer` → `LineChart` → `Line`, `XAxis`, `YAxis`, `Tooltip`
- Height: 200px
- Empty state: returns null (parent handles ≥2 guard and shows message)

## Delivery Order

1. Data layer — `getDashboardStats`, `getAilmentBreakdown`, `getRecentVisits`, `listVisitsWithData` + tests
2. Install Recharts
3. `AilmentBarChart` + `VisitLineChart` components
4. `/dashboard` page (stat cards + bar chart + recent activity)
5. Navbar update (Dashboard link + `/` redirect)
6. Progress tab on patient detail page

## Out of Scope

- Real-time updates (polling/websocket)
- Date range filters on dashboard
- Exporting chart data
- Appointment/lifestyle features (Phase 2 follow-on)
