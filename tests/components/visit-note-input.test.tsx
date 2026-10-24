// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitNoteInput } from '@/components/VisitNoteInput';

function renderInForm() {
  const { container } = render(
    <form><VisitNoteInput id="note" name="progressNote" chips={['Better']} /></form>,
  );
  return container.querySelector('form')!;
}

describe('VisitNoteInput', () => {
  it('a chip appends its text to the note', async () => {
    renderInForm();
    await userEvent.click(screen.getByRole('button', { name: '+ Better' }));
    expect(screen.getByRole('textbox')).toHaveValue('Better');
  });

  it('empties when its form resets (after a saved visit), so a second tap cannot save the same note twice', async () => {
    const form = renderInForm();
    await userEvent.type(screen.getByRole('textbox'), 'Lower back better');
    act(() => form.reset());
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
