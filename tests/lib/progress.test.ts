import { describe, it, expect } from 'vitest';
import { chartPoints, firstLatest } from '@/lib/progress';

describe('firstLatest', () => {
  it('takes the first and latest recorded values, skipping gaps', () => {
    expect(firstLatest([
      { date: '2026-09-01', value: null },
      { date: '2026-09-03', value: 7 },
      { date: '2026-09-10', value: 5 },
      { date: '2026-09-20', value: 3 },
      { date: '2026-09-25', value: null },
    ])).toEqual({ first: { date: '2026-09-03', value: 7 }, latest: { date: '2026-09-20', value: 3 }, change: -4 });
  });

  it('a single value is both first and latest', () => {
    expect(firstLatest([{ date: '2026-09-03', value: 82.5 }]))
      .toEqual({ first: { date: '2026-09-03', value: 82.5 }, latest: { date: '2026-09-03', value: 82.5 }, change: 0 });
  });

  it('rounds the change to one decimal (no float noise in weight)', () => {
    expect(firstLatest([{ date: '2026-09-01', value: 82.3 }, { date: '2026-09-02', value: 78.1 }])!.change).toBe(-4.2);
  });

  it('is null with no recorded values', () => {
    expect(firstLatest([])).toBeNull();
    expect(firstLatest([{ date: '2026-09-01', value: null }])).toBeNull();
  });
});

describe('chartPoints', () => {
  const box = { width: 100, height: 50 };

  it('spaces points by date and scales values to a fixed range (higher value = higher up)', () => {
    const c = chartPoints([
      { date: '2026-09-01', value: 10 },
      { date: '2026-09-02', value: 5 },
      { date: '2026-09-05', value: 0 },
    ], { ...box, min: 0, max: 10 });
    expect(c.points.map((p) => [p.x, p.y])).toEqual([[0, 0], [25, 25], [100, 50]]);
    expect(c.segments).toEqual(['0,0 25,25 100,50']);
  });

  it('splits the line at gaps', () => {
    const c = chartPoints([
      { date: '2026-09-01', value: 2 },
      { date: '2026-09-02', value: 4 },
      { date: '2026-09-03', value: null },
      { date: '2026-09-04', value: 6 },
      { date: '2026-09-05', value: 8 },
    ], { ...box, min: 0, max: 10 });
    expect(c.points).toHaveLength(4);
    expect(c.segments).toHaveLength(2);
  });

  it('drops a lone point from the lines (it still shows as a dot)', () => {
    const c = chartPoints([
      { date: '2026-09-01', value: 2 },
      { date: '2026-09-02', value: null },
      { date: '2026-09-03', value: 6 },
      { date: '2026-09-04', value: 8 },
    ], { ...box, min: 0, max: 10 });
    expect(c.points).toHaveLength(3);
    expect(c.segments).toEqual(['66.7,20 100,10']);
  });

  it('fits the data range when no range is given, and centres a flat series', () => {
    const c = chartPoints([{ date: '2026-09-01', value: 80 }, { date: '2026-09-11', value: 78 }], box);
    expect(c.points.map((p) => p.y)).toEqual([0, 50]);
    expect(c.min).toBe(78);
    expect(c.max).toBe(80);
    const flat = chartPoints([{ date: '2026-09-01', value: 80 }, { date: '2026-09-11', value: 80 }], box);
    expect(flat.points.map((p) => p.y)).toEqual([25, 25]);
  });

  it('centres a single day horizontally', () => {
    expect(chartPoints([{ date: '2026-09-01', value: 5 }], { ...box, min: 0, max: 10 }).points[0]).toMatchObject({ x: 50, y: 25 });
  });

  it('is empty with no values', () => {
    expect(chartPoints([{ date: '2026-09-01', value: null }], box)).toMatchObject({ points: [], segments: [] });
  });
});
