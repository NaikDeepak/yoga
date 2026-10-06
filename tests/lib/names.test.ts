import { describe, it, expect } from 'vitest';
import { firstName, sameName } from '@/lib/names';

describe('firstName', () => {
  it('is the first word of the full name, ignoring extra spaces', () => {
    expect(firstName('  Asha   Kulkarni ')).toBe('Asha');
    expect(firstName('Ravi')).toBe('Ravi');
  });
});

describe('sameName', () => {
  it('ignores case and extra spaces', () => {
    expect(sameName('  asha   KULKARNI ', 'Asha Kulkarni')).toBe(true);
    expect(sameName('Asha', 'Asha Kulkarni')).toBe(false);
    expect(sameName('', '')).toBe(false); // an empty confirmation never matches
  });
});
