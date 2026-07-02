import { describe, it, expect } from 'vitest';
import { getISTDateString, formatDueDate } from '@/lib/dates';

describe('formatDueDate', () => {
  it('formats as zero-padded day + English month abbreviation', () => {
    expect(formatDueDate('2026-07-03')).toBe('03 Jul');
  });

  it('handles December and double-digit days', () => {
    expect(formatDueDate('2026-12-25')).toBe('25 Dec');
  });

  it('pads single-digit days', () => {
    expect(formatDueDate('2026-01-05')).toBe('05 Jan');
  });
});

describe('getISTDateString', () => {
  it('converts a UTC instant to the IST calendar date', () => {
    // 2026-07-02T20:00:00Z is 2026-07-03 01:30 IST
    expect(getISTDateString(0, Date.UTC(2026, 6, 2, 20, 0, 0))).toBe('2026-07-03');
  });

  it('applies the day offset', () => {
    expect(getISTDateString(1, Date.UTC(2026, 6, 2, 6, 0, 0))).toBe('2026-07-03');
  });
});
