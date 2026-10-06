// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuietClientsCard } from '@/components/QuietClientsCard';
import { en } from '@/lib/i18n/en';

vi.mock('@/actions/share-links', () => ({ recordNudgeAction: vi.fn() }));

const today = '2026-10-10';
const base = { patientCode: 'PYT-0001', mobile: '9876543210' };

describe('QuietClientsCard', () => {
  it('lists quiet clients with days, last check-in, nudge state and a WhatsApp nudge', () => {
    render(<QuietClientsCard today={today} total={3} t={en} clients={[
      { ...base, patientId: 'p1', fullName: 'Asha Kulkarni', quietDays: 5, lastCheckin: '2026-10-05', nudgedAt: new Date('2026-10-08T04:30:00Z') },
      { ...base, patientId: 'p2', fullName: 'Ravi Patil', quietDays: 3, lastCheckin: null, nudgedAt: new Date('2026-10-10T03:00:00Z') },
    ]} />);
    expect(screen.getByText('5 days quiet')).toBeTruthy();
    expect(screen.getByText(/last check-in 05 Oct/)).toBeTruthy();
    expect(screen.getByText(/never checked in/)).toBeTruthy();
    expect(screen.getByText('nudged 2 days ago')).toBeTruthy();
    expect(screen.getByText('nudged today')).toBeTruthy();
    const nudge = screen.getAllByRole('link', { name: /Nudge/ })[0].getAttribute('href')!;
    expect(nudge).toContain('phone=919876543210');
    expect(decodeURIComponent(nudge)).toContain('Namaskar Asha');
    expect(decodeURIComponent(nudge)).not.toContain('Kulkarni');
    expect(screen.getByText(/\+1 more/)).toBeTruthy();
  });

  it('says when nobody is quiet', () => {
    render(<QuietClientsCard today={today} total={0} t={en} clients={[]} />);
    expect(screen.getByText(en.dashboard.quiet.empty)).toBeTruthy();
  });
});
