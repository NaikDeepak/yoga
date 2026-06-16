// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlobalSearch } from '@/components/GlobalSearch';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.useFakeTimers();
  push.mockClear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

function mockFetchOnce(results: unknown[]) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    json: async () => ({ results }),
  });
}

describe('GlobalSearch', () => {
  it('debounces and renders dropdown results', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Search patient/), { target: { value: 'asha' } });

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('Asha Pawar')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/patients/search?q=asha',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('navigates to the patient on click', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    fireEvent.change(screen.getByPlaceholderText(/Search patient/), { target: { value: 'asha' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    screen.getByText('Asha Pawar');

    fireEvent.click(screen.getByText('Asha Pawar'));
    expect(push).toHaveBeenCalledWith('/patients/p1');
  });

  it('closes the dropdown on Escape without navigating', async () => {
    mockFetchOnce([{ id: 'p1', fullName: 'Asha Pawar', patientCode: 'PYT-0001', mobile: '9876543210' }]);
    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/Search patient/);
    fireEvent.change(input, { target: { value: 'asha' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    screen.getByText('Asha Pawar');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Asha Pawar')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('aborts the previous in-flight request when typing again before it resolves', async () => {
    const abortSpy = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', abortSpy);
        return new Promise(() => {}); // never resolves
      })
      .mockResolvedValueOnce({ json: async () => ({ results: [] }) });

    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText(/Search patient/);
    fireEvent.change(input, { target: { value: 'a' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.change(input, { target: { value: 'as' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(abortSpy).toHaveBeenCalled();
  });
});
