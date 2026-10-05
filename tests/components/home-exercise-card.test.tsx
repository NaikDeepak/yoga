// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeExerciseCard } from '@/components/HomeExerciseCard';
import type { Checkin } from '@/data/checkins';
import { en } from '@/lib/i18n/en';

const today = '2026-10-10';
const c = (date: string, done: Checkin['done'], pain: number | null = null): Checkin => ({ date, done, pain });

describe('HomeExerciseCard', () => {
  it('invites sharing when there are no check-ins', () => {
    render(<HomeExerciseCard checkins={[]} today={today} since={null} linkActive t={en} />);
    expect(screen.getByText(en.homeExercise.empty)).toBeTruthy();
  });

  it('scores a new client over the days since their first link', () => {
    const checkins = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => c(d, 'all'));
    render(<HomeExerciseCard checkins={checkins} today={today} since="2026-10-07" linkActive t={en} />);
    expect(screen.getAllByText('4/4 days')).toHaveLength(2);
    expect(screen.getAllByText(/since 7 Oct 2026|since 07 Oct 2026/)).toHaveLength(2);
    expect(screen.getByText(/Last check-in/)).toBeTruthy();
  });

  it('flags a client who stopped checking in while the link is live, not after it was stopped', () => {
    const checkins = [c('2026-10-05', 'some', 4)];
    const { rerender } = render(<HomeExerciseCard checkins={checkins} today={today} since="2026-09-01" linkActive t={en} />);
    expect(screen.getByText('No check-in for 5 days')).toBeTruthy();
    expect(screen.getByText('0.5/7 days')).toBeTruthy();
    rerender(<HomeExerciseCard checkins={checkins} today={today} since="2026-09-01" linkActive={false} t={en} />);
    expect(screen.queryByText(/No check-in for/)).toBeNull();
  });
});
