# Pawar Yoga Therapy — Modern UI Redesign

**Date:** 2026-06-13
**Status:** Approved
**Scope:** Visual overhaul of the Phase 1 UI — warm wellness aesthetic, shadcn/ui component library, shell-first delivery

## Goal

Replace the bare Tailwind markup with a polished, warm wellness UI using shadcn/ui. All Phase 1 functionality stays intact; only presentation changes. Delivered shell-first (navbar → list → forms → detail tabs) so tests stay green and each piece is independently reviewable.

## Approach

Option A — Shell-first: install shadcn/ui, wire the color palette as CSS tokens, then apply components page by page from the outside in.

## Color Palette

| Role | Token | Hex | Notes |
|---|---|---|---|
| Background | `--background` | `#FAF7F2` | Warm cream page background |
| Surface | `--card` | `#FFFFFF` | Cards with `1px border #E8E0D5` + subtle box-shadow |
| Primary | `--primary` | `#4A7548` | Sage green — darkened for AA contrast on small text |
| Primary foreground | `--primary-foreground` | `#FFFFFF` | Text on primary buttons (~4.6:1 ✅) |
| Accent | `--brand-accent` | `#C97B3A` | Warm amber — decorative only (badges, icons); never standalone text on cream. Use a custom CSS var (`--brand-accent`) — shadcn reserves `--accent` for hover/focus states. |
| Muted | `--muted` | `#F0EBE3` | Input backgrounds, dividers |
| Muted foreground | `--muted-foreground` | `#7A6E62` | Secondary text |
| Text | `--foreground` | `#2C2418` | Warm charcoal body text |
| Destructive | `--destructive` | `#C0392B` | Delete/error states |
| Border | `--border` | `#E8E0D5` | Card borders, dividers |

**Contrast notes:**
- Primary (`#4A7548`) on background (`#FAF7F2`): ~4.5:1 — passes AA for all text sizes
- Amber (`#C97B3A`) on cream: ~3.2:1 — decorative use only
- White on primary: ~4.6:1 ✅

**Dark mode:** Light-only for now; deferred to Phase 3.

**Typography:** Inter (shadcn default). Headings at `font-semibold`. Border radius `0.5rem`.

## App Shell

**Navbar** (applied in `src/app/(app)/layout.tsx`):
- `bg-white` + `1px border-b` (`#E8E0D5`), full width
- Left: `Leaf` lucide icon (placeholder) + "Pawar Yoga Therapy" in semibold warm charcoal
- Right: signed-in user email (small, muted) + **Sign Out** ghost button
- `max-w-5xl mx-auto px-4` content wrapper below navbar

**Auth pages** (`/login`, `/register`): full-screen centered card — no navbar, warm cream background.

## Pages

### Patient List (`/patients`)

- Page header: "Patients / रुग्ण" (large semibold) + **+ New Patient** primary button (right)
- Search: full-width on mobile, `max-w-sm` on desktop, lucide `Search` icon inside input
- Patient rows as cards (not bare table):
  - Amber badge: patient code (`PYT-0001`)
  - Semibold name
  - Muted mobile number
  - Sage-tinted pill badges for problems (max 3 shown, `+N more` overflow)
  - Arrow icon right; entire card is clickable → detail page
- Empty state: bilingual message ("No patients yet / अजून रुग्ण नाहीत") + CTA button

### Patient Form (New & Edit)

Grouped sections with muted divider + label headers:
1. **Personal Info** — Name, Age, Gender (radio), Photo (drag-drop with circular preview)
2. **Body Metrics** — Weight, Height, live BMI readout card (value + colored category badge)
3. **Contact** — Mobile, Email, Address, Occupation, Emergency Contact

- Bilingual placeholders on all fields (`"Full Name / पूर्ण नाव"`)
- Inline error messages below each field
- Sticky bottom action bar on mobile: **Save** (primary) + **Cancel** (ghost)
- Edit page: existing photo shown with "Change photo" hover overlay
- `PatientForm` client component refactored to shadcn inputs; BMI logic unchanged

### Patient Detail (`/patients/[id]`)

**Header:** circular avatar (initials fallback) + name + code badge + mobile. **Edit** and **Print** buttons (outline variant) right-aligned.

**Tabs** (shadcn `Tabs`):

**Overview:** 2-column info grid cards — Personal, Contact, Body Metrics. BMI as colored badge. Read-only.

**Problems:** 18 preset ailments as 3-column checkbox grid, Marathi labels. Checked = sage green highlight. Custom input at bottom. Optional note below each checked item.

**Documents:** Upload dropzone at top. Documents grouped by type as card rows — filename, size, date, **View** (signed URL) + **Delete** (confirmation dialog).

**Treatment & Visits:** Two stacked sections:
- Treatment plan: 7 textareas in 2-column grid + **Save Plan** button
- Visit log: chronological visit cards (date, weight, pain scale dot 1–10, note) + **+ Add Visit** inline form

### Print Page (`/patients/[id]/print`)

Unchanged in structure. Only additions:
- Warm typography (Inter, `#2C2418` text color)
- Clinic name + placeholder icon in header
- **Download PDF** button on detail page: shadcn `Button` outline + lucide `Printer` icon
- No shadcn components inside the print view itself — print CSS stays clean

## shadcn/ui Components Used

| Component | Where |
|---|---|
| `Button` | All CTAs, actions |
| `Input`, `Textarea`, `Label` | All forms |
| `Card`, `CardContent`, `CardHeader` | Patient list rows, detail sections |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Patient detail page |
| `Badge` | Patient code, problem chips, BMI category |
| `Dialog` | Delete confirmation |
| `Avatar` | Patient photo / initials |
| `Separator` | Section dividers in forms |

## Delivery Order (Shell-First)

1. Install shadcn/ui, configure CSS tokens, set up theme
2. Navbar + app shell layout
3. Login / Register pages
4. Patient list page
5. Patient form (new + edit)
6. Patient detail page (all four tabs)
7. Print page (typography + PDF button only)

## Testing

- No new test files needed — UI is presentation only
- `npm run typecheck` + `npm test` must stay green throughout
- Manual check after each step: confirm existing functionality unchanged
- Final: manual QA of all 5 screens per `docs/setup.md` checklist
