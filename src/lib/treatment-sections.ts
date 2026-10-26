// Treatment-plan sections. A clinic profile (`practice.treatmentSections`) picks which ones it uses and in what order;
// the plan form, the printout and the AI draft all follow that list. Stored text is never hidden (see sectionsToShow).
import type { Translations } from '@/lib/i18n/en';

export const TREATMENT_SECTION_KEYS = [
  'yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma',
  'exerciseTherapy', 'manualTherapy', 'electrotherapy', 'homeProgramme', 'advice',
] as const;

export type TreatmentSectionKey = typeof TREATMENT_SECTION_KEYS[number];

export type TreatmentSection = {
  key: TreatmentSectionKey;
  labelKey: keyof Translations['treatmentPlan'];
  /** One sentence telling the AI what belongs in this section. */
  aiHint: string;
};

export const TREATMENT_SECTIONS: readonly TreatmentSection[] = [
  { key: 'yogaProgram', labelKey: 'yoga', aiHint: 'Recommended yoga postures, sequence, or frequency.' },
  { key: 'pranayam', labelKey: 'pranayam', aiHint: 'Recommended breathing exercises.' },
  { key: 'massage', labelKey: 'massage', aiHint: 'Specific areas to massage, oils, or therapy recommendations.' },
  { key: 'yogaTherapy', labelKey: 'yogaTherapy', aiHint: 'Therapeutic yoga techniques or modifications.' },
  { key: 'dietPlan', labelKey: 'diet', aiHint: 'Foods to eat, avoid, or timing instructions.' },
  { key: 'medicines', labelKey: 'medicines', aiHint: 'Ayurvedic medicines or supplements.' },
  { key: 'panchkarma', labelKey: 'panchkarma', aiHint: 'Panchkarma procedures recommended. Return empty string if not applicable.' },
  { key: 'exerciseTherapy', labelKey: 'exerciseTherapy', aiHint: 'Strengthening, mobility and stretching exercises with sets, repetitions and frequency.' },
  { key: 'manualTherapy', labelKey: 'manualTherapy', aiHint: 'Hands-on techniques such as mobilisation, soft-tissue work or taping, and the areas treated.' },
  { key: 'electrotherapy', labelKey: 'electrotherapy', aiHint: 'Electrical or thermal modalities such as TENS, ultrasound or hot packs, with duration and sites.' },
  { key: 'homeProgramme', labelKey: 'homeProgramme', aiHint: 'What the patient should do at home between sessions, with simple instructions.' },
  { key: 'advice', labelKey: 'advice', aiHint: 'Posture, activity, ergonomic and lifestyle advice for the patient.' },
];

const BY_KEY = new Map(TREATMENT_SECTIONS.map((s) => [s.key, s]));

export function treatmentSection(key: TreatmentSectionKey): TreatmentSection {
  return BY_KEY.get(key)!;
}

/** Sections shown as "modality" chips on the printout (the rest are plain rows only). */
const MODALITY_KEYS: ReadonlySet<TreatmentSectionKey> = new Set([
  'yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'panchkarma',
  'exerciseTherapy', 'manualTherapy', 'electrotherapy',
]);

export function isModality(key: TreatmentSectionKey): boolean {
  return MODALITY_KEYS.has(key);
}

/**
 * The clinic's sections in profile order, then any other section that already holds text,
 * so data saved under another profile never disappears from view.
 */
export function sectionsToShow(
  clinicSections: readonly TreatmentSectionKey[],
  plan: Partial<Record<TreatmentSectionKey, string | null>> | undefined,
): TreatmentSectionKey[] {
  const extra = TREATMENT_SECTION_KEYS.filter(
    (key) => !clinicSections.includes(key) && Boolean(plan?.[key]?.trim()),
  );
  return [...clinicSections, ...extra];
}
