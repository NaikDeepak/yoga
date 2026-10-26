// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddChargeForm } from '@/components/AddChargeForm';
import { en } from '@/lib/i18n/en';
import { pawar } from '@/clinics/pawar';

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));

const action = vi.fn();
const options = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('AddChargeForm', () => {
  it("offers Pawar's four fee types and prefills the first amount", () => {
    render(<AddChargeForm action={action} today="2026-10-01" feeTypes={pawar.practice.feeTypes} />);
    expect(options()).toEqual([
      en.charges.feeTypeConsultation, en.charges.feeTypeMonthlyYoga, en.charges.feeTypePackage, en.charges.feeTypeOther,
    ]);
    expect((screen.getByLabelText(en.charges.amount) as HTMLInputElement).value).toBe('500');
  });

  it('offers only the clinic fee types and prefills their default amount', () => {
    render(
      <AddChargeForm
        action={action}
        today="2026-10-01"
        feeTypes={[{ key: 'session', defaultAmount: 800 }, { key: 'assessment', defaultAmount: null }]}
      />,
    );
    expect(options()).toEqual([en.charges.feeTypeSession, en.charges.feeTypeAssessment]);
    const amount = screen.getByLabelText(en.charges.amount) as HTMLInputElement;
    expect(amount.value).toBe('800');
    fireEvent.change(screen.getByLabelText(en.charges.feeType), { target: { value: 'assessment' } });
    expect(amount.value).toBe('');
  });
});
