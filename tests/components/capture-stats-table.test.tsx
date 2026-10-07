// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureStatsTable } from '@/components/CaptureStatsTable';
import { summariseCaptureStats } from '@/lib/capture-stats';
import { en } from '@/lib/i18n/en';

describe('CaptureStatsTable', () => {
  it('says so when there is no data', () => {
    render(<CaptureStatsTable summary={summariseCaptureStats([])} t={en} />);
    expect(screen.getByText(en.settings.captureStats.empty)).toBeTruthy();
  });

  it('shows a row per photo type with its counts, and the session totals', () => {
    render(<CaptureStatsTable summary={summariseCaptureStats([
      { event: 'attemptAuto', shot: 'butterfly', count: 5 },
      { event: 'attemptManual', shot: 'butterfly', count: 2 },
      { event: 'hintFacing', shot: 'butterfly', count: 7 },
      { event: 'saveTapped', shot: '', count: 3 },
    ])} t={en} />);
    const row = screen.getByText(en.posture.flex.shots.butterfly).closest('tr')!;
    expect(row.textContent).toContain('5 / 2');
    expect(row.textContent).toContain('7');
    expect(screen.getByText(new RegExp(`${en.settings.captureStats.saveTapped}: 3`))).toBeTruthy();
  });
});
