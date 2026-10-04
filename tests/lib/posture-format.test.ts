import { describe, it, expect } from 'vitest';
import { formatMetric, summarizeFindings } from '@/lib/posture-format';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';
import type { Metric } from '@/lib/posture';

const m = (over: Partial<Metric>): Metric => ({
  key: 'shoulderLevel', value: 3.2, unit: 'deg', side: 'right', direction: null, severity: 'mild', approx: false, ...over,
});

describe('formatMetric', () => {
  it('formats a level metric with the lower side', () => {
    expect(formatMetric(m({}), en.posture)).toEqual({
      label: 'Shoulder level', value: '3.2°', detail: 'Right lower', status: 'Mild', severity: 'mild', approx: false,
    });
  });

  it('formats shifts, limbs and directions', () => {
    expect(formatMetric(m({ key: 'trunkShift', value: 2.1, unit: 'deg', side: 'left', severity: 'mild' }), en.posture))
      .toMatchObject({ value: '2.1°', detail: 'Shifted to left' });
    expect(formatMetric(m({ key: 'pelvicShift', value: 2.1, unit: 'cm', side: null, direction: 'forward', severity: null }), en.posture))
      .toMatchObject({ value: '2.1 cm' });
    expect(formatMetric(m({ key: 'kneeAlignment', value: 8.1, side: 'left', direction: 'valgus', approx: true }), en.posture))
      .toMatchObject({ detail: 'Left · Valgus (inward)', approx: true });
    expect(formatMetric(m({ key: 'forwardHead', value: 24, side: null, severity: 'marked' }), en.posture))
      .toMatchObject({ value: '24°', detail: '', status: 'Marked' });
    expect(formatMetric(m({ key: 'kneeSagittal', value: 8, side: null, direction: 'backward' }), en.posture))
      .toMatchObject({ detail: 'Backward' });
    expect(formatMetric(m({ key: 'headForward', value: 1.5, unit: 'pct', side: null, direction: 'forward', severity: null }), en.posture))
      .toMatchObject({ value: '1.5% of height', detail: 'Forward', status: '—' });
  });

  it('shows not-measurable and zero values sensibly', () => {
    expect(formatMetric(m({ value: null, side: null, severity: null }), en.posture))
      .toMatchObject({ value: 'Not measurable', detail: '', status: '—' });
    expect(formatMetric(m({ value: 0, side: null, severity: 'normal' }), en.posture))
      .toMatchObject({ value: '0°', detail: '', status: 'Normal' });
  });

  it('uses the Marathi dictionary when given', () => {
    expect(formatMetric(m({}), mr.posture).label).toBe(mr.posture.metrics.shoulderLevel);
  });
});

describe('summarizeFindings', () => {
  it('counts mild/marked findings and lists marked ones first', () => {
    const views = [
      { view: 'front' as const, metrics: [m({}), m({ key: 'pelvicLevel', severity: 'marked', value: 5 })] },
      { view: 'left' as const, metrics: [m({ key: 'forwardHead', severity: 'normal', side: null })] },
    ];
    const s = summarizeFindings(views);
    expect(s).toMatchObject({ mild: 1, marked: 1 });
    expect(s.items.map((i) => `${i.view}:${i.metric.key}`)).toEqual(['front:pelvicLevel', 'front:shoulderLevel']);
  });
});
