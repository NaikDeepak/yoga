// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabDropdown } from '@/components/TabDropdown';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const TABS = [
  ['overview', 'Overview / माहिती'],
  ['fees', 'Fees / शुल्क'],
] as const;

beforeEach(() => {
  push.mockClear();
  // jsdom doesn't implement these APIs that Radix Select relies on for pointer interactions.
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
});

describe('TabDropdown', () => {
  it('shows the active tab label in the trigger', () => {
    render(<TabDropdown patientId="p1" activeTab="fees" tabs={TABS} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Fees / शुल्क');
  });

  it('navigates to the selected tab URL', async () => {
    const user = userEvent.setup();
    render(<TabDropdown patientId="p1" activeTab="overview" tabs={TABS} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Fees / शुल्क' }));

    expect(push).toHaveBeenCalledWith('/patients/p1?tab=fees');
  });
});
