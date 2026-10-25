// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
import { en } from '@/lib/i18n/en';

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));
vi.mock('@/actions/treatment', () => ({ saveTreatmentPlanAction: vi.fn() }));

describe('TreatmentPlanForm', () => {
  it('shows Generate with AI button when aiEnabled is true', () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} aiEnabled={true} />);
    expect(screen.getByRole('button', { name: new RegExp(en.treatmentPlan.generateBtn) })).toBeTruthy();
  });

  it('hides Generate with AI button when aiEnabled is false', () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} aiEnabled={false} />);
    expect(screen.queryByRole('button', { name: new RegExp(en.treatmentPlan.generateBtn) })).toBeNull();
  });
});
