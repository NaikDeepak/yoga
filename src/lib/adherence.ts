// Home-exercise adherence from daily check-ins (spec 2026-10-05-exercise-checkin). Dates are clinic
// (IST) calendar days as 'YYYY-MM-DD'.

export type CheckinDone = 'all' | 'some' | 'none';
export interface CheckinDay { date: string; done: CheckinDone }

const WEIGHT: Record<CheckinDone, number> = { all: 1, some: 0.5, none: 0 };
const DAY_MS = 86_400_000;

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Whole days from `date` to `today` (both 'YYYY-MM-DD'). */
export const daysSince = (date: string, today: string) => daysBetween(date, today);

/**
 * Days practised in the last `windowDays` (All = 1, Some = ½). For a new client the window starts at
 * `since` (their first exercise link), so 4 logged days out of 4 isn't shown as 4/30.
 */
export function adherence(checkins: CheckinDay[], today: string, windowDays: number, since: string | null): { score: number; days: number } {
  const days = since ? Math.max(1, Math.min(windowDays, daysBetween(since, today) + 1)) : windowDays;
  const from = shiftDate(today, -(days - 1));
  const score = checkins
    .filter((ch) => ch.date >= from && ch.date <= today)
    .reduce((sum, ch) => sum + WEIGHT[ch.done], 0);
  return { score, days };
}

/** One entry per day, oldest first; null where nothing was logged. */
export function dayStrip(checkins: CheckinDay[], today: string, days: number): { date: string; done: CheckinDone | null }[] {
  const byDate = new Map(checkins.map((ch) => [ch.date, ch.done]));
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(today, i - (days - 1));
    return { date, done: byDate.get(date) ?? null };
  });
}
