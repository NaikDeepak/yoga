// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuietClientsCard } from '@/components/QuietClientsCard';
import { recordNudgeAction } from '@/actions/share-links';
import { en } from '@/lib/i18n/en';

vi.mock('@/actions/share-links', () => ({ recordNudgeAction: vi.fn() }));

const today = '2026-10-10';
const client = (o: object) => ({ patientId: 'p1', fullName: 'Asha Kulkarni', mobile: '9876543210', quietDays: 5, lastCheckin: '2026-10-05', nudgedAt: null, ...o });

beforeEach(() => vi.mocked(recordNudgeAction).mockReset());

describe('QuietClientsCard', () => {
  it('lists every quiet client with days, last check-in and nudge state', () => {
    render(<QuietClientsCard today={today} t={en} clients={[
      client({ nudgedAt: new Date('2026-10-08T04:30:00Z') }),
      client({ patientId: 'p2', fullName: 'Ravi Patil', quietDays: 3, lastCheckin: null, nudgedAt: new Date('2026-10-09T04:30:00Z') }),
      client({ patientId: 'p3', fullName: 'Sita Rao', quietDays: 4, nudgedAt: new Date('2026-10-10T03:00:00Z') }),
    ]} />);
    expect(screen.getByText('Exercise link live, but no check-in for 3+ days')).toBeTruthy(); // from QUIET_AFTER_DAYS
    expect(screen.getByText('5 days quiet')).toBeTruthy();
    expect(screen.getAllByText(/last check-in 05 Oct/)).toHaveLength(2);
    expect(screen.getByText(/never checked in/)).toBeTruthy();
    expect(screen.getByText('nudged 2 days ago')).toBeTruthy();
    expect(screen.getByText('nudged yesterday')).toBeTruthy();
    expect(screen.getByText('nudged today')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Nudge/ })).toHaveLength(3);
  });

  it('says when nobody is quiet', () => {
    render(<QuietClientsCard today={today} t={en} clients={[]} />);
    expect(screen.getByText(en.dashboard.quiet.empty)).toBeTruthy();
  });
});

describe('Nudge button', () => {
  it('records the nudge first, then sends the tab to WhatsApp (first name only)', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as never);
    vi.mocked(recordNudgeAction).mockResolvedValue({ ok: true });
    render(<QuietClientsCard today={today} t={en} clients={[client({})]} />);
    fireEvent.click(screen.getByRole('button', { name: /Nudge/ }));
    expect(window.open).toHaveBeenCalledWith('', '_blank'); // opened inside the tap
    await waitFor(() => expect(tab.location.href).toContain('phone=919876543210'));
    expect(recordNudgeAction).toHaveBeenCalledWith('p1');
    expect(decodeURIComponent(tab.location.href)).toContain('Namaskar Asha');
    expect(decodeURIComponent(tab.location.href)).not.toContain('Kulkarni');
  });

  it('a failed save closes the tab and shows the error', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as never);
    vi.mocked(recordNudgeAction).mockResolvedValue({ ok: false, error: 'No live exercise link' });
    render(<QuietClientsCard today={today} t={en} clients={[client({})]} />);
    fireEvent.click(screen.getByRole('button', { name: /Nudge/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No live exercise link');
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });
});
