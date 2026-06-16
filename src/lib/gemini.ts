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
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
    if (lifestyle.hasContraindications || lifestyle.contraindicationDetails) {
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

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const EXPECTED_KEYS: Array<keyof TreatmentDraftFields> = [
    'yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma',
  ];
  for (const key of EXPECTED_KEYS) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`Gemini response missing required field: ${key}`);
    }
  }
  return parsed as TreatmentDraftFields;
}
