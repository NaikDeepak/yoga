import { describe, it, expect } from 'vitest';
import { captureBatchSchema, summariseCaptureStats } from '@/lib/capture-stats';

describe('captureBatchSchema', () => {
  it('accepts known events for known shots, and session events without a shot', () => {
    const r = captureBatchSchema.safeParse({ counts: [
      { event: 'captured', shot: 'front', n: 2 },
      { event: 'hintStill', shot: 'butterfly', n: 1 },
      { event: 'saveTapped', shot: null, n: 1 },
    ] });
    expect(r.success).toBe(true);
  });

  it('rejects unknown events, unknown shots, extra fields and silly counts', () => {
    const bad = [
      { counts: [{ event: 'patientName', shot: 'front', n: 1 }] },
      { counts: [{ event: 'captured', shot: 'selfie', n: 1 }] },
      { counts: [{ event: 'captured', shot: 'front', n: 1, patientId: 'x' }] },
      { counts: [{ event: 'captured', shot: 'front', n: 0 }] },
      { counts: [{ event: 'captured', shot: 'front', n: 100_000 }] },
      { counts: [] },
    ];
    for (const b of bad) expect(captureBatchSchema.safeParse(b).success, JSON.stringify(b)).toBe(false);
  });
});

describe('summariseCaptureStats', () => {
  it('groups counts by shot (in capture order) and totals the session events', () => {
    const s = summariseCaptureStats([
      { event: 'captured', shot: 'right', count: 3 },
      { event: 'attemptAuto', shot: 'front', count: 4 },
      { event: 'captured', shot: 'front', count: 2 },
      { event: 'blockedNoPerson', shot: 'front', count: 1 },
      { event: 'saveTapped', shot: '', count: 2 },
      { event: 'modelLoadFailed', shot: '', count: 1 },
    ]);
    expect(s.shots.map((r) => r.shot)).toEqual(['front', 'right']);
    expect(s.shots[0].counts).toMatchObject({ attemptAuto: 4, captured: 2, blockedNoPerson: 1 });
    expect(s.shots[0].counts.retake).toBe(0);
    expect(s.session).toEqual({ saveTapped: 2, modelLoadFailed: 1 });
  });
});
