import { describe, it, expect } from 'vitest';
import { buildMonthGrid, shiftMonth, parseMonth, monthRange } from '@/lib/calendar';
import { getISTDateString } from '@/lib/dates';

describe('buildMonthGrid', () => {
  it('produces only full weeks of 7 days', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('places the 1st of the month at the weekday position JS Date reports', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const firstIndex = flat.findIndex((d) => d.date === '2026-06-01' && d.isCurrentMonth);
    const expectedWeekday = new Date(Date.UTC(2026, 5, 1)).getUTCDay();
    expect(firstIndex % 7).toBe(expectedWeekday);
  });

  it('includes the last day of the month exactly once, marked as current month', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const matches = flat.filter((d) => d.date === '2026-06-30' && d.isCurrentMonth);
    expect(matches).toHaveLength(1);
  });

  it('marks leading/trailing days from adjacent months as not current month', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const firstWeek = weeks[0];
    const leading = firstWeek.filter((d) => d.date < '2026-06-01');
    for (const day of leading) {
      expect(day.isCurrentMonth).toBe(false);
    }
  });

  it('marks exactly the cell matching todayISO as isToday', () => {
    const weeks = buildMonthGrid(2026, 6, '2026-06-18');
    const flat = weeks.flat();
    const todayCells = flat.filter((d) => d.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toBe('2026-06-18');
  });

  it('handles a leap-year February fully (29 days)', () => {
    const weeks = buildMonthGrid(2024, 2, '2024-02-01');
    const flat = weeks.flat();
    const feb29 = flat.find((d) => d.date === '2024-02-29');
    expect(feb29?.isCurrentMonth).toBe(true);
  });

  it('handles a non-leap-year February correctly (28 days, no Feb 29)', () => {
    const weeks = buildMonthGrid(2026, 2, '2026-02-01');
    const flat = weeks.flat();
    const feb29 = flat.find((d) => d.date === '2026-02-29' && d.isCurrentMonth);
    expect(feb29).toBeUndefined();
  });

  it('always tiles into 5 or 6 weeks, even for a 28-day month starting on Sunday', () => {
    // February 2026 has 28 days and starts on a Sunday, so (startWeekday + daysInMonth) / 7
    // divides evenly into 4 weeks. The grid must still be clamped to a minimum of 5 weeks.
    const weeks = buildMonthGrid(2026, 2, '2026-02-15');
    expect(weeks.length).toBeGreaterThanOrEqual(5);
    expect(weeks.length).toBeLessThanOrEqual(6);
  });
});

describe('shiftMonth', () => {
  it('moves forward within the same year', () => {
    expect(shiftMonth(2026, 6, 1)).toEqual({ year: 2026, month: 7 });
  });

  it('moves backward within the same year', () => {
    expect(shiftMonth(2026, 6, -1)).toEqual({ year: 2026, month: 5 });
  });

  it('rolls over to the next year from December', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back to the previous year from January', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('parseMonth', () => {
  it('parses a valid YYYY-MM string', () => {
    expect(parseMonth('2026-06')).toEqual({ year: 2026, month: 6 });
  });

  it('falls back to the current IST month when input does not match the regex', () => {
    const [year, month] = getISTDateString(0).split('-').map(Number);
    expect(parseMonth('not-a-date')).toEqual({ year, month });
  });

  it('falls back to the current IST month when input is undefined', () => {
    const [year, month] = getISTDateString(0).split('-').map(Number);
    expect(parseMonth(undefined)).toEqual({ year, month });
  });

  it('falls back to the current IST month when month is out of range (00)', () => {
    const [year, month] = getISTDateString(0).split('-').map(Number);
    expect(parseMonth('2026-00')).toEqual({ year, month });
  });

  it('falls back to the current IST month when month is out of range (13+)', () => {
    const [year, month] = getISTDateString(0).split('-').map(Number);
    expect(parseMonth('2026-13')).toEqual({ year, month });
  });
});

describe('monthRange', () => {
  it('returns the full range for a 30-day month', () => {
    expect(monthRange(2026, 6)).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });

  it('returns the full range for a 31-day month', () => {
    expect(monthRange(2026, 7)).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('returns 28 days for a non-leap-year February', () => {
    expect(monthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('returns 29 days for a leap-year February', () => {
    expect(monthRange(2024, 2)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });
});
