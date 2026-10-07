// Browser side of the capture counters (backlog E4): tallies events during a capture session and sends
// them as one small batch (counts only) when the page is hidden, closed or the session is saved.
import type { CaptureCount, CaptureEvent } from '@/lib/capture-stats';
import type { CaptureShot } from '@/lib/capture-shots';

const ENDPOINT = '/api/telemetry/capture';

function beacon(body: string): void {
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
}

export interface CaptureCounter {
  count(event: CaptureEvent, shot?: CaptureShot | null): void;
  flush(): void;
}

export function createCaptureCounter(send: (body: string) => void = beacon): CaptureCounter {
  let tally = new Map<string, CaptureCount>();
  return {
    count(event, shot = null) {
      const key = `${event}|${shot ?? ''}`;
      const entry = tally.get(key);
      if (entry) entry.n += 1;
      else tally.set(key, { event, shot, n: 1 });
    },
    flush() {
      if (!tally.size) return;
      const body = JSON.stringify({ counts: [...tally.values()] });
      tally = new Map();
      try { send(body); } catch { /* telemetry must never break capture */ }
    },
  };
}
