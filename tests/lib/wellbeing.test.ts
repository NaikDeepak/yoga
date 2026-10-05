import { describe, it, expect } from 'vitest';
import { bmiBand, gaugeFraction, genderLabel, painBand, stressBand } from '@/lib/wellbeing';

describe('stressBand', () => {
  it('bands the 1–10 lifestyle stress level as low 1–4, moderate 5–7, high 8–10', () => {
    expect([1, 4, 5, 7, 8, 10].map(stressBand)).toEqual(['low', 'low', 'moderate', 'moderate', 'high', 'high']);
  });

  it('is null when not recorded or out of range', () => {
    expect([null, undefined, 0, 11, Number.NaN].map(stressBand)).toEqual([null, null, null, null, null]);
  });
});

describe('painBand', () => {
  it('bands the 0–10 visit pain scale as none 0, mild 1–3, moderate 4–6, severe 7–10', () => {
    expect([0, 1, 3, 4, 6, 7, 10].map(painBand)).toEqual(['none', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe']);
  });

  it('is null when not recorded or out of range', () => {
    expect([null, undefined, -1, 11].map(painBand)).toEqual([null, null, null, null]);
  });
});

describe('bmiBand', () => {
  it('uses the same cut-offs as bmiCategory', () => {
    expect([18.4, 18.5, 24.9, 25, 29.9, 30].map(bmiBand)).toEqual(['under', 'normal', 'normal', 'over', 'over', 'obese']);
  });

  it('is null without a BMI', () => {
    expect([null, undefined, 0, Number.NaN].map(bmiBand)).toEqual([null, null, null, null]);
  });
});

describe('gaugeFraction', () => {
  it('places a value between min and max, clamped to 0–1', () => {
    expect(gaugeFraction(5, 0, 10)).toBe(0.5);
    expect(gaugeFraction(-3, 0, 10)).toBe(0);
    expect(gaugeFraction(42, 15, 40)).toBe(1);
  });
});

describe('genderLabel', () => {
  const labels = { genderMale: 'Male', genderFemale: 'Female', genderOther: 'Other' };
  it('maps the stored value to its label, or null', () => {
    expect(genderLabel('female', labels)).toBe('Female');
    expect(genderLabel('other', labels)).toBe('Other');
    expect(genderLabel(null, labels)).toBeNull();
    expect(genderLabel('x', labels)).toBeNull();
  });
});
