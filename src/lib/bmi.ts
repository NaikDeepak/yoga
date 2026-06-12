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
  if (bmi < 18.5) return 'Underweight / कमी वजन';
  if (bmi < 25) return 'Normal / सामान्य';
  if (bmi < 30) return 'Overweight / जास्त वजन';
  return 'Obese / स्थूलता';
}
