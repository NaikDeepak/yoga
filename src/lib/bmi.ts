import { bilingual } from '@/lib/i18n/bilingual';

export function computeBmi(
  weightKg: number | undefined | null,
  heightCm: number | undefined | null,
): number | null {
  if (!weightKg || !heightCm || !Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return bilingual('bmi.underweight');
  if (bmi < 25) return bilingual('bmi.normal');
  if (bmi < 30) return bilingual('bmi.overweight');
  return bilingual('bmi.obese');
}
