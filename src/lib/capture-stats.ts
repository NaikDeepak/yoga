import { z } from 'zod';
import { POSTURE_VIEWS } from '@/lib/posture';
import { FLEX_SHOTS } from '@/lib/flexibility';
import type { CaptureShot } from '@/lib/capture-shots';

// blockedModel covers both a pose model that failed to load and a photo that failed to encode.
// Capture counters (backlog E4): how often the camera flow blocks, nags or fails, per photo type.
// Counts only — no images, no client, no landmarks — so they can be kept as plain daily totals.

/** Per photo type: how the shot went. */
export const SHOT_EVENTS = [
  'attemptAuto', 'attemptManual', 'captured',
  'blockedNotLevel', 'blockedNoPerson', 'blockedModel',
  'hintInFrame', 'hintFacing', 'hintStill',
  'retake',
] as const;
/** Per capture session (no photo type). */
export const SESSION_EVENTS = ['saveTapped', 'modelLoadFailed'] as const;

export type ShotEvent = (typeof SHOT_EVENTS)[number];
export type SessionEvent = (typeof SESSION_EVENTS)[number];
export type CaptureEvent = ShotEvent | SessionEvent;
export type CaptureCount = { event: CaptureEvent; shot: CaptureShot | null; n: number };

const SHOTS = [...POSTURE_VIEWS, ...FLEX_SHOTS] as [CaptureShot, ...CaptureShot[]];

export const captureBatchSchema = z.object({
  counts: z.array(z.union([
    z.object({ event: z.enum(SHOT_EVENTS), shot: z.enum(SHOTS), n: z.number().int().min(1).max(1000) }).strict(),
    z.object({ event: z.enum(SESSION_EVENTS), shot: z.null(), n: z.number().int().min(1).max(1000) }).strict(),
  ])).min(1).max(100),
}).strict();

export type CaptureStatRow = { event: string; shot: string; count: number };
export type CaptureStatsSummary = {
  shots: { shot: CaptureShot; counts: Record<ShotEvent, number> }[];
  session: Record<SessionEvent, number>;
};

/** Daily-total rows → one line per photo type (capture order), plus the session totals. */
export function summariseCaptureStats(rows: CaptureStatRow[]): CaptureStatsSummary {
  const zero = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const session = zero(SESSION_EVENTS);
  const byShot = new Map<CaptureShot, Record<ShotEvent, number>>();
  for (const r of rows) {
    if ((SESSION_EVENTS as readonly string[]).includes(r.event)) {
      session[r.event as SessionEvent] += r.count;
    } else if ((SHOT_EVENTS as readonly string[]).includes(r.event) && (SHOTS as readonly string[]).includes(r.shot)) {
      const shot = r.shot as CaptureShot;
      const counts = byShot.get(shot) ?? zero(SHOT_EVENTS);
      counts[r.event as ShotEvent] += r.count;
      byShot.set(shot, counts);
    }
  }
  return { shots: SHOTS.filter((s) => byShot.has(s)).map((shot) => ({ shot, counts: byShot.get(shot)! })), session };
}
