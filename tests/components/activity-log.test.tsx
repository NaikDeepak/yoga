// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLog } from '@/components/ActivityLog';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';

const row = (o: object) => ({ id: 'a1', seq: 1, at: new Date('2026-10-07T06:30:00Z'), actorId: 'u1', actorEmail: 'dr.pawar@example.com',
  action: 'payment.add', patientId: null, clientCode: 'PYT-0042', summary: '₹2000 on 2026-10-07', ...o });

describe('ActivityLog', () => {
  it('shows when (IST), who, what (translated), client code and detail', () => {
    render(<ActivityLog rows={[row({})]} olderHref="/settings/activity?before=a1" t={en} />);
    expect(screen.getByText(/07 Oct 2026, 12:00/)).toBeTruthy(); // 06:30 UTC = 12:00 IST
    expect(screen.getByText('dr.pawar@example.com')).toBeTruthy();
    expect(screen.getByText('Payment recorded')).toBeTruthy();
    expect(screen.getByText('PYT-0042')).toBeTruthy();
    expect(screen.getByText('₹2000 on 2026-10-07')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show older/ }).getAttribute('href')).toBe('/settings/activity?before=a1');
  });

  it('every action has an English and a Marathi label', () => {
    expect(Object.keys(mr.settings.activity.actions).sort()).toEqual(Object.keys(en.settings.activity.actions).sort());
    render(<ActivityLog rows={[row({ action: 'client.delete', summary: null })]} olderHref={null} t={mr} />);
    expect(screen.getByText('साधक कायमचा हटवला')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('empty state', () => {
    render(<ActivityLog rows={[]} olderHref={null} t={en} />);
    expect(screen.getByText(en.settings.activity.empty)).toBeTruthy();
  });
});
