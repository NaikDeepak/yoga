# Typography — Type Scale & Webfont

**Date:** 2026-06-18
**Status:** Approved
**Scope:** Load a real webfont (bilingual-capable), define a complete type scale on top of the design-language-system's existing H1/subtitle/card-title rules, and normalize the heading-size drift found in `CardTitle` usage across dashboard and patient pages.

---

## 1. Background

`globals.css` currently sets `font-family: var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif)`, but `--font-sans` is never defined and no `next/font` import exists anywhere in the app. In practice the app renders in whatever default sans-serif the OS provides — "Inter" is never actually loaded.

The [design-language-system spec](2026-06-17-design-language-system.md) (PR #12) standardized spacing, cards, and buttons, and defined three typography rules (page heading, page subtitle, card title) — but didn't define a full scale. A grep across `src/` for `CardTitle`/heading usage shows real drift: the same semantic role ("section title") appears as `text-sm font-medium`, `text-base font-semibold`, `text-lg font-semibold`, and `text-2xl font-bold` in different files.

The app is bilingual (English / मराठी) throughout, so the font choice must render Devanagari well — not fall back silently to a mismatched system font next to the Latin webfont.

---

## 2. Font Choice

**Inter** (Latin) + **Noto Sans Devanagari** (Devanagari), both loaded via `next/font/google`.

Chosen over single-font bilingual options (Hind, Mukta) after visual comparison with real app content (header, subtitle, patient card) in English and Marathi — approved by user.

Loaded as CSS variables in `src/app/layout.tsx`:

```ts
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });
```

Applied to `<html>` or `<body>` className: `${inter.variable} ${notoDevanagari.variable}`.

`globals.css` body rule becomes:

```css
body {
  font-family: var(--font-sans), var(--font-devanagari), ui-sans-serif, system-ui, sans-serif;
}
```

The browser selects glyphs per-character from this stack — Latin text renders in Inter, Devanagari text automatically falls through to Noto Sans Devanagari. No component needs to know which script it's rendering; bilingual strings like `"Patients / रुग्ण"` render correctly with zero markup changes.

---

## 3. Type Scale

Extends the design-language-system token table. Existing rows (marked *existing*) are unchanged; new rows fill the gaps.

| Role | Tailwind | Size / Weight | Notes |
|---|---|---|---|
| H1 — page title *(existing)* | `text-3xl font-bold tracking-tight text-foreground` | 30px / 700 | Set by `PageHeader` |
| H2 — section heading *(new)* | `text-xl font-semibold` | 20px / 600 | Sub-sections within a page (e.g. dashboard widget titles, tab headers) |
| H3 / card title *(existing)* | `text-base font-semibold` | 16px / 600 | Set by `SectionCard`; also correct default on bare `CardTitle` |
| Entity name *(new, named not changed)* | `text-2xl font-semibold` | 24px / 600 | `PatientHeader` full name — between H1 and H2, intentionally |
| Body emphasis *(new)* | `text-sm font-medium` | 14px / 500 | Names, key values inside lists/cards |
| Body *(new)* | `text-sm font-normal` | 14px / 400 | Default paragraph/cell text |
| Subtitle / muted *(existing)* | `text-sm text-muted-foreground mt-1` | 14px / 400 | Set by `PageHeader` |
| Stat / field label *(new)* | `text-sm font-medium text-muted-foreground` | 14px / 500, muted | Distinct from a heading — labels a value (dashboard stat tiles, patient-detail field groups) |
| Label / meta *(new)* | `text-xs text-muted-foreground` | 12px / 400, muted | Secondary inline info (timestamps, counts) |
| Caption / badge *(new)* | `text-xs font-medium uppercase tracking-wide` | 12px / 500 | Chips, badges, status pills |

Color palette and spacing tokens are unchanged (already correct per the design-language-system spec).

---

## 4. Cleanup Targets

Only fixing genuine drift — not a full rewrite. Each `CardTitle` below changes its `className` only; no structural changes.

**File:** `src/app/(app)/dashboard/page.tsx`
- Lines 163, 174, 222, 329 (`Weekly Visits`, `Reminders`, `Week's Schedule`, `Recent Visits`): `text-lg font-semibold` → `text-xl font-semibold` (H2)
- Lines 124, 384 (stat tile titles): keep `text-sm font-medium text-muted-foreground` — already correct for the "stat/field label" role, just now a named token instead of an ad hoc choice
- Lines 257, 288, 306 (`text-base font-semibold`): already correct (H3) — no change

**File:** `src/app/(app)/patients/[id]/page.tsx`
- Lines 136, 154, 178, 197, 521, 538 (`text-sm font-medium text-muted-foreground` sidebar field-group titles): no change — correct "stat/field label" role
- Lines 408, 603, 657, 695, 791, 833, 919, 945, 971 (`text-base`): no change — already H3
- Line 51 in `src/components/PatientHeader.tsx` (`text-2xl font-semibold` patient name): no change — now documented as "entity name" role

**File:** `src/components/RevenueStatCard.tsx`
- Line 22 (`text-sm font-medium text-muted-foreground`): no change — correct stat/field label

**Not touched:** `src/app/(app)/patients/[id]/print/page.tsx`, `src/components/ReportLetterhead.tsx`, `src/app/(app)/patients/[id]/receipt/page.tsx` — print/receipt pages are out of scope (same exclusion as the design-language-system spec). `src/app/login/page.tsx`, `src/app/register/page.tsx` — bare `CardTitle` already inherits the correct H3 default. `src/components/Sidebar.tsx` nav section labels (`text-xs font-semibold tracking-wider uppercase`) — close enough to the new caption token that touching it risks an unrelated visual nit; leave as-is.

---

## 5. What Is NOT Changing

- Color tokens, spacing tokens, button/card shape rules — untouched.
- No new shared heading/text components — the scale is applied via documented Tailwind class strings at point of use, consistent with how the design-language-system spec already operates (`PageHeader`, `SectionCard` set the two rows that needed a shared component; the rest are just documented class combinations).
- No changes to `PatientForm`, `TreatmentPlanForm` internals, or any data/action layer.
- Print/Receipt pages.

---

## 6. File Inventory

**Modified files:**
- `src/app/layout.tsx` — `next/font/google` Inter + Noto Sans Devanagari setup
- `src/app/globals.css` — body `font-family` rule
- `src/app/(app)/dashboard/page.tsx` — 4 `CardTitle` className changes (H2 normalization)
- `docs/superpowers/specs/2026-06-17-design-language-system.md` — append the new type-scale rows (Section 3 of this doc) into its Section 1 token table, so there is one living table instead of two
- `docs/architecture.md` — add a pointer to the design-language-system spec as the source of truth for typography/design tokens, if not already referenced

**No new component files.**

---

## 7. Testing Notes

- Visual: run `npm run dev`, check `/dashboard`, `/patients`, `/patients/[id]` render Inter for English and Noto Sans Devanagari for Marathi with no FOUT/mismatch flash.
- Confirm bilingual strings (e.g. `"Patients / रुग्ण"`) render both scripts cleanly in the same line with consistent baseline/weight.
- No unit tests needed — this is styling/className only, no logic change. Existing component tests should still pass unchanged (no prop/behavior changes).
- `npm run build` to confirm `next/font` Google Fonts fetch succeeds at build time (no network access issues in CI).
