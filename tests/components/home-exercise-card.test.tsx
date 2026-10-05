// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeExerciseCard } from '@/components/HomeExerciseCard';
import type { Checkin } from '@/data/checkins';
import { en } from '@/lib/i18n/en';

const today = '2026-10-10';
const c = (date: string, done: Checkin['done'], pain: number | null = null): Checkin => ({ date, done, pain });
type Props = Parameters<typeof HomeExerciseCard>[0];
const card = (p: Partial<Props>) =>
  render(<HomeExerciseCard checkins={[]} lastCheckin={null} today={today} since={null} liveLinkSince={null} t={en} {...p} />);

describe('HomeExerciseCard', () => {
  it('invites sharing when there is no link and no check-ins', () => {
    card({});
    expect(screen.getByText(en.homeExercise.empty)).toBeTruthy();
  });

  it('waits quietly for the first check-in right after sharing', () => {
    card({ liveLinkSince: '2026-10-09', since: '2026-10-09' });
    expect(screen.getByText(/Shared on .* waiting for the first check-in/)).toBeTruthy();
  });

  it('flags a client who never checked in on a link shared days ago', () => {
    card({ liveLinkSince: '2026-09-30', since: '2026-09-30' });
    expect(screen.getByText('No check-in for 10 days')).toBeTruthy();
  });

  it('scores a new client over the days since their first link', () => {
    const checkins = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => c(d, 'all'));
    card({ checkins, lastCheckin: '2026-10-10', since: '2026-10-07', liveLinkSince: '2026-10-07' });
    expect(screen.getAllByText('4/4 days')).toHaveLength(2);
    expect(screen.getAllByText(/since 0?7 Oct 2026/)).toHaveLength(2);
    expect(screen.getByText(/Last check-in/)).toBeTruthy();
  });

  it('flags a client who stopped checking in while the link is live, not after it was stopped', () => {
    const checkins = [c('2026-10-05', 'some', 4)];
    const { rerender } = card({ checkins, lastCheckin: '2026-10-05', since: '2026-09-01', liveLinkSince: '2026-09-01' });
    expect(screen.getByText('No check-in for 5 days')).toBeTruthy();
    expect(screen.getByText('0.5/7 days')).toBeTruthy();
    rerender(<HomeExerciseCard checkins={checkins} lastCheckin="2026-10-05" today={today} since="2026-09-01" liveLinkSince={null} t={en} />);
    expect(screen.queryByText(/No check-in for/)).toBeNull();
  });

  it("doesn't flag a fresh re-share for an old gap", () => {
    card({ lastCheckin: '2026-07-15', since: '2026-07-01', liveLinkSince: '2026-10-09' });
    expect(screen.queryByText(/No check-in for/)).toBeNull();
    expect(screen.getByText(/Last check-in/)).toBeTruthy();
  });

  it('still flags a client whose last check-in is older than 30 days', () => {
    card({ lastCheckin: '2026-08-01', since: '2026-07-01', liveLinkSince: '2026-07-01' });
    expect(screen.getByText('No check-in for 70 days')).toBeTruthy();
  });
});
