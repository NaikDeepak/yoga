import { describe, it, expect } from 'vitest';
import { firstName } from '@/lib/names';

describe('firstName', () => {
  it('is the first word of the full name, ignoring extra spaces', () => {
    expect(firstName('  Asha   Kulkarni ')).toBe('Asha');
    expect(firstName('Ravi')).toBe('Ravi');
  });
});
