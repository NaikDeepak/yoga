import { describe, it, expect } from 'vitest';
import { adherence, dayStrip, daysSince, shiftDate, type CheckinDay } from '@/lib/adherence';

const today = '2026-10-10';
const c = (date: string, done: CheckinDay['done']): CheckinDay => ({ date, done });

describe('shiftDate', () => {
  it('moves a calendar date across month and year ends', () => {
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('adherence', () => {
  it('counts All as a day and Some as half, within the window', () => {
    const checkins = [c('2026-10-10', 'all'), c('2026-10-09', 'some'), c('2026-10-08', 'none'), c('2026-10-01', 'all')];
    expect(adherence(checkins, today, 7, null)).toEqual({ score: 1.5, days: 7 });
    expect(adherence(checkins, today, 30, null)).toEqual({ score: 2.5, days: 30 });
  });

  it('includes the first day of the window and excludes the day before', () => {
    expect(adherence([c('2026-10-04', 'all')], today, 7, null).score).toBe(1);
    expect(adherence([c('2026-10-03', 'all')], today, 7, null).score).toBe(0);
  });

  it('shortens the window for a client whose first link is recent', () => {
    const checkins = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => c(d, 'all'));
    expect(adherence(checkins, today, 30, '2026-10-07')).toEqual({ score: 4, days: 4 });
    expect(adherence(checkins, today, 7, '2026-01-01')).toEqual({ score: 4, days: 7 });
  });

  it('is zero with nothing logged', () => {
    expect(adherence([], today, 7, null)).toEqual({ score: 0, days: 7 });
  });
});

describe('dayStrip', () => {
  it('lists each day oldest first, with gaps as null', () => {
    expect(dayStrip([c('2026-10-10', 'all'), c('2026-10-08', 'some')], today, 3)).toEqual([
      { date: '2026-10-08', done: 'some' },
      { date: '2026-10-09', done: null },
      { date: '2026-10-10', done: 'all' },
    ]);
  });
});

describe('daysSince', () => {
  it('counts whole calendar days', () => {
    expect(daysSince('2026-10-06', today)).toBe(4);
    expect(daysSince(today, today)).toBe(0);
    expect(daysSince('2026-08-01', today)).toBe(70);
  });
});
