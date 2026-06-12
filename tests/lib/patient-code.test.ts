import { describe, it, expect } from 'vitest';
import { formatPatientCode, nextPatientCode } from '@/lib/patient-code';

describe('formatPatientCode', () => {
  it('zero-pads to 4 digits', () => {
    expect(formatPatientCode(1)).toBe('PYT-0001');
    expect(formatPatientCode(42)).toBe('PYT-0042');
  });
  it('grows beyond 4 digits without truncation', () => {
    expect(formatPatientCode(10001)).toBe('PYT-10001');
  });
});

describe('nextPatientCode', () => {
  it('starts at PYT-0001 when no patients exist', () => {
    expect(nextPatientCode(null)).toBe('PYT-0001');
  });
  it('increments the last code', () => {
    expect(nextPatientCode('PYT-0007')).toBe('PYT-0008');
    expect(nextPatientCode('PYT-0999')).toBe('PYT-1000');
  });
  it('falls back to PYT-0001 on malformed input', () => {
    expect(nextPatientCode('garbage')).toBe('PYT-0001');
  });
});
