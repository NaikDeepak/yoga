import { describe, it, expect, vi } from 'vitest';
import { createCaptureCounter } from '@/components/posture/capture-telemetry';

describe('createCaptureCounter', () => {
  it('batches repeated events and sends them once on flush', () => {
    const send = vi.fn();
    const counter = createCaptureCounter(send);
    counter.count('attemptAuto', 'front');
    counter.count('attemptAuto', 'front');
    counter.count('captured', 'front');
    counter.count('saveTapped');
    counter.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({ counts: [
      { event: 'attemptAuto', shot: 'front', n: 2 },
      { event: 'captured', shot: 'front', n: 1 },
      { event: 'saveTapped', shot: null, n: 1 },
    ] });
  });

  it('sends nothing when empty, and never resends a flushed batch', () => {
    const send = vi.fn();
    const counter = createCaptureCounter(send);
    counter.flush();
    counter.count('retake', 'back');
    counter.flush();
    counter.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never throws when sending fails (telemetry must not break capture)', () => {
    const counter = createCaptureCounter(() => { throw new Error('offline'); });
    counter.count('captured', 'front');
    expect(() => counter.flush()).not.toThrow();
  });
});
