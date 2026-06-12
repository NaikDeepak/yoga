import { describe, it, expect } from 'vitest';
import { computeBmi, bmiCategory } from '@/lib/bmi';

describe('computeBmi', () => {
  it('computes weight/height² rounded to 1 decimal', () => {
    expect(computeBmi(70, 175)).toBe(22.9);
    expect(computeBmi(45, 160)).toBe(17.6);
  });
  it('returns null for missing or non-positive inputs', () => {
    expect(computeBmi(0, 175)).toBeNull();
    expect(computeBmi(70, 0)).toBeNull();
    expect(computeBmi(-5, 170)).toBeNull();
    expect(computeBmi(NaN, 170)).toBeNull();
    expect(computeBmi(undefined, 170)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it('maps WHO bands with bilingual labels', () => {
    expect(bmiCategory(17)).toBe('Underweight / कमी वजन');
    expect(bmiCategory(18.5)).toBe('Normal / सामान्य');
    expect(bmiCategory(24.9)).toBe('Normal / सामान्य');
    expect(bmiCategory(25)).toBe('Overweight / जास्त वजन');
    expect(bmiCategory(30)).toBe('Obese / स्थूलता');
  });
});
