// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TrendChart } from '@/components/TrendChart';

describe('TrendChart', () => {
  it('draws one dot per reading, even two on the same day, without key warnings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<TrendChart label="Pain" color="red" min={0} max={10} series={[
      { date: '2026-09-01', value: 7 }, { date: '2026-09-01', value: 6 }, { date: '2026-09-10', value: 3 },
    ]} />);
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelector('polyline')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('renders nothing without readings', () => {
    const { container } = render(<TrendChart label="Pain" color="red" series={[{ date: '2026-09-01', value: null }]} />);
    expect(container.innerHTML).toBe('');
  });
});
