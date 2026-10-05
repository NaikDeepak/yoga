import { describe, it, expect } from 'vitest';
import { adherence, checkinDay, dayStrip, daysSince, painSeries, quietDays, shiftDate, type CheckinDay } from '@/lib/adherence';

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

describe('quietDays', () => {
  it('counts from the later of the last check-in and when the live link was shared', () => {
    expect(quietDays(today, '2026-10-02', '2026-09-01')).toBe(8);
    expect(quietDays(today, '2026-07-15', '2026-10-09')).toBe(1); // fresh re-share isn't flagged
  });
  it('counts from the share date for a client who never checked in', () => {
    expect(quietDays(today, null, '2026-09-20')).toBe(20);
  });
  it('is null without a live link', () => {
    expect(quietDays(today, '2026-10-01', null)).toBeNull();
  });
});

describe('checkinDay', () => {
  const at = (iso: string) => new Date(iso); // IST = UTC+5:30
  it('uses today when the form showed today', () => {
    expect(checkinDay('2026-10-05', at('2026-10-05T10:00:00Z'))).toBe('2026-10-05');
  });
  it("keeps the day the form showed when it's saved just after midnight", () => {
    expect(checkinDay('2026-10-05', at('2026-10-05T18:31:00Z'))).toBe('2026-10-05'); // 00:01 IST on the 6th
  });
  it('ignores an older day once the grace hour has passed, and any other day', () => {
    expect(checkinDay('2026-10-05', at('2026-10-05T19:45:00Z'))).toBe('2026-10-06'); // 01:15 IST
    expect(checkinDay('2026-10-01', at('2026-10-05T18:31:00Z'))).toBe('2026-10-06');
    expect(checkinDay('2026-10-07', at('2026-10-05T10:00:00Z'))).toBe('2026-10-05');
    expect(checkinDay(null, at('2026-10-05T10:00:00Z'))).toBe('2026-10-05');
  });
});

describe('painSeries', () => {
  it('has every day of the window, with gaps where no pain was logged', () => {
    const series = painSeries([{ date: '2026-10-08', pain: 6 }, { date: '2026-10-10', pain: null }], today, 3);
    expect(series).toEqual([
      { date: '2026-10-08', pain: 6 },
      { date: '2026-10-09', pain: null },
      { date: '2026-10-10', pain: null },
    ]);
  });
});
