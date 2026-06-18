# Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load a real, bilingual-capable webfont (Inter + Noto Sans Devanagari) and fill the type-scale gaps left by the design-language-system spec, normalizing the `CardTitle` size drift on the dashboard.

**Architecture:** `next/font/google` loads both fonts in the root layout as CSS variables; `globals.css`'s existing `font-family` fallback chain is updated to reference them. The browser then picks the right font per character automatically — no component needs to know which script it's rendering. The type scale itself is documentation (merged into the existing design-language-system token table), not a new component; only genuinely inconsistent `CardTitle` usages get a className change.

**Tech Stack:** Next.js 15 (`next/font/google`), Tailwind v4 (`@theme inline` in `globals.css`).

## Global Constraints

- Bilingual UI: every user-facing label/error is "English / मराठी" — font choice must render both scripts without a visual mismatch (per `CLAUDE.md`).
- No new shared heading/text components — apply the type scale via documented Tailwind class strings at point of use, consistent with the existing design-language-system pattern.
- Print/Receipt pages (`src/app/(app)/patients/[id]/print/page.tsx`, `src/components/ReportLetterhead.tsx`, `src/app/(app)/patients/[id]/receipt/page.tsx`) are out of scope.
- Color tokens and spacing tokens in `globals.css` are correct already — do not touch them.
- `docs/architecture.md` must stay current with structural changes per `CLAUDE.md` — Task 2 updates its pointer to the design-token source of truth.

Full design rationale: `docs/superpowers/specs/2026-06-18-typography-design.md`.

---

## File Map

**Modified files:**
- `src/app/layout.tsx` — add `next/font/google` Inter + Noto Sans Devanagari, expose as CSS variables on `<body>`
- `src/app/globals.css` — body `font-family` rule references the new variables
- `docs/superpowers/specs/2026-06-17-design-language-system.md` — append new type-scale rows into its Section 1 token table
- `docs/architecture.md` — point to the design-language-system spec as the source of truth for typography tokens
- `src/app/(app)/dashboard/page.tsx` — 4 `CardTitle` className changes (`text-lg font-semibold` → `text-xl font-semibold`)

**No new files. No test files** — every change in this plan is either a CSS/font-loading change with no branching logic, or a Tailwind className string change on existing elements. The codebase's precedent for this category of change (see `docs/superpowers/plans/2026-06-17-design-language-system.md`, e.g. the `rounded-2xl`/`rounded-full` sweeps) is `npm run typecheck` + a manual visual check, not a unit test — there is no behavior to assert against.

---

## Task 1: Load Inter + Noto Sans Devanagari via next/font

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties `--font-sans` (Inter) and `--font-devanagari` (Noto Sans Devanagari), available globally via `body`'s computed `font-family`. No later task in this plan consumes these directly — they're picked up automatically by every existing element through inheritance.

- [ ] **Step 1: Read the current files**

Read `src/app/layout.tsx` and confirm it matches:

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: "Pawar's Yog Therapy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
```

If it differs, stop and re-check the file map above before continuing — this plan assumes this exact starting point.

- [ ] **Step 2: Add the font imports and variable className**

Replace the full contents of `src/app/layout.tsx` with:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoSansDevanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-devanagari' });

export const metadata: Metadata = { title: "Pawar's Yog Therapy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansDevanagari.variable}`}>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Update the `font-family` fallback chain**

In `src/app/globals.css`, find:

```css
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
}
```

Replace with:

```css
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), var(--font-devanagari), ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: build succeeds — this confirms `next/font` can fetch both Google Fonts at build time (catches network/proxy issues in CI early).

- [ ] **Step 6: Manual visual check**

```bash
npm run dev
```

Visit `/dashboard` and `/patients`. Confirm:
- English text (e.g. "Patients", "Dashboard") renders in Inter (compare to current default sans — Inter has a distinct lowercase "a" and tighter spacing than the OS default).
- Marathi text (e.g. "रुग्ण" in the sidebar) renders in Noto Sans Devanagari with no visible flash-of-mismatched-font.
- A bilingual line like the sidebar nav (English label) sitting near Marathi labels has consistent weight/baseline between both scripts.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: load Inter + Noto Sans Devanagari via next/font"
```

---

## Task 2: Merge the type scale into the design-language-system token table

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-design-language-system.md`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the documented token table that Task 3 implements against (the H2 row).

- [ ] **Step 1: Read the current token table**

Read `docs/superpowers/specs/2026-06-17-design-language-system.md`, Section 1 (`## 1. Design Language Tokens`), lines 9–30. Confirm the existing table has these rows: Page heading, Page subtitle, Card, Primary CTA button, Outline/secondary button, Avatar initials bg, Page section spacing, Page header row, Patient code badge, Empty state.

- [ ] **Step 2: Append the new typography rows**

In that same table, immediately after the `| Page subtitle | ... |` row, insert these new rows:

```markdown
| Section heading (H2) | `text-xl font-semibold` |
| Card title (H3) | `text-base font-semibold` |
| Entity name | `text-2xl font-semibold` |
| Body emphasis | `text-sm font-medium` |
| Body | `text-sm font-normal` |
| Stat / field label | `text-sm font-medium text-muted-foreground` |
| Label / meta | `text-xs text-muted-foreground` |
| Caption / badge | `text-xs font-medium uppercase tracking-wide` |
```

Directly below the table (before the `Color palette` paragraph), add:

```markdown
Font: Inter (Latin) + Noto Sans Devanagari (Devanagari), loaded via `next/font/google` in `src/app/layout.tsx`. See `docs/superpowers/specs/2026-06-18-typography-design.md` for rationale.
```

- [ ] **Step 3: Point architecture.md at this table**

Read `docs/architecture.md` and find the section that lists design/UI conventions (search for "design-language-system" or the conventions/UI section near the top). Add one line referencing the token table:

```markdown
- Design tokens (spacing, color, typography): `docs/superpowers/specs/2026-06-17-design-language-system.md`, Section 1 — the single source of truth for heading/text/card/button classNames.
```

Place it alongside any existing "read these instead of scanning code" style pointers. If `docs/architecture.md` has no such section, add a new `## Design Tokens` section near the top with that one line.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-design-language-system.md docs/architecture.md
git commit -m "docs: merge typography scale into design-language-system token table"
```

---

## Task 3: Normalize dashboard CardTitle sizes to the H2 token

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: the H2 token (`text-xl font-semibold`) defined in Task 2.
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Confirm the four target lines**

```bash
grep -n 'CardTitle className="text-lg font-semibold"' src/app/\(app\)/dashboard/page.tsx
```

Expected output: 4 lines, matching `t.dashboard.weeklyVisits`, `t.dashboard.reminders`, `t.dashboard.weeksSchedule`, `t.dashboard.recentVisits` (currently lines 163, 174, 222, 329 — line numbers may have shifted slightly if the file changed; match on content, not line number).

- [ ] **Step 2: Replace `text-lg font-semibold` with `text-xl font-semibold` on those 4 lines only**

```bash
sed -i '' 's/CardTitle className="text-lg font-semibold"/CardTitle className="text-xl font-semibold"/g' "src/app/(app)/dashboard/page.tsx"
```

- [ ] **Step 3: Verify exactly 4 lines changed and no other `text-lg` usages were touched**

```bash
git diff src/app/\(app\)/dashboard/page.tsx
```

Expected: 4 changed lines, each going from `text-lg font-semibold` to `text-xl font-semibold` on a `CardTitle`. No other lines in the diff.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors (this is a string-literal className change; nothing should break, but this catches accidental syntax damage from `sed`).

- [ ] **Step 5: Manual visual check**

```bash
npm run dev
```

Visit `/dashboard`. Confirm "Weekly Visits", "Reminders", "Week's Schedule", and "Recent Visits" card titles are now visibly larger than the stat-tile labels ("Total Patients" etc.) and the same size as each other.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "fix: normalize dashboard widget titles to H2 type-scale token"
```

---

## Self-Review Notes

- **Spec coverage:** Font choice (Section 2 of spec) → Task 1. Type scale (Section 3) → Task 2. Cleanup targets (Section 4) → Task 3 covers the only actual className changes the spec calls for (dashboard H2 rows); all other rows in Section 4 were explicitly "no change" and need no task.
- **Placeholder scan:** none — every step has literal code/commands.
- **Type consistency:** N/A — no new functions/types introduced; this plan is CSS/font-loading/doc changes only.
