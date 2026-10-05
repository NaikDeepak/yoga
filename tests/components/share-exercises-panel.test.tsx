// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareExercisesPanel } from '@/components/ShareExercisesPanel';
import { en } from '@/lib/i18n/en';

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));
vi.mock('@/actions/share-links', () => ({
  createExerciseShareLinkAction: vi.fn(),
  revokeExerciseShareLinkAction: vi.fn(),
}));

const active = { createdAt: '2026-10-05T04:30:00Z', expiresAt: '2027-01-03T04:30:00Z', viewCount: 0, lastViewedAt: null };

describe('ShareExercisesPanel', () => {
  it('offers sharing when there are exercises and no link', () => {
    render(<ShareExercisesPanel patientId="p1" active={null} hasExercises />);
    expect(screen.getByRole('button', { name: /Share with client/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Stop sharing/ })).toBeNull();
  });

  it('renders no empty button row without exercises or a link', () => {
    const { container } = render(<ShareExercisesPanel patientId="p1" active={null} hasExercises={false} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelector('.flex-wrap.gap-2')).toBeNull();
  });

  it('still lets the physio stop a live link after the prescription was emptied', () => {
    render(<ShareExercisesPanel patientId="p1" active={active} hasExercises={false} />);
    expect(screen.getByText(en.shareExercises.noExercises)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stop sharing/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share again/ })).toBeNull();
  });
});
