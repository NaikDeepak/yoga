import { describe, it, expect } from 'vitest';
import { FEE_TYPES, feeTypeLabel } from '@/lib/feeTypes';
import { pawar } from '@/clinics/pawar';
import { chargeSchema } from '@/lib/validation';

describe('feeTypeLabel', () => {
  it('labels the new physio types', () => {
    expect(feeTypeLabel('session')).toBe('Physio session / फिजिओ सत्र');
    expect(feeTypeLabel('assessment')).toBe('Assessment / मूल्यांकन');
  });

  it('still labels yoga fee types (a physio clinic may hold old charges)', () => {
    expect(feeTypeLabel('monthly_yoga')).toBe('Monthly Yoga Fee / मासिक योग शुल्क');
  });

  it('returns an unknown key as it is', () => {
    expect(feeTypeLabel('legacy_fee')).toBe('legacy_fee');
  });
});

describe("Pawar's fee types", () => {
  it("are today's four, with today's amounts", () => {
    expect(pawar.practice.feeTypes).toEqual([
      { key: 'consultation', defaultAmount: 500 },
      { key: 'monthly_yoga', defaultAmount: 3000 },
      { key: 'package', defaultAmount: null },
      { key: 'other', defaultAmount: null },
    ]);
  });

  it('match the presets in FEE_TYPES', () => {
    for (const f of pawar.practice.feeTypes) {
      expect(FEE_TYPES.find((p) => p.key === f.key)?.defaultAmount).toBe(f.defaultAmount);
    }
  });
});

describe('chargeSchema', () => {
  it('accepts every known fee type', () => {
    for (const f of FEE_TYPES) {
      const r = chargeSchema.safeParse({ feeType: f.key, customLabel: 'x', amount: '100', chargeDate: '2026-10-01' });
      expect(r.success).toBe(true);
    }
  });
});
