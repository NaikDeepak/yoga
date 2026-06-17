// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { PatientHeader } from '@/components/PatientHeader';
import type { Patient } from '@/db/schema';

let observerCallback: (entries: { isIntersecting: boolean }[]) => void = () => {};

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    observerCallback = callback;
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

const patient = {
  id: 'p1',
  patientCode: 'PYT-0001',
  fullName: 'Asha Patil',
  mobile: '9999999999',
} as Patient;

describe('PatientHeader', () => {
  it('hides the compact bar initially', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the compact bar once the sentinel scrolls out of view', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'false');
  });

  it('hides the compact bar again once the sentinel scrolls back into view', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    act(() => {
      observerCallback([{ isIntersecting: false }]);
    });
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });
    expect(screen.getByTestId('compact-header')).toHaveAttribute('aria-hidden', 'true');
  });

  it('only renders the Receipt link when hasCourseFee is true', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={true} />);
    expect(screen.getByText('Receipt')).toBeInTheDocument();
  });

  it('does not render the Receipt link when hasCourseFee is false', () => {
    render(<PatientHeader patient={patient} photoUrl={null} hasCourseFee={false} />);
    expect(screen.queryByText('Receipt')).not.toBeInTheDocument();
  });
});
