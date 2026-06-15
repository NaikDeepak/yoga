# Branded Patient Report + Branch Field — Design Spec
Date: 2026-06-15

## Overview

Replace the plain text print page at `/patients/[id]/print` with a fully branded clinical report matching the PDF reference design. Add a `branch` field to patients so each patient is assigned to one of the three clinic locations.

## Schema Change

Add one column to `patients`:

```typescript
branch: text('branch'),   // nullable; one of BRANCH_KEYS
```

No new tables. Migration via `npm run db:generate` + `npm run db:migrate`.

## Branch Presets

Add to `src/lib/presets.ts`:

```typescript
export const BRANCHES = [
  { key: 'Manjari BK',  label: 'Manjari BK',  fullAddress: 'Shop No 8, Greenoak Society, Cement Road, near Mhasoba Mandir, Manjari Budruk, Pune, Maharashtra 412307' },
  { key: 'Kharadi',     label: 'Kharadi',      fullAddress: 'Survey no. 24/2B, Opposite of Konark Eureka, Sainath Nagar, Kharadi, Pune, Maharashtra 411014' },
  { key: 'Morgaon',     label: 'Morgaon',      fullAddress: 'Morgaon Pawarwadi, Tal-Dodamarg, Sindhudurg - 416511' },
] as const;

export type BranchKey = typeof BRANCHES[number]['key'];
```

The key (short name) is stored in the DB. The full address is resolved client-side from the constant.

## Modified Files

| Path | Change |
|---|---|
| `src/db/schema.ts` | Add `branch: text('branch')` to patients |
| `src/lib/presets.ts` | Add `BRANCHES` constant |
| `src/lib/validation.ts` | Add `branch: z.string().optional()` to `patientSchema` |
| `src/components/PatientForm.tsx` | Add Branch `<Select>` field |
| `src/app/(app)/patients/[id]/print/page.tsx` | Full visual redesign |

## PatientForm Change

Add a Select field for branch (optional, after Address):

```tsx
<div className="space-y-1">
  <Label htmlFor="branch">Branch / शाखा</Label>
  <Select name="branch" defaultValue={patient?.branch ?? ''}>
    <SelectTrigger><SelectValue placeholder="Select branch / शाखा निवडा" /></SelectTrigger>
    <SelectContent>
      {BRANCHES.map(b => (
        <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Existing patients without a branch remain valid (null); branch only appears in the report when set.

## Print Page — Visual Design

Brand color: `#1B3A2E` (dark green). Accent: `#2D6A4F`. Light tint: `#E8F5E9`.

### Section 1: Letterhead Header

Three-column layout:
- **Left:** PYTC logo — `<img src="/pytc-logo.png" alt="PYTC" />` (downloaded to `public/pytc-logo.png`; ~60px height, no extra border needed)
- **Centre:** "Pawar's Yog Therapy Center" (bold, large) + "HEALING THROUGH NATURE & TRADITION" (small caps, green) + address line (Pune, Maharashtra | phone | email)
- **Right:** Dark green badge box — "DOCUMENT" label (small caps) / "**Patient Report**" (bold) / date / "Ref: [patientCode]"

Clinic contact constants (hardcoded in print page):
```typescript
const CLINIC = { phone: '+91 85509 21037', email: 'pawarsyog@gmail.com', location: 'Pune, Maharashtra' };
```

### Section 2: Patient Identification

Dark green section header bar: `PATIENT IDENTIFICATION` (small caps, white text).

Card below with:
- Circle avatar (dark green bg, white initials — first letters of first + last name, or first two if single name)
- **Name** (bold, 1.5rem) | gender in Marathi (पुरुष/स्त्री/इतर) | Age: N yrs | mobile
- Badge row: patient code (green outline badge) | branch name (green outline badge, only if set)

Gender Marathi map: `{ Male: 'पुरुष', Female: 'स्त्री', Other: 'इतर' }`.

### Section 3: Personal Information

Dark green section header bar.

2-column definition grid (label left, value right):

| Left col | Right col |
|---|---|
| Full Name | Gender (Marathi) |
| Age | Mobile |
| Email | Occupation |
| Address (spans full width) | |
| Branch (spans full width, only if set) | |

### Section 4: Physical Measurements

Dark green section header bar.

2-column grid:

| Left | Right |
|---|---|
| Weight: N.NN kg | Height: N.NN cm |
| BMI: N.N (Category) (spans full width) | |

Omit section entirely if weight and height are both null.

### Section 5: Health Conditions

Dark green section header bar.

Row: "Ailments / Diseases" label | ailment badges (green tint, dark green text). If none: "None recorded / नोंद नाही".

### Section 6: Treatment Plan

Dark green section header bar.

Rows (only shown if field is non-empty):

| Row | Content |
|---|---|
| **Modalities** | Green badge pills derived from which of these fields are non-empty: yogaProgram→"Yoga Program", pranayam→"Pranayam", massage→"Massage", yogaTherapy→"Yoga Therapy", panchkarma→"Panchkarma". Skip row if none. |
| **Yoga Program** | Text content of `plan.yogaProgram` |
| **Pranayam** | Text content of `plan.pranayam` |
| **Massage** | Text content of `plan.massage` |
| **Yoga Therapy** | Text content of `plan.yogaTherapy` |
| **Diet Plan** | Text content of `plan.dietPlan` |
| **Medicines** | Text content of `plan.medicines` |
| **Panchkarma** | Text content of `plan.panchkarma` |
| **Progress Notes** | Latest visit's `progressNote` (most recent by visitDate). Only shown if visits exist. |

Omit entire section if no plan and no visits.

### Section 7: Fee Summary (conditional)

Only rendered if a `fees` row exists for this patient (fetched via `getPatientFees`). Three coloured boxes side by side:

- **Total Fee** (neutral bg): ₹N,NNN
- **Amount Paid** (green tint bg): ₹N,NNN
- **Balance Due** (orange tint bg if > 0, green tint if 0): ₹N,NNN

`getPatientFees` is imported from `src/data/fees.ts` (added in Spec B). In Spec A, if `src/data/fees.ts` doesn't exist yet, this section is simply omitted (no import, no render).

> **Implementation note:** Implement Spec A *without* the fee section. The fee section is wired in during Spec B when `src/data/fees.ts` exists.

### Section 8: Visit History

Dark green section header bar.

Table with dark green header row (white text):

| NO. | VISIT DATE | WEIGHT | PAIN LEVEL | SESSION NOTES |
|---|---|---|---|---|

Rows: visits in descending date order (most recent first). Weight shown as "N.N kg" or "—". Pain as "N/10" or "—".

If no visits: "No visit records found / भेटींची नोंद नाही".

### Footer

Thin horizontal rule, then:
- Right-aligned signature block: "**Aacharya Narayan Pawar**" / "Founder of PYTC & Lead Instructor" / "*Pawar Yoga Therapy Center, Pune*"
- Centred confidentiality line: "This is an official patient record issued by Pawar Yoga Therapy Center. Confidential — intended solely for the patient and treating practitioner. | Generated on [date]"

## Data Fetching

The print page already fetches: patient, problems, plan, visits, assessment. No changes to data fetching for Spec A (fee fetch added in Spec B).

## Testing

- `tests/lib/presets.test.ts` — add: all 3 branch keys are unique, each has a non-empty fullAddress
- No new data tests needed (branch flows through existing `createPatient`/`updatePatient` automatically once added to schema and validation)
- Print page: no automated test (consistent with project convention for print/UI pages); covered by manual QA

## Invariants Preserved

- Branch is optional; existing patients without it are fully valid
- All data access goes through `src/data/*`
- No server actions modified (branch flows through existing `createPatient`/`updatePatient`)
