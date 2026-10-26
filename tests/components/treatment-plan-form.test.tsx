// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
import { en } from '@/lib/i18n/en';
import { pawar } from '@/clinics/pawar';
import type { TreatmentPlan } from '@/db/schema';

const PAWAR = pawar.practice.treatmentSections;

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));
vi.mock('@/actions/treatment', () => ({ saveTreatmentPlanAction: vi.fn() }));

describe('TreatmentPlanForm', () => {
  it('shows Generate with AI button when aiEnabled is true', () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} sections={PAWAR} aiEnabled={true} />);
    expect(screen.getByRole('button', { name: new RegExp(en.treatmentPlan.generateBtn) })).toBeTruthy();
  });

  it('hides Generate with AI button when aiEnabled is false', () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} sections={PAWAR} aiEnabled={false} />);
    expect(screen.queryByRole('button', { name: new RegExp(en.treatmentPlan.generateBtn) })).toBeNull();
  });

  it("shows Pawar's seven sections in order", () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} sections={PAWAR} />);
    const labels = screen.getAllByRole('textbox').map((el) => el.getAttribute('name'));
    expect(labels).toEqual(['yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma']);
  });

  it('shows physio sections with their labels and no yoga fields', () => {
    render(<TreatmentPlanForm patientId="p1" initialPlan={undefined} sections={['exerciseTherapy', 'advice']} />);
    expect(screen.getByLabelText(en.treatmentPlan.exerciseTherapy)).toBeTruthy();
    expect(screen.getByLabelText(en.treatmentPlan.advice)).toBeTruthy();
    expect(screen.queryByLabelText(en.treatmentPlan.yoga)).toBeNull();
  });

  it('shows stored text under a section the clinic does not list', () => {
    const plan = { panchkarma: 'Basti course' } as TreatmentPlan;
    render(<TreatmentPlanForm patientId="p1" initialPlan={plan} sections={['exerciseTherapy', 'panchkarma']} />);
    expect((screen.getByLabelText(en.treatmentPlan.panchkarma) as HTMLTextAreaElement).value).toBe('Basti course');
  });
});
