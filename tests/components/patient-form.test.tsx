// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatientForm } from '@/components/PatientForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('PatientForm live BMI', () => {
  it('shows BMI as weight and height are typed', () => {
    render(<PatientForm action={vi.fn()} submitLabel="Save" />);
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText(/Height/), { target: { value: '175' } });
    expect(screen.getByTestId('bmi')).toHaveTextContent('22.9');
    expect(screen.getByTestId('bmi')).toHaveTextContent('Normal');
  });
  it('shows placeholder when inputs incomplete', () => {
    render(<PatientForm action={vi.fn()} submitLabel="Save" />);
    expect(screen.getByTestId('bmi')).toHaveTextContent('—');
  });
});
