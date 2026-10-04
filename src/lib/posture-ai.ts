// AI-written posture analysis: what we send (no name, no photos), how we ask, and how we validate
// the answer. The HTTP call lives in src/lib/gemini.ts. See docs/superpowers/specs/2026-10-04-posture-ai-analysis.md.
import { z } from 'zod';
import { en } from './i18n/en';
import { LIMB_METRICS, type MetricKey } from './posture';
import { REGIONS, type CombinedMetric, type DetectedPattern, type PostureScore } from './posture-insights';

export interface PostureAiContext {
  client: { age: number | null; gender: string | null; heightCm: number | null; weightKg: number | null; bmi: number | null };
  ailments: string[];
  lifestyle: {
    chiefComplaint: string | null;
    duration: string | null;
    workType: string | null;
    dailySitting: string | null;
    screenTime: string | null;
    activityLevel: string | null;
    primaryGoal: string | null;
    doctorRestrictions: string | null;
    contraindications: string | null;
  } | null;
  assessment: {
    assessedOn: string;
    score: PostureScore;
    patterns: DetectedPattern[];
    measures: CombinedMetric[];
    cameraLevel: 'sensor' | 'reference' | null;
  };
  library: { name: string; category: string }[];
}

const text = z.string().trim().min(1).max(2000);
const list = z.array(text).max(12);

export const postureAiReportSchema = z.object({
  summary: text,
  keyFindings: z.array(z.object({ title: z.string().trim().min(1).max(200), explanation: text })).min(1).max(10),
  lifestyleLinks: list,
  likelyCauses: list,
  risks: list,
  recommendations: z.object({ exercises: list, ergonomics: list, yogaAndBreathing: list }),
  followUp: text,
});

export type PostureAiReport = z.infer<typeof postureAiReportSchema>;

/** Gemini `responseSchema` mirroring postureAiReportSchema. */
export const POSTURE_AI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: '3–5 sentence plain-language overview a client can understand.' },
    keyFindings: {
      type: 'ARRAY',
      description: 'The most important findings, most significant first.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          explanation: { type: 'STRING', description: 'What it is, the measured value, and why it matters.' },
        },
        required: ['title', 'explanation'],
      },
    },
    lifestyleLinks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'How findings relate to the complaint, work and habits. Empty if no profile.' },
    likelyCauses: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Likely muscular / habitual causes.' },
    risks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'What it could lead to if not addressed.' },
    recommendations: {
      type: 'OBJECT',
      properties: {
        exercises: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Exact names from the exercise library only.' },
        ergonomics: { type: 'ARRAY', items: { type: 'STRING' } },
        yogaAndBreathing: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Asanas / pranayama suited to the findings.' },
      },
      required: ['exercises', 'ergonomics', 'yogaAndBreathing'],
    },
    followUp: { type: 'STRING', description: 'When to reassess and what to look for.' },
  },
  required: ['summary', 'keyFindings', 'lifestyleLinks', 'likelyCauses', 'risks', 'recommendations', 'followUp'],
} as const;

export const POSTURE_AI_SYSTEM_PROMPT = [
  'You are a clinical assistant for a yoga therapy and physiotherapy clinic in India, writing a posture analysis for the therapist to review.',
  'Base every statement only on the measurements and profile provided; never invent measurements.',
  'This is a screening aid, not a diagnosis: use cautious wording ("suggests", "may"), and say when a reading is approximate or LOW CONFIDENCE.',
  'Measurements come from 2D photos with a pose model; spinal curves are not measured.',
  'Respect any doctor restrictions and contraindications. Do not recommend medicines.',
  'For exercises, use only exact names from the exercise library provided.',
  'Write clear, simple English.',
].join(' ');

const LEVEL = new Set<MetricKey>(['headTilt', 'shoulderLevel', 'pelvicLevel']);
const SHIFT = new Set<MetricKey>(['trunkShift', 'headShift']);

function value(m: { value: number | null; unit: string }): string {
  if (m.value === null) return 'not measurable';
  if (m.unit === 'deg') return `${m.value}°`;
  if (m.unit === 'cm') return `${m.value} cm`;
  return `${m.value}% of height`;
}

function detail(m: CombinedMetric): string {
  if (m.value === 0 || m.value === null) return '';
  if (LEVEL.has(m.key)) return m.side ? `${m.side} lower` : '';
  if (SHIFT.has(m.key)) return m.side ? `shifted to ${m.side}` : '';
  if (m.key === 'armHang') return m.side ? `${m.side} arm further from the body` : '';
  if (LIMB_METRICS.has(m.key)) return [m.side && `${m.side} leg`, m.direction].filter(Boolean).join(' ');
  return m.direction ?? '';
}

function measureLine(m: CombinedMetric): string {
  const label = en.posture.metrics[m.key] + (LIMB_METRICS.has(m.key) && m.side && m.value === null ? ` (${m.side} leg)` : '');
  const parts = [[value(m), detail(m)].filter(Boolean).join(' '), m.severity ?? 'informational'];
  if (m.approx) parts.push('approximate');
  if (m.lowConfidence) {
    parts.push(`LOW CONFIDENCE (${m.sources.map((s) => `${s.view} ${value(s.metric)}`).join(', ')})`);
  }
  return `${label}: ${parts.join(' — ')}`;
}

/** The user message. Deliberately contains no name, contact details or photos. */
export function buildPostureAiPrompt(ctx: PostureAiContext): string {
  const { client, ailments, lifestyle, assessment, library } = ctx;
  const ins = en.posture.insights;
  const lines: string[] = [];

  const body = [
    client.age !== null && `${client.age}y`,
    client.gender,
    client.heightCm !== null && `${client.heightCm} cm`,
    client.weightKg !== null && `${client.weightKg} kg`,
    client.bmi !== null && `BMI ${client.bmi}`,
  ].filter(Boolean);
  lines.push(`Client: ${body.length ? body.join(', ') : 'no details recorded'}`);
  lines.push(`Ailments: ${ailments.length ? ailments.join(', ') : 'none recorded'}`);

  if (!lifestyle) {
    lines.push('Lifestyle assessment: not recorded');
  } else {
    if (lifestyle.chiefComplaint) lines.push(`Chief complaint: ${lifestyle.chiefComplaint}${lifestyle.duration ? ` (${lifestyle.duration})` : ''}`);
    const work = [
      lifestyle.workType && `${lifestyle.workType} work`,
      lifestyle.dailySitting && `sitting ${lifestyle.dailySitting}/day`,
      lifestyle.screenTime && `screen time ${lifestyle.screenTime}`,
      lifestyle.activityLevel && `activity: ${lifestyle.activityLevel}`,
    ].filter(Boolean);
    if (work.length) lines.push(`Lifestyle: ${work.join(', ')}`);
    if (lifestyle.primaryGoal) lines.push(`Goal: ${lifestyle.primaryGoal}`);
    if (lifestyle.doctorRestrictions) lines.push(`Doctor restrictions (must respect): ${lifestyle.doctorRestrictions}`);
    if (lifestyle.contraindications) lines.push(`Contraindications: ${lifestyle.contraindications}`);
  }

  lines.push('');
  lines.push(`Posture assessment on ${assessment.assessedOn}.`);
  const { score } = assessment;
  if (score.overall !== null && score.grade !== null) {
    const regions = REGIONS.map((r) => `${ins.regions[r]} ${score.regions[r].score ?? 'not measured'}`).join(', ');
    lines.push(`Posture score: ${score.overall}/100 (${ins.grades[score.grade]}). Regions: ${regions}`);
  }
  lines.push(`Camera level: ${assessment.cameraLevel === 'sensor' ? 'phone tilt sensor' : assessment.cameraLevel === 'reference' ? 'door-frame calibration (roll only)' : 'not recorded'}`);
  lines.push('Detected patterns:');
  if (assessment.patterns.length === 0) lines.push('- none');
  for (const p of assessment.patterns) lines.push(`- ${ins.patterns[p.key].title} (${p.severity})`);
  lines.push('Measurements (front/back and left/right views averaged):');
  for (const m of assessment.measures) lines.push(`- ${measureLine(m)}`);

  lines.push('');
  if (!library.length) {
    lines.push('Exercise library: none — give general advice only');
  } else {
    lines.push('Exercise library (use exact names):');
    for (const e of library) lines.push(`- ${e.name} (${e.category})`);
  }
  return lines.join('\n');
}

/** Validates the model's JSON and keeps only exercises that exist in our library (canonical names). */
export function parseAiReport(raw: unknown, libraryNames: string[]): PostureAiReport {
  const report = postureAiReportSchema.parse(raw);
  const canonical = new Map(libraryNames.map((n) => [n.trim().toLowerCase(), n]));
  const exercises = [...new Set(report.recommendations.exercises
    .map((e) => canonical.get(e.trim().toLowerCase()))
    .filter((e): e is string => !!e))];
  return { ...report, recommendations: { ...report.recommendations, exercises } };
}

/** Offline stand-in for local mock mode without GEMINI_API_KEY. */
export const MOCK_POSTURE_AI_REPORT: PostureAiReport = {
  summary: 'The assessment suggests a mild forward head posture with slightly uneven shoulders. These are common with long hours of desk work and are very responsive to regular corrective practice. Some readings are approximate, so the therapist should confirm them in person.',
  keyFindings: [
    { title: 'Forward head posture', explanation: 'The head sits roughly 12° ahead of the shoulders, which increases the load on the neck muscles.' },
    { title: 'Uneven shoulders', explanation: 'The right shoulder sits slightly lower (about 2°), suggesting tighter neck and shoulder muscles on one side.' },
  ],
  lifestyleLinks: ['Long daily sitting and screen time are consistent with the forward head position.'],
  likelyCauses: ['Weak deep neck flexors', 'Tight chest and upper trapezius muscles', 'Screen positioned below eye level'],
  risks: ['Recurring neck and upper-back pain', 'Tension headaches'],
  recommendations: {
    exercises: ['Neck Stretch'],
    ergonomics: ['Raise the screen to eye level', 'Take a 2-minute posture break every 45 minutes'],
    yogaAndBreathing: ['Bhujangasana', 'Marjaryasana–Bitilasana', 'Anulom Vilom 10 minutes daily'],
  },
  followUp: 'Reassess posture in 6 weeks to track change in forward head angle and shoulder level.',
};
