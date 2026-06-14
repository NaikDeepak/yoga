# AI Treatment Plan Draft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate with AI" button to the Treatment Plan card that calls Gemini to draft all 7 treatment fields, which the therapist then edits and saves.

**Architecture:** A new GET route handler (`/api/ai/treatment-plan/[patientId]`) authenticates via Supabase direct check (not `requireUser()` — that redirects rather than returning JSON), fetches all patient data, and calls `generateTreatmentDraft` in `src/lib/gemini.ts`, which uses Gemini 2.0 Flash REST API with structured output to guarantee valid JSON. The treatment plan card is extracted into a `TreatmentPlanForm` client component with controlled textareas, an AlertDialog overwrite guard, and disabled fields during generation.

**Tech Stack:** Next.js 15 App Router, Gemini 2.0 Flash REST API (plain `fetch`, no SDK), Supabase auth direct, Vitest with `vi.stubGlobal('fetch', ...)` for gemini tests.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/gemini.ts` | Create | `TreatmentContext` type, `TreatmentDraftFields` type, `generateTreatmentDraft()` — calls Gemini REST API with structured output config |
| `src/app/api/ai/treatment-plan/[patientId]/route.ts` | Create | GET handler: Supabase auth → fetch patient + problems + lifestyle + visits → build context → call Gemini → return JSON |
| `src/components/TreatmentPlanForm.tsx` | Create | Client component: controlled textareas, Generate button with spinner, AlertDialog overwrite guard, disable during generation |
| `src/app/(app)/patients/[id]/page.tsx` | Modify | `Treatment()`: pass `initialPlan` to `TreatmentPlanForm`, remove inline treatment form card |
| `tests/lib/gemini.test.ts` | Create | Unit tests for `generateTreatmentDraft` with mocked `fetch` |
| `tests/app/api/ai/treatment-plan.test.ts` | Create | Route handler tests with mocked Supabase, data functions, and gemini |

---

## Task 1: `src/lib/gemini.ts` — Types and Gemini wrapper

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `tests/lib/gemini.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/gemini.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTreatmentDraft, type TreatmentContext } from '@/lib/gemini';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const MOCK_DRAFT = {
  yogaProgram: 'Gentle yoga flow twice daily.',
  pranayam: 'Nadi Shodhana 10 minutes morning.',
  massage: 'Lower back with sesame oil.',
  yogaTherapy: 'Supported bridge pose.',
  dietPlan: 'Anti-inflammatory diet, avoid processed foods.',
  medicines: 'Ashwagandha 500mg twice daily.',
  panchkarma: '',
};

const MOCK_CONTEXT: TreatmentContext = {
  patient: { fullName: 'Asha Pawar', age: 45, gender: 'female', weightKg: 65, heightCm: 160 },
  bmi: 25.4,
  ailments: ['Back pain / पाठदुखी'],
  lifestyle: null,
  visits: { count: 0, latestPainScale: null, firstWeightKg: null, latestWeightKg: null },
};

function mockGeminiOk(draft: object) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }],
    }),
  });
}

describe('generateTreatmentDraft', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('returns all 7 fields from a valid Gemini response', async () => {
    mockGeminiOk(MOCK_DRAFT);
    const result = await generateTreatmentDraft(MOCK_CONTEXT);
    expect(result).toEqual(MOCK_DRAFT);
  });

  it('includes patient name in the request body sent to Gemini', async () => {
    mockGeminiOk(MOCK_DRAFT);
    await generateTreatmentDraft(MOCK_CONTEXT);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(JSON.stringify(body)).toContain('Asha Pawar');
  });

  it('throws if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('GEMINI_API_KEY is not set');
  });

  it('throws on HTTP error from Gemini', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate limited' });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini API error 429');
  });

  it('throws if Gemini returns no candidates', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    await expect(generateTreatmentDraft(MOCK_CONTEXT)).rejects.toThrow('Gemini returned empty response');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/gemini.test.ts`
Expected: FAIL with "Cannot find module '@/lib/gemini'"

- [ ] **Step 3: Implement `src/lib/gemini.ts`**

Create `src/lib/gemini.ts`:

```typescript
export type TreatmentDraftFields = {
  yogaProgram: string;
  pranayam: string;
  massage: string;
  yogaTherapy: string;
  dietPlan: string;
  medicines: string;
  panchkarma: string;
};

export type TreatmentContext = {
  patient: {
    fullName: string;
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    heightCm: number | null;
  };
  bmi: number | null;
  ailments: string[];
  lifestyle: {
    chiefComplaint: string | null;
    duration: string | null;
    aggravatingFactors: string | null;
    relievingFactors: string | null;
    previousTreatment: string | null;
    currentMedications: string | null;
    doctorDiagnosis: string | null;
    doctorRestrictions: string | null;
    workType: string | null;
    dailySitting: string | null;
    activityLevel: string | null;
    sleepHours: string | null;
    sleepQuality: number | null;
    stressLevel: number | null;
    screenTime: string | null;
    previousExercise: string | null;
    fitnessLevel: string | null;
    fearOfMovement: boolean | null;
    primaryGoal: string | null;
    activityStruggle: string | null;
    hasContraindications: boolean | null;
    contraindicationDetails: string | null;
  } | null;
  visits: {
    count: number;
    latestPainScale: number | null;
    firstWeightKg: number | null;
    latestWeightKg: number | null;
  };
};

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    yogaProgram: { type: 'STRING', description: 'Recommended yoga postures, sequence, or frequency.' },
    pranayam:    { type: 'STRING', description: 'Recommended breathing exercises.' },
    massage:     { type: 'STRING', description: 'Specific areas to massage, oils, or therapy recommendations.' },
    yogaTherapy: { type: 'STRING', description: 'Therapeutic yoga techniques or modifications.' },
    dietPlan:    { type: 'STRING', description: 'Foods to eat, avoid, or timing instructions.' },
    medicines:   { type: 'STRING', description: 'Ayurvedic medicines or supplements.' },
    panchkarma:  { type: 'STRING', description: 'Panchkarma procedures recommended. Return empty string if not applicable.' },
  },
  required: ['yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma'],
};

const SYSTEM_PROMPT =
  'You are a yoga therapy clinical assistant. Generate a personalised treatment plan based on the patient profile below. ' +
  'If lifestyle assessment data is absent, use the available information (age, gender, BMI, ailments, visit history) and produce a best-effort plan. ' +
  'Use clear, simple English suitable for a clinical record. Return an empty string for fields that are not applicable.';

function buildPrompt(ctx: TreatmentContext): string {
  const { patient, bmi, ailments, lifestyle, visits } = ctx;
  const lines: string[] = [];

  lines.push(
    `Patient: ${patient.fullName}, ${patient.age ?? '?'}y, ${patient.gender ?? 'unknown gender'}, BMI ${bmi ?? 'unknown'}`,
  );
  lines.push(`Ailments: ${ailments.length > 0 ? ailments.join(', ') : 'none recorded'}`);

  if (lifestyle) {
    if (lifestyle.chiefComplaint) {
      lines.push(
        `Chief complaint: ${lifestyle.chiefComplaint}${lifestyle.duration ? `, since ${lifestyle.duration}` : ''}`,
      );
    }
    if (lifestyle.aggravatingFactors) lines.push(`Aggravating factors: ${lifestyle.aggravatingFactors}`);
    if (lifestyle.relievingFactors)   lines.push(`Relieving factors: ${lifestyle.relievingFactors}`);
    if (lifestyle.previousTreatment)  lines.push(`Previous treatment: ${lifestyle.previousTreatment}`);
    if (lifestyle.currentMedications) lines.push(`Current medications: ${lifestyle.currentMedications}`);
    if (lifestyle.doctorDiagnosis)    lines.push(`Doctor diagnosis: ${lifestyle.doctorDiagnosis}`);
    if (lifestyle.doctorRestrictions) lines.push(`Doctor restrictions (must avoid): ${lifestyle.doctorRestrictions}`);

    const lifeParts = [
      lifestyle.workType     && `${lifestyle.workType} work`,
      lifestyle.dailySitting && `sitting ${lifestyle.dailySitting}/day`,
      lifestyle.activityLevel && `activity: ${lifestyle.activityLevel}`,
      lifestyle.screenTime   && `screen time: ${lifestyle.screenTime}`,
    ].filter(Boolean);
    if (lifeParts.length > 0) lines.push(`Lifestyle: ${lifeParts.join(', ')}`);

    const sleepParts = [
      lifestyle.sleepHours   && `${lifestyle.sleepHours}h sleep`,
      lifestyle.sleepQuality != null && `quality ${lifestyle.sleepQuality}/10`,
      lifestyle.stressLevel  != null && `stress ${lifestyle.stressLevel}/10`,
    ].filter(Boolean);
    if (sleepParts.length > 0) lines.push(`Sleep/stress: ${sleepParts.join(', ')}`);

    const exParts = [
      lifestyle.previousExercise && `history: ${lifestyle.previousExercise}`,
      lifestyle.fitnessLevel     && `fitness: ${lifestyle.fitnessLevel}`,
      lifestyle.fearOfMovement != null && `fear of movement: ${lifestyle.fearOfMovement ? 'yes' : 'no'}`,
    ].filter(Boolean);
    if (exParts.length > 0) lines.push(`Exercise: ${exParts.join(', ')}`);

    if (lifestyle.primaryGoal)     lines.push(`Goal: ${lifestyle.primaryGoal}`);
    if (lifestyle.activityStruggle) lines.push(`Struggles with: ${lifestyle.activityStruggle}`);
    if (lifestyle.hasContraindications) {
      lines.push(
        `Contraindications: YES${lifestyle.contraindicationDetails ? ` — ${lifestyle.contraindicationDetails}` : ''}`,
      );
    }
  }

  if (visits.count > 0) {
    const vParts: string[] = [`${visits.count} visits`];
    if (visits.latestPainScale != null) vParts.push(`latest pain ${visits.latestPainScale}/10`);
    if (visits.firstWeightKg != null && visits.latestWeightKg != null) {
      vParts.push(`weight trend ${visits.firstWeightKg}→${visits.latestWeightKg} kg`);
    }
    lines.push(`Visit history: ${vParts.join(', ')}`);
  }

  return lines.join('\n');
}

export async function generateTreatmentDraft(context: TreatmentContext): Promise<TreatmentDraftFields> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: buildPrompt(context) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');

  return JSON.parse(text) as TreatmentDraftFields;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/gemini.test.ts`
Expected: 5 tests passing

- [ ] **Step 5: Verify coverage gate**

Run: `npm run coverage 2>&1 | grep gemini`
Expected: `src/lib/gemini.ts` line appears with ≥80% coverage across lines/functions/branches

- [ ] **Step 6: Commit**

```bash
git add src/lib/gemini.ts tests/lib/gemini.test.ts
git commit -m "feat: add Gemini wrapper for AI treatment plan draft generation"
```

---

## Task 2: Route handler `/api/ai/treatment-plan/[patientId]`

**Files:**
- Create: `src/app/api/ai/treatment-plan/[patientId]/route.ts`
- Test: `tests/app/api/ai/treatment-plan.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/app/api/ai/treatment-plan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/data/patients', () => ({ getPatient: vi.fn() }));
vi.mock('@/data/problems', () => ({ listProblems: vi.fn() }));
vi.mock('@/data/lifestyle', () => ({ getLifestyleAssessment: vi.fn() }));
vi.mock('@/data/visits', () => ({ listVisits: vi.fn() }));
vi.mock('@/lib/gemini', () => ({ generateTreatmentDraft: vi.fn() }));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { listVisits } from '@/data/visits';
import { generateTreatmentDraft } from '@/lib/gemini';
import { GET } from '@/app/api/ai/treatment-plan/[patientId]/route';

const MOCK_PATIENT = {
  id: 'patient-1',
  fullName: 'Asha Pawar',
  patientCode: 'PYT-0001',
  age: 45,
  gender: 'female',
  weightKg: 65,
  heightCm: 160,
  mobile: '9876543210',
  email: null,
  address: null,
  occupation: null,
  emergencyContact: null,
  photoPath: null,
  createdAt: new Date(),
};

const MOCK_DRAFT = {
  yogaProgram: 'Gentle yoga.',
  pranayam: 'Nadi Shodhana.',
  massage: 'Lower back.',
  yogaTherapy: 'Bridge pose.',
  dietPlan: 'Anti-inflammatory.',
  medicines: 'Ashwagandha.',
  panchkarma: '',
};

let mockGetUser: ReturnType<typeof vi.fn>;

function makeRequest() {
  return new Request('http://localhost/api/ai/treatment-plan/patient-1');
}
function makeParams(patientId = 'patient-1') {
  return { params: Promise.resolve({ patientId }) };
}

beforeEach(() => {
  mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } });
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    { auth: { getUser: mockGetUser } } as any,
  );
  vi.mocked(getPatient).mockResolvedValue(MOCK_PATIENT as any);
  vi.mocked(listProblems).mockResolvedValue([]);
  vi.mocked(getLifestyleAssessment).mockResolvedValue(undefined);
  vi.mocked(listVisits).mockResolvedValue([]);
  vi.mocked(generateTreatmentDraft).mockResolvedValue(MOCK_DRAFT);
});

describe('GET /api/ai/treatment-plan/[patientId]', () => {
  it('returns 200 with 7-field draft on success', async () => {
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_DRAFT);
  });

  it('returns 401 JSON when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('returns 404 JSON when patient does not exist', async () => {
    vi.mocked(getPatient).mockResolvedValue(undefined);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Patient not found' });
  });

  it('returns 500 JSON when Gemini throws', async () => {
    vi.mocked(generateTreatmentDraft).mockRejectedValue(new Error('Rate limited by Gemini'));
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Rate limited by Gemini' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/app/api/ai/treatment-plan.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/ai/treatment-plan/[patientId]/route'"

- [ ] **Step 3: Create the route handler**

Create `src/app/api/ai/treatment-plan/[patientId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { listVisits } from '@/data/visits';
import { computeBmi } from '@/lib/bmi';
import { generateTreatmentDraft, type TreatmentContext } from '@/lib/gemini';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
    }

    const { patientId } = await params;
    const db = getDb();

    const patient = await getPatient(db, patientId);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const [problems, lifestyle, allVisits] = await Promise.all([
      listProblems(db, patientId),
      getLifestyleAssessment(db, patientId),
      listVisits(db, patientId),
    ]);

    // listVisits returns desc order: index 0 = most recent visit
    const visitsWithWeight = allVisits.filter((v) => v.weightKg != null);

    const context: TreatmentContext = {
      patient: {
        fullName: patient.fullName,
        age: patient.age ?? null,
        gender: patient.gender ?? null,
        weightKg: patient.weightKg ?? null,
        heightCm: patient.heightCm ?? null,
      },
      bmi: computeBmi(patient.weightKg, patient.heightCm),
      ailments: problems.map((p) => p.problem),
      lifestyle: lifestyle
        ? {
            chiefComplaint: lifestyle.chiefComplaint ?? null,
            duration: lifestyle.duration ?? null,
            aggravatingFactors: lifestyle.aggravatingFactors ?? null,
            relievingFactors: lifestyle.relievingFactors ?? null,
            previousTreatment: lifestyle.previousTreatment ?? null,
            currentMedications: lifestyle.currentMedications ?? null,
            doctorDiagnosis: lifestyle.doctorDiagnosis ?? null,
            doctorRestrictions: lifestyle.doctorRestrictions ?? null,
            workType: lifestyle.workType ?? null,
            dailySitting: lifestyle.dailySitting ?? null,
            activityLevel: lifestyle.activityLevel ?? null,
            sleepHours: lifestyle.sleepHours ?? null,
            sleepQuality: lifestyle.sleepQuality ?? null,
            stressLevel: lifestyle.stressLevel ?? null,
            screenTime: lifestyle.screenTime ?? null,
            previousExercise: lifestyle.previousExercise ?? null,
            fitnessLevel: lifestyle.fitnessLevel ?? null,
            fearOfMovement: lifestyle.fearOfMovement ?? null,
            primaryGoal: lifestyle.primaryGoal ?? null,
            activityStruggle: lifestyle.activityStruggle ?? null,
            hasContraindications: lifestyle.hasContraindications ?? null,
            contraindicationDetails: lifestyle.contraindicationDetails ?? null,
          }
        : null,
      visits: {
        count: allVisits.length,
        latestPainScale: allVisits[0]?.painScale ?? null,
        // visitsWithWeight is desc-ordered, so index 0 = newest, last = oldest
        latestWeightKg: visitsWithWeight[0]?.weightKg ?? null,
        firstWeightKg: visitsWithWeight[visitsWithWeight.length - 1]?.weightKg ?? null,
      },
    };

    const draft = await generateTreatmentDraft(context);
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/app/api/ai/treatment-plan.test.ts`
Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/treatment-plan/[patientId]/route.ts tests/app/api/ai/treatment-plan.test.ts
git commit -m "feat: add AI treatment plan route handler with Supabase auth"
```

---

## Task 3: `TreatmentPlanForm` client component

**Files:**
- Create: `src/components/TreatmentPlanForm.tsx`

No unit tests — client component covered by manual QA (project convention for interactive form components).

- [ ] **Step 1: Create `src/components/TreatmentPlanForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { InlineForm } from '@/components/InlineForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { TreatmentPlan } from '@/db/schema';
import type { TreatmentDraftFields } from '@/lib/gemini';

type Fields = TreatmentDraftFields;

const PLAN_FIELDS: [keyof Fields, string][] = [
  ['yogaProgram', 'Yoga Program / योग कार्यक्रम'],
  ['pranayam', 'Pranayam / प्राणायाम'],
  ['massage', 'Massage / मसाज'],
  ['yogaTherapy', 'Yoga Therapy / योग थेरपी'],
  ['dietPlan', 'Diet Plan / आहार योजना'],
  ['medicines', 'Medicines / औषधे'],
  ['panchkarma', 'Panchkarma / पंचकर्म'],
];

export function TreatmentPlanForm({
  patientId,
  initialPlan,
}: {
  patientId: string;
  initialPlan: TreatmentPlan | undefined;
}) {
  const [fields, setFields] = useState<Fields>({
    yogaProgram: initialPlan?.yogaProgram ?? '',
    pranayam:    initialPlan?.pranayam    ?? '',
    massage:     initialPlan?.massage     ?? '',
    yogaTherapy: initialPlan?.yogaTherapy ?? '',
    dietPlan:    initialPlan?.dietPlan    ?? '',
    medicines:   initialPlan?.medicines   ?? '',
    panchkarma:  initialPlan?.panchkarma  ?? '',
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasContent = Object.values(fields).some((v) => v.trim().length > 0);

  async function doGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/ai/treatment-plan/${patientId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const draft = await res.json() as Fields;
      setFields(draft);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerate() {
    if (hasContent) {
      setShowConfirm(true);
    } else {
      void doGenerate();
    }
  }

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current plan with an AI draft. Unsaved edits will be lost.
              Continue? / यामुळे तुमचे न जतन केलेले बदल मिटवले जातील. पुढे जायचे?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel / रद्द करा</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                void doGenerate();
              }}
            >
              Continue / पुढे जा
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Treatment Plan / उपचार योजना</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating… / तयार होत आहे
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate with AI / AI ने तयार करा
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {genError && (
            <p className="mb-3 text-sm text-destructive">
              AI generation failed — please try again / पुन्हा प्रयत्न करा
            </p>
          )}
          <InlineForm
            action={saveTreatmentPlanAction.bind(null, patientId)}
            className="space-y-3"
          >
            {PLAN_FIELDS.map(([name, title]) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`plan-${name}`}>{title}</Label>
                <Textarea
                  id={`plan-${name}`}
                  name={name}
                  rows={2}
                  value={fields[name]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [name]: e.target.value }))}
                  disabled={generating}
                />
              </div>
            ))}
            <Button type="submit" size="sm" disabled={generating}>
              Save plan / योजना जतन करा
            </Button>
          </InlineForm>
        </CardContent>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/TreatmentPlanForm.tsx
git commit -m "feat: add TreatmentPlanForm client component with AI generate button"
```

---

## Task 4: Wire `TreatmentPlanForm` into `page.tsx`

**Files:**
- Modify: `src/app/(app)/patients/[id]/page.tsx`

- [ ] **Step 1: Add import and replace inline treatment form card**

At the top of `src/app/(app)/patients/[id]/page.tsx`, add this import alongside the other component imports:

```tsx
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
```

Remove this now-unused import (moved to TreatmentPlanForm):

```tsx
import { saveTreatmentPlanAction } from '@/actions/treatment';  // DELETE this line
```

Replace the entire `Treatment()` async function with:

```tsx
async function Treatment({ patientId }: { patientId: string }) {
  const db = getDb();
  const plan = await getTreatmentPlan(db, patientId);
  const visits = await listVisits(db, patientId);
  const today = getISTDateString();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TreatmentPlanForm patientId={patientId} initialPlan={plan} />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Visit / नवीन भेट</CardTitle>
          </CardHeader>
          <CardContent>
            <InlineForm
              action={addVisitAction.bind(null, patientId)}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="visitDate">Date / तारीख</Label>
                  <Input id="visitDate" name="visitDate" type="date" defaultValue={today} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visitWeight">Weight (kg)</Label>
                  <Input id="visitWeight" name="weightKg" type="number" step="0.1" placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visitPain">Pain (1–10)</Label>
                  <Input id="visitPain" name="painScale" type="number" min="1" max="10" placeholder="—" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nextVisitDate">
                  Next visit / पुढील भेट{' '}
                  <span className="text-xs text-muted-foreground">(optional / ऐच्छिक)</span>
                </Label>
                <Input id="nextVisitDate" name="nextVisitDate" type="date" min={today} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progressNote">Progress note / प्रगती नोंद</Label>
                <Textarea id="progressNote" name="progressNote" rows={2} />
              </div>
              <Button type="submit" size="sm">Add visit / भेट जोडा</Button>
            </InlineForm>
          </CardContent>
        </Card>

        <ul className="space-y-2">
          {visits.length === 0 && (
            <li className="text-sm text-muted-foreground">No visits yet / भेटी नाहीत</li>
          )}
          {visits.map((v) => (
            <li key={v.id}>
              <Card>
                <CardContent className="pb-3 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{v.visitDate}</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {v.weightKg != null && <span>{v.weightKg} kg</span>}
                      {v.painScale != null && (
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${painColor(v.painScale)}`}
                          />
                          {v.painScale}/10
                        </span>
                      )}
                    </div>
                  </div>
                  {v.progressNote && (
                    <p className="mt-1 text-sm text-muted-foreground">{v.progressNote}</p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Run full test suite and coverage**

Run: `npm test`
Expected: all existing tests pass, coverage ≥ 80%

Run: `npm run build`
Expected: build completes without errors

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/patients/[id]/page.tsx
git commit -m "feat: wire TreatmentPlanForm into patient detail page"
```

---

## Task 5: Manual QA

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open `http://localhost:3000` and log in.

- [ ] **Step 2: Verify Generate button renders**

Navigate to `/patients/<any-id>?tab=treatment`. Verify:
- "Generate with AI / AI ने तयार करा" button with Sparkles icon appears in the Treatment Plan card header
- Existing saved plan values are pre-filled in the textareas

- [ ] **Step 3: Test generation with empty fields**

If all textareas are empty, click Generate. Verify:
- Button shows spinner + "Generating… / तयार होत आहे"
- All 7 textareas are disabled (non-interactive, greyed out) during generation
- On success: all 7 textareas fill with English text from Gemini
- Button returns to normal

- [ ] **Step 4: Test overwrite protection**

With at least one field containing text, click Generate. Verify:
- AlertDialog appears: "Replace current plan?"
- Clicking "Cancel / रद्द करा" closes dialog, fields unchanged
- Clicking "Continue / पुढे जा" triggers generation and overwrites fields

- [ ] **Step 5: Test save flow**

After AI fills the fields: click "Save plan / योजना जतन करा". Verify:
- InlineForm shows "Saved / जतन झाले ✓"
- Hard-reload the page — the AI-generated content persists in the textareas

- [ ] **Step 6: Test with a patient who has no lifestyle assessment**

Navigate to a patient with no assessment. Click Generate. Verify:
- Generation proceeds (no blocking message)
- Gemini produces a plan using ailments + patient basics

- [ ] **Step 7: Final commit if any QA fixes were needed**

```bash
git add -p
git commit -m "fix: <describe fix>"
```
