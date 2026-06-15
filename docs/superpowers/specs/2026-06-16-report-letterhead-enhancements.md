# Report & Receipt Letterhead Enhancements — Design Spec
Date: 2026-06-16

## Overview

Improve the patient report (`/patients/[id]/print`) and receipt (`/patients/[id]/receipt`) to include
accurate clinic details from the public portal: branch-specific address, operating hours, updated
tagline, and correct practitioner title. No schema changes needed — all data is already in the
`BRANCHES` constant or hardcoded in the page constants.

## Goal

When a patient has a branch assigned, their report/receipt should show that branch's full address
(phone + email stay the same across all branches). If no branch is assigned, fall back to the current
generic location line.

---

## Changes to `src/app/(app)/patients/[id]/print/page.tsx`
*(identical changes apply to `receipt/page.tsx`)*

### 1. CLINIC constant — add hours and full addresses

```typescript
const CLINIC = {
  phone: '+91 85509 21037',
  email: 'pawarsyog@gmail.com',
  hours: 'Mon–Sat, 6:00 AM – 8:00 PM',
  defaultLocation: 'Pune, Maharashtra',
};
```

### 2. Letterhead — branch-specific address + hours

**Current** (always shows generic location):
```
📍 Pune, Maharashtra   📞 +91 85509 21037   ✉ pawarsyog@gmail.com
```

**New** — two rows in the contact block:

Row 1 (address): If patient has a branch, show that branch's `fullAddress`. Otherwise show
`CLINIC.defaultLocation`.

Row 2 (hours + contact):
```
📞 +91 85509 21037   ✉ pawarsyog@gmail.com   🕐 Mon–Sat, 6:00 AM – 8:00 PM
```

Visual layout (inside the existing contact `<p>` block):
```tsx
<p className="mt-1 text-xs text-gray-500">
  📍 {branch ? branch.fullAddress : CLINIC.defaultLocation}
</p>
<p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
  <span>📞 {CLINIC.phone}</span>
  <span>✉ {CLINIC.email}</span>
  <span>🕐 {CLINIC.hours}</span>
</p>
```

### 3. Tagline — update to real portal tagline

**Current:** `HEALING THROUGH NATURE & TRADITION` (fabricated)

**New:** `LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS`
(adapted from portal: "Live Pain-Free, Embrace Health and Happiness Today!" — shortened slightly
for the small-caps line, but faithful to the real tagline)

### 4. Footer signature block — correct title

**Current:**
```
Aaracharya Narayan Pawar
Founder of PYTC & Lead Instructor
Pawar's Yog Therapy Center, Pune
```

**New:**
```
Aacharya Narayan Pawar
Founder & Director of PYTC | Chief Medical Yoga Expert
Pawar's Yog Therapy Center
```

(Remove "Pune" from the third line — the address is already in the letterhead.)

---

## Files Modified

| File | Change |
|---|---|
| `src/app/(app)/patients/[id]/print/page.tsx` | CLINIC constant, letterhead contact block, tagline, footer |
| `src/app/(app)/patients/[id]/receipt/page.tsx` | Same four changes |

## Files NOT Changed

- Schema — no new columns needed
- `src/lib/presets.ts` — `BRANCHES` already has `fullAddress` for each branch
- Any server actions or data layer

## Testing

No automated tests needed (UI-only print pages, covered by manual QA).

**Manual QA checklist:**
- Patient WITH a branch: letterhead shows that branch's full address
- Patient WITHOUT a branch: letterhead shows "Pune, Maharashtra"
- Operating hours line appears on both report and receipt
- Tagline reads "LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS"
- Footer reads "Aacharya Narayan Pawar / Founder & Director of PYTC | Chief Medical Yoga Expert / Pawar's Yog Therapy Center"
- Print preview looks clean (no nav header — already fixed)

---

## Open Questions for Discussion

1. **Tagline wording**: Portal says "Live Pain-Free, Embrace Health and Happiness Today!" — shortened to
   `LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS` for the small-caps letterhead line. Is this wording
   OK, or would you prefer the full text, or a Marathi version?

2. **Branch address on no-branch patients**: Fallback to "Pune, Maharashtra" (current) or show nothing?

3. **Shared letterhead component**: Both print and receipt pages have identical letterhead code. Worth
   extracting to a shared `<ReportLetterhead>` component in `src/components/` to avoid copy-paste drift?
   Minor refactor, not strictly needed now.
