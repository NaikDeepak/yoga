const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
if (match) {
  process.env.GEMINI_API_KEY = match[1].trim();
}

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

const context = {
  patient: {
    fullName: "Test Patient",
    age: 30,
    gender: "male",
    weightKg: 70,
    heightCm: 175
  },
  bmi: 22.9,
  ailments: ["Back Pain"],
  lifestyle: {
    chiefComplaint: "Lower back stiffness",
    duration: "2 months",
    aggravatingFactors: "sitting long hours",
    relievingFactors: "stretching",
    previousTreatment: "none",
    currentMedications: "none",
    doctorDiagnosis: "L4-L5 bulge",
    doctorRestrictions: "no bending forward",
    workType: "desk",
    dailySitting: "8+h",
    activityLevel: "sedentary",
    sleepHours: "7",
    sleepQuality: 6,
    stressLevel: 7,
    screenTime: "8h",
    previousExercise: "walking",
    fitnessLevel: "beginner",
    fearOfMovement: true,
    primaryGoal: "reduce pain",
    activityStruggle: "standing up",
    hasContraindications: true,
    contraindicationDetails: "avoid deep forward bends"
  },
  visits: {
    count: 1,
    latestPainScale: 7,
    firstWeightKg: 70,
    latestWeightKg: 70
  }
};

function buildPrompt(ctx) {
  const { patient, bmi, ailments, lifestyle, visits } = ctx;
  const lines = [];

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
    const vParts = [`${visits.count} visits`];
    if (visits.latestPainScale != null) vParts.push(`latest pain ${visits.latestPainScale}/10`);
    if (visits.firstWeightKg != null && visits.latestWeightKg != null) {
      vParts.push(`weight trend ${visits.firstWeightKg}→${visits.latestWeightKg} kg`);
    }
    lines.push(`Visit history: ${vParts.join(', ')}`);
  }

  return lines.join('\n');
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set');
    return;
  }
  
  console.log("Calling Gemini API with key starting with:", apiKey.slice(0, 10));
  
  try {
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
    });
    
    console.log("Response status:", res.status);
    const body = await res.text();
    console.log("Response body:", body);
  } catch (err) {
    console.error("Fetch failed with exception:", err);
  }
}

run();
