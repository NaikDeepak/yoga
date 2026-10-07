// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TotalScore } from '@/components/posture/TotalScore';
import { en } from '@/lib/i18n/en';

describe('TotalScore', () => {
  it('shows the total out of 400 and each of its four parts', () => {
    render(<TotalScore total={288} parts={{ posture: 82, shoulderExtension: 78, forwardFold: 48, butterfly: 80 }} t={en} />);
    expect(screen.getByText('288')).toBeTruthy();
    expect(screen.getByText('/400')).toBeTruthy();
    for (const [label, v] of [['Posture', '82'], [en.posture.flex.tests.shoulderExtension, '78'], [en.posture.flex.tests.forwardFold, '48'], [en.posture.flex.tests.butterfly, '80']]) {
      expect(screen.getByText(label).nextSibling?.textContent).toBe(v);
    }
  });
});
