# Patient Detail Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky compact patient header, a mobile tab dropdown, and a tab content fade-in to the 7-tab patient detail page, per `docs/superpowers/specs/2026-06-16-patient-detail-page-polish-design.md`.

**Architecture:** Two new presentational client components (`PatientHeader`, `TabDropdown`) extracted from the existing server component `src/app/(app)/patients/[id]/page.tsx`, each built test-first in isolation, then wired into the page in a final integration task. No data layer, action, or schema changes — this is UI-only.

**Tech Stack:** Next.js 15 App Router (React 19), shadcn/ui (`Select`, `Avatar`, `Badge`, `Button`), `tw-animate-css` (already imported in `globals.css`), Vitest + `@testing-library/react` (jsdom).

---

## File Map

### Created
| File | Purpose |
|---|---|
| `src/components/PatientHeader.tsx` | Full patient header + sticky compact bar (IntersectionObserver-driven) |
| `src/components/TabDropdown.tsx` | Mobile (`sm:hidden`) tab picker using shadcn `Select`, navigates via `router.push` |
| `tests/components/patient-header.test.tsx` | Compact bar visibility toggling, Receipt link visibility |
| `tests/components/tab-dropdown.test.tsx` | Selecting an option navigates to the right `?tab=` URL |

### Modified
| File | Change |
|---|---|
| `src/app/(app)/patients/[id]/page.tsx` | Replace inline header with `<PatientHeader>`, hide tab bar on mobile + render `<TabDropdown>`, wrap tab content in a fade-in div |
| `package.json` / `package-lock.json` | Add `@testing-library/user-event` devDependency (needed to drive the Radix `Select` in tests) |

---

### Task 1: `PatientHeader` — sticky compact header

**Files:**
- Create: `src/components/PatientHeader.tsx`
- Test: `tests/components/patient-header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/patient-header.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { PatientHeader } from '@/components/PatientHeader';
import type { Patient } from '@/db/schema';

let observerCallback: (entries: { isIntersecting: boolean }[]) => void = () => {};

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    observerCallback = callback;
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

const patient = {
  id: 'p1',
  patientCode: 'PYT-0001',
  fullName: 'Asha Patil',
  mobile: '9999999999',
} as Patient;

describe('PatientHeader', () => {
  it('hides the compact bar initially', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the compact bar once the sentinel scrolls out of view', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'false');
  });

  it('hides the compact bar again once the sentinel scrolls back into view', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'true');
  });

  it('only renders the Receipt link when hasCourseFee is true', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={true} />);
    expect(screen.getByText('Receipt / पावती')).toBeInTheDocument();
  });

  it('does not render the Receipt link when hasCourseFee is false', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    expect(screen.queryByText('Receipt / पावती')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/patient-header.test.tsx`
Expected: FAIL with "Cannot find module '@/components/PatientHeader'" (or similar resolution error).

- [ ] **Step 3: Write the implementation**

Create `src/components/PatientHeader.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pencil, Printer, Receipt } from 'lucide-react';
import type { Patient } from '@/db/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function PatientHeader({
  patient,
  photoUrl,
  hasCourseFee,
}: {
  patient: Patient;
  photoUrl: string | null;
  hasCourseFee: boolean;
}) {
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsCompact(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials(patient.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
            <Badge variant="outline" className="border-brand-accent text-brand-accent">
              {patient.patientCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{patient.mobile}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit / बदला
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/print`}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Report / अहवाल
            </Link>
          </Button>
          {hasCourseFee && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patient.id}/receipt`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Receipt / पावती
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sentinel: once this scrolls above the viewport, the full header is gone and we show the compact bar */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div
        data-testid="compact-header"
        aria-hidden={!isCompact}
        className={cn(
          'sticky top-14 z-10 overflow-hidden bg-card transition-all duration-200',
          isCompact ? 'max-h-16 border-b border-border opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <Avatar className="h-8 w-8">
            {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials(patient.fullName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{patient.fullName}</span>
          <Badge variant="outline" className="border-brand-accent text-brand-accent">
            {patient.patientCode}
          </Badge>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/patient-header.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PatientHeader.tsx tests/components/patient-header.test.tsx
git commit -m "feat: add PatientHeader component with sticky compact bar"
```

---

### Task 2: `TabDropdown` — mobile tab navigation

**Files:**
- Create: `src/components/TabDropdown.tsx`
- Test: `tests/components/tab-dropdown.test.tsx`
- Modify: `package.json`, `package-lock.json` (new devDependency)

- [ ] **Step 1: Install the test-only dependency**

Radix `Select` (used by shadcn's `Select`) needs pointer-event simulation that only `@testing-library/user-event` drives correctly under jsdom.

Run: `npm install -D @testing-library/user-event`
Expected: `package.json` and `package-lock.json` gain the new devDependency.

- [ ] **Step 2: Write the failing test**

Create `tests/components/tab-dropdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabDropdown } from '@/components/TabDropdown';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const TABS = [
  ['overview', 'Overview / माहिती'],
  ['fees', 'Fees / शुल्क'],
] as const;

beforeEach(() => {
  push.mockClear();
  // jsdom doesn't implement these APIs that Radix Select relies on for pointer interactions.
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('TabDropdown', () => {
  it('shows the active tab label in the trigger', () => {
    render(<TabDropdown patientId="p1" activeTab="fees" tabs={TABS} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Fees / शुल्क');
  });

  it('navigates to the selected tab URL', async () => {
    const user = userEvent.setup();
    render(<TabDropdown patientId="p1" activeTab="overview" tabs={TABS} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Fees / शुल्क' }));

    expect(push).toHaveBeenCalledWith('/patients/p1?tab=fees');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/components/tab-dropdown.test.tsx`
Expected: FAIL with "Cannot find module '@/components/TabDropdown'" (or similar resolution error).

- [ ] **Step 4: Write the implementation**

Create `src/components/TabDropdown.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function TabDropdown({
  patientId,
  activeTab,
  tabs,
}: {
  patientId: string;
  activeTab: string;
  tabs: ReadonlyArray<readonly [string, string]>;
}) {
  const router = useRouter();

  return (
    <div className="sm:hidden">
      <Select
        value={activeTab}
        onValueChange={(value) => router.push(`/patients/${patientId}?tab=${value}`)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tabs.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/tab-dropdown.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/TabDropdown.tsx tests/components/tab-dropdown.test.tsx
git commit -m "feat: add TabDropdown component for mobile tab navigation"
```

---

### Task 3: Wire both components into the patient detail page + fade-in

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`

- [ ] **Step 1: Update imports**

In `src/app/(app)/patients/[id]/page.tsx`, replace the import block:

```ts
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Printer, Receipt } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { listVisits, listVisitsWithData } from '@/data/visits';
import { VisitLineChart } from '@/components/VisitLineChart';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { getISTDateString } from '@/lib/dates';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { addVisitAction } from '@/actions/visits';
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
import { getLifestyleAssessment, getLifestyleAssessmentSnapshot } from '@/data/lifestyle';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
```

with:

```ts
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { listVisits, listVisitsWithData } from '@/data/visits';
import { VisitLineChart } from '@/components/VisitLineChart';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { getISTDateString } from '@/lib/dates';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { addVisitAction } from '@/actions/visits';
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
import { getLifestyleAssessment, getLifestyleAssessmentSnapshot } from '@/data/lifestyle';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';
import { PatientHeader } from '@/components/PatientHeader';
import { TabDropdown } from '@/components/TabDropdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
```

(`Pencil`, `Printer`, `Receipt`, `Avatar`, `AvatarFallback`, `AvatarImage` moved into `PatientHeader`; no longer used here.)

- [ ] **Step 2: Remove the now-unused `initials` helper**

Delete this function (it moved into `PatientHeader.tsx`):

```ts
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
```

- [ ] **Step 3: Replace the header, tab bar, and tab content block**

Replace this entire block (from the opening `<div className="space-y-6">` through the closing of the tab-content section, i.e. everything currently between `return (` and the final `</div>\n  );\n}` of `PatientPage`):

```tsx
  return (
    <div className="space-y-6">
      {/* Patient header */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials(patient.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
            <Badge variant="outline" className="border-brand-accent text-brand-accent">
              {patient.patientCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{patient.mobile}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit / बदला
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${id}/print`}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Report / अहवाल
            </Link>
          </Button>
          {patientFees.courseFee !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${id}/receipt`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Receipt / पावती
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tab navigation — URL-based for server rendering, styled like shadcn Tabs */}
      <div className="inline-flex h-9 w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground">
        {TABS.map(([key, title]) => (
          <Link
            key={key}
            href={`/patients/${id}?tab=${key}`}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'hover:bg-card/50 hover:text-foreground'
            }`}
          >
            {title}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
      {tab === 'progress' && <Progress patientId={id} />}
      {tab === 'fees' && <Fees patientId={id} patientFees={patientFees} />}
      {tab === 'assessment' && <Assessment patientId={id} />}
    </div>
  );
}
```

with:

```tsx
  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} photoUrl={photoUrl} hasCourseFee={patientFees.courseFee !== null} />

      <TabDropdown patientId={id} activeTab={tab} tabs={TABS} />

      {/* Tab navigation — URL-based for server rendering, styled like shadcn Tabs. Hidden on mobile in favor of TabDropdown. */}
      <div className="hidden h-9 w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground sm:inline-flex">
        {TABS.map(([key, title]) => (
          <Link
            key={key}
            href={`/patients/${id}?tab=${key}`}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'hover:bg-card/50 hover:text-foreground'
            }`}
          >
            {title}
          </Link>
        ))}
      </div>

      {/* Tab content — keyed by tab so it remounts and fades in on every switch */}
      <div key={tab} className="animate-in fade-in duration-200">
        {tab === 'overview' && <Overview patient={patient} />}
        {tab === 'problems' && <Problems patientId={id} />}
        {tab === 'documents' && <Documents patientId={id} />}
        {tab === 'treatment' && <Treatment patientId={id} />}
        {tab === 'progress' && <Progress patientId={id} />}
        {tab === 'fees' && <Fees patientId={id} patientFees={patientFees} />}
        {tab === 'assessment' && <Assessment patientId={id} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npm test`
Expected: All tests pass, including the two new component test files.

Run: `npm run typecheck`
Expected: No errors (confirms no leftover references to removed imports/`initials`).

- [ ] **Step 5: Manual QA**

Run: `npm run dev`, open `/patients/<any-id>`:
- Scroll down a long tab (e.g. Assessment) — compact bar with name/code should appear pinned below the navbar; scroll up — it should disappear.
- Resize below 640px width — horizontal tab bar should disappear, dropdown should appear and show the active tab; selecting another tab navigates correctly.
- Switch tabs — content should fade in briefly instead of popping in instantly.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/patients/[id]/page.tsx"
git commit -m "feat: wire PatientHeader and TabDropdown into patient detail page, add tab fade-in"
```
