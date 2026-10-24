// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PainScaleInput } from '@/components/PainScaleInput';

function renderInForm(defaultValue?: number) {
  const { container } = render(
    <form><PainScaleInput name="painScale" ariaLabel="Pain" defaultValue={defaultValue} /></form>,
  );
  const form = container.querySelector('form')!;
  const hidden = () => (form.elements.namedItem('painScale') as HTMLInputElement).value;
  return { form, hidden };
}

describe('PainScaleInput', () => {
  it('submits the tapped value', async () => {
    const { hidden } = renderInForm();
    await userEvent.click(screen.getByRole('radio', { name: '5' }));
    expect(hidden()).toBe('5');
  });

  it('clears when its form resets (after a saved visit), so the next visit does not reuse the old pain', async () => {
    const { form, hidden } = renderInForm();
    await userEvent.click(screen.getByRole('radio', { name: '7' }));
    act(() => form.reset());
    expect(hidden()).toBe('');
    expect(screen.getByRole('radio', { name: '7' })).toHaveAttribute('aria-checked', 'false');
  });

  it('goes back to its starting value on reset, like a native input', async () => {
    const { form, hidden } = renderInForm(3);
    await userEvent.click(screen.getByRole('radio', { name: '8' }));
    act(() => form.reset());
    expect(hidden()).toBe('3');
  });
});
