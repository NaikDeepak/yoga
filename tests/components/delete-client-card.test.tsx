// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteClientCard } from '@/components/DeleteClientCard';
import { en } from '@/lib/i18n/en';

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));
const deletePatientAction = vi.fn().mockResolvedValue({ ok: false, error: 'nope' });
vi.mock('@/actions/patients', () => ({ deletePatientAction: (...a: unknown[]) => deletePatientAction(...a) }));

describe('DeleteClientCard', () => {
  it('enables delete only once the full name is typed (any case / spacing)', () => {
    render(<DeleteClientCard patientId="p1" fullName="Asha Kulkarni" />);
    const button = screen.getByRole('button', { name: en.deleteClient.button }) as HTMLButtonElement;
    const input = screen.getByLabelText(en.deleteClient.typeName.replace('{name}', 'Asha Kulkarni'));
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Asha' } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: ' asha  kulkarni ' } });
    expect(button.disabled).toBe(false);
  });

  it('sends the typed name to the server and shows its error', async () => {
    render(<DeleteClientCard patientId="p1" fullName="Asha Kulkarni" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Asha Kulkarni' } });
    fireEvent.click(screen.getByRole('button', { name: en.deleteClient.button }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(deletePatientAction).toHaveBeenCalledWith('p1', 'Asha Kulkarni');
  });
});
