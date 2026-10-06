// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharePanel } from '@/components/SharePanel';
import { en } from '@/lib/i18n/en';

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));
vi.mock('@/actions/share-links', () => ({
  createExerciseShareLinkAction: vi.fn(),
  revokeExerciseShareLinkAction: vi.fn(),
  createPostureShareLinkAction: vi.fn(),
  revokePostureShareLinkAction: vi.fn(),
  createProgressShareLinkAction: vi.fn(),
  revokeProgressShareLinkAction: vi.fn(),
}));

const active = { createdAt: '2026-10-05T04:30:00Z', expiresAt: '2027-01-03T04:30:00Z', viewCount: 0, lastViewedAt: null };

describe('SharePanel (exercises)', () => {
  it('offers sharing when there are exercises and no link', () => {
    render(<SharePanel target={{ kind: 'exercises', patientId: 'p1', canShare: true }} active={null} />);
    expect(screen.getByRole('button', { name: /Share with client/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Stop sharing/ })).toBeNull();
  });

  it('renders no empty button row without exercises or a link', () => {
    const { container } = render(<SharePanel target={{ kind: 'exercises', patientId: 'p1', canShare: false }} active={null} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelector('.flex-wrap.gap-2')).toBeNull();
  });

  it('still lets the physio stop a live link after the prescription was emptied', () => {
    render(<SharePanel target={{ kind: 'exercises', patientId: 'p1', canShare: false }} active={active} />);
    expect(screen.getByText(en.shareExercises.noExercises)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stop sharing/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share again/ })).toBeNull();
  });
});

describe('SharePanel (posture)', () => {
  const target = { kind: 'posture' as const, patientId: 'p1', assessmentId: 'a1', otherReportOn: null };

  it('offers sharing with photos left out unless ticked', () => {
    render(<SharePanel target={target} active={null} />);
    expect(screen.getByText(en.sharePosture.hint)).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: en.sharePosture.includePhotos }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it('says whether the live link has photos, and when it shows another report', () => {
    render(<SharePanel target={{ ...target, otherReportOn: '2026-09-01' }} active={{ ...active, includePhotos: true }} />);
    expect(screen.getByText(/with photos/)).toBeTruthy();
    expect(screen.getByText(/shows the report from/)).toBeTruthy();
  });

  it('starts "Include photos" from the live link, so Share again keeps the photos choice', () => {
    render(<SharePanel target={target} active={{ ...active, includePhotos: true }} />);
    expect((screen.getByRole('checkbox', { name: en.sharePosture.includePhotos }) as HTMLInputElement).checked).toBe(true);
  });
});

describe('SharePanel (progress)', () => {
  const target = { kind: 'progress' as const, patientId: 'p1', canShare: true };

  it('offers sharing with weight shown unless "Hide weight" is ticked', () => {
    render(<SharePanel target={target} active={null} />);
    expect(screen.getByText(en.shareProgress.hint)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.shareProgress.share })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: en.shareProgress.hideWeight }) as HTMLInputElement).checked).toBe(false);
  });

  it('starts "Hide weight" from the live link and says so in the status', () => {
    render(<SharePanel target={target} active={{ ...active, hideWeight: true }} />);
    expect((screen.getByRole('checkbox', { name: en.shareProgress.hideWeight }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(new RegExp(en.shareProgress.weightHidden))).toBeTruthy();
  });

  it('explains there is nothing to show before any pain or weight is recorded', () => {
    render(<SharePanel target={{ ...target, canShare: false }} active={null} />);
    expect(screen.getByText(en.shareProgress.noData)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
