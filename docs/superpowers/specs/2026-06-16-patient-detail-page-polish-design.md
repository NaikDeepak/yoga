# Pawar Yoga Therapy — Patient Detail Page Polish

**Date:** 2026-06-16
**Status:** Approved
**Scope:** `src/app/(app)/patients/[id]/page.tsx` only — sticky header, mobile tab dropdown, tab content fade-in transition.

## Goal

The patient detail page has grown to 7 tabs (Overview, Problems, Documents, Treatment & Visits, Progress, Fees, Assessment). Three small UI improvements address the resulting usability issues without touching any business logic, data layer, or server actions:

1. Patient identity is lost when scrolling down long tabs (e.g. Assessment) — needs a sticky compact header.
2. The horizontal tab bar becomes a horizontal-scroll mess on phones — needs a dropdown alternative below `sm` (640px).
3. Tab switches are an abrupt content swap — needs a light fade-in.

This is presentation-only. The existing server-rendered, URL-based tab architecture (`?tab=...`, deep-linkable, bookmarkable — see `docs/superpowers/specs/2026-06-13-ui-redesign-design.md`) is preserved unchanged; nothing here moves tab state to the client.

## 1. Sticky Patient Header

**Component:** `PatientHeader` (new client component), replacing the static header markup currently inline in `page.tsx` (the avatar/name/code/mobile/action-buttons block).

**Behavior:**
- Renders the full header exactly as today (avatar, name, code badge, mobile, Edit/Print/Receipt buttons) at the top of the page.
- An invisible sentinel `<div>` sits immediately after the full header. An `IntersectionObserver` watches it.
- When the sentinel scrolls out of view (i.e. the full header has scrolled past the navbar), a **compact bar** becomes visible: small avatar, name, patient code badge — no mobile number, no action buttons.
- The compact bar is `sticky`, positioned just below the app navbar (the navbar itself is `sticky top-0 z-10`; the compact bar uses an offset tuned to the navbar's actual rendered height during implementation, e.g. `top-14`).
- When the sentinel scrolls back into view (user scrolls up), the compact bar hides again.
- No data or props change — `PatientHeader` receives the same `patient` and `photoUrl` values already computed in `page.tsx`.

**Out of scope:** action buttons in the compact bar, click-to-scroll-to-top (nice-to-have, not required for this pass).

## 2. Mobile Tab Dropdown

**Component:** `TabDropdown` (new client component), rendered alongside the existing tab bar.

**Behavior:**
- Below `sm` (640px): the existing horizontal `Link`-based tab bar is hidden (`hidden sm:flex`); `TabDropdown` is shown instead (`sm:hidden`).
- `TabDropdown` uses the shadcn `Select` component (already installed at `src/components/ui/select.tsx`, no new dependency) with the active tab's bilingual label as the trigger value.
- On selection, `onValueChange` calls `router.push(`/patients/${id}?tab=${value}`)` — producing the exact same URL the `Link`s already produce. No new routing logic, no client-side tab state.
- At `sm` and above: unchanged horizontal tab bar, no dropdown.

## 3. Tab Content Fade-In

**Change:** wrap the existing per-tab render block in `page.tsx` (`{tab === 'overview' && <Overview .../>}` etc.) in a single `<div key={tab} className="animate-in fade-in duration-200">`.

- `tw-animate-css` is already imported in `globals.css`, providing the `animate-in`/`fade-in` utility classes — no new dependency.
- `key={tab}` forces React to remount the div on every tab switch, retriggering the animation.
- Pure CSS — no JS, no layout shift. Degrades to an instant render if animation classes are unsupported.

## Testing

These changes are presentational UI behavior in `src/app`, outside the 80% coverage gate (`src/lib`, `src/data`, `src/actions`). Tests added anyway, using the existing component test setup:

- `TabDropdown`: selecting an option navigates to the expected `?tab=` URL.
- `PatientHeader`: compact bar visibility toggles correctly based on `IntersectionObserver` state (mocked).
- No test for the CSS-only fade-in (not meaningfully testable, low risk).

## Non-Goals

- No changes to tab content, data fetching, or any of the 7 tab body functions beyond the wrapping `<div>`.
- No dark mode, no global theming changes (separate area, not in this spec).
- No changes to the dashboard, forms, or any other page.
