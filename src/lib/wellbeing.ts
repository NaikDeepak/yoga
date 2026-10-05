// Bands for the wellbeing numbers shown on the Overview and the posture report (spec 2026-10-05).

export type StressBand = 'low' | 'moderate' | 'high';
export type PainBand = 'none' | 'mild' | 'moderate' | 'severe';
export type BmiBand = 'under' | 'normal' | 'over' | 'obese';

const inRange = (v: number | null | undefined, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Lifestyle-form stress level (1–10). */
export function stressBand(level: number | null | undefined): StressBand | null {
  if (!inRange(level, 1, 10)) return null;
  return level >= 8 ? 'high' : level >= 5 ? 'moderate' : 'low';
}

/** Visit pain scale (0–10). */
export function painBand(scale: number | null | undefined): PainBand | null {
  if (!inRange(scale, 0, 10)) return null;
  return scale === 0 ? 'none' : scale <= 3 ? 'mild' : scale <= 6 ? 'moderate' : 'severe';
}

/** Same cut-offs as `bmiCategory`, as keys for i18n and gauge colours. */
export function bmiBand(bmi: number | null | undefined): BmiBand | null {
  if (typeof bmi !== 'number' || !Number.isFinite(bmi) || bmi <= 0) return null;
  return bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : bmi < 30 ? 'over' : 'obese';
}

/** Where a value sits between min and max, clamped to 0–1 (gauge needle position). */
export function gaugeFraction(value: number, min: number, max: number): number {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Label for the stored gender value (male/female/other), or null. */
export function genderLabel(
  gender: string | null | undefined,
  labels: { genderMale: string; genderFemale: string; genderOther: string },
): string | null {
  return ({ male: labels.genderMale, female: labels.genderFemale, other: labels.genderOther } as Record<string, string>)[gender ?? ''] ?? null;
}
