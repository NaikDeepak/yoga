# Assessment in PDF/Print — Design Spec

**Date:** 2026-06-14
**Status:** Approved
**Scope:** Add clinically relevant assessment data to the existing patient print page (`/patients/[id]/print`).

## Goal

The print page currently shows registration, problems, treatment plan, and visit history. It does not include assessment data. Referring physicians and the patient file need: chief complaint, medications, doctor's diagnosis/restrictions, contraindications, and goal. These are the signals a doctor, insurance form, or new clinic intake would ask for — the internal lifestyle/exercise sections are not relevant externally.

## What changes

**One file only:** `src/app/(app)/patients/[id]/print/page.tsx`

- Import `getLifestyleAssessment` from `@/data/lifestyle`
- Add it to the existing `Promise.all` call alongside `listProblems`, `getTreatmentPlan`, `listVisits`
- Conditionally render three new `<section>` blocks between Health Problems and Treatment Plan (only if the assessment exists and has at least one relevant field)

## Three sections to add (in order)

### Primary Concern / मुख्य तक्रार
Fields: `chiefComplaint`, `duration`, `aggravatingFactors`, `relievingFactors`, `previousTreatment`
Render as the same `<table>` / key-value pattern used for Registration.
Only render rows where the value is non-null.
Skip the whole section if all five fields are null.

### Medications & Restrictions / औषधे आणि निर्बंध
Fields: `currentMedications`, `doctorDiagnosis`, `doctorRestrictions`
Same pattern. Skip section if all three are null.

### Goals & Safety / उद्दिष्टे आणि सुरक्षितता
Fields: `primaryGoal`, `hasContraindications`, `contraindicationDetails`
For `hasContraindications`: render as "Yes / होय ⚠" (red) or "No / नाही". Only show if non-null.
Skip section if all three are null.

## Sections explicitly NOT included in print

- Lifestyle (work type, sleep, stress, screen time) — internal treatment-planning signals
- Exercise History (previous exercise, fitness level, fear of movement) — internal

## Data layer

`getLifestyleAssessment(db, id)` already exists and is already tested. No new data functions, no schema changes, no migrations.

## Tests

No new tests required. The data layer is already covered by `tests/data/lifestyle.test.ts`. The print page is a server component with no interactive logic — existing manual QA checklist in `docs/setup.md` covers it.

## Placement in print layout

```
Registration / नोंदणी
Health Problems / आजार
── NEW ─────────────────────────────────
Primary Concern / मुख्य तक्रार         ← if assessment exists and has content
Medications & Restrictions / औषधे      ← if assessment exists and has content
Goals & Safety / उद्दिष्टे आणि सुरक्षितता ← if assessment exists and has content
────────────────────────────────────────
Treatment Plan / उपचार योजना
Visit History / भेटींचा इतिहास
Footer
```

## Key-value row labels (bilingual)

| Field | Label |
|-------|-------|
| `chiefComplaint` | Chief Complaint / मुख्य तक्रार |
| `duration` | Since / केव्हापासून |
| `aggravatingFactors` | Aggravating Factors / काय त्रास वाढवते |
| `relievingFactors` | Relieving Factors / काय आराम देते |
| `previousTreatment` | Previous Treatment / आधीचे उपचार |
| `currentMedications` | Current Medications / सध्याची औषधे |
| `doctorDiagnosis` | Doctor's Diagnosis / डॉक्टरांचे निदान |
| `doctorRestrictions` | Doctor's Restrictions / डॉक्टरांचे निर्बंध |
| `primaryGoal` | Primary Goal / मुख्य उद्दिष्ट |
| `hasContraindications` | Contraindications / विरोधाभास |
| `contraindicationDetails` | Details / तपशील |
