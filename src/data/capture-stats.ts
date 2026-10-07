import { gte, sql } from 'drizzle-orm';
import { captureStats } from '@/db/schema';
import type { CaptureCount, CaptureStatRow } from '@/lib/capture-stats';
import type { Db } from '@/db/types';

/** Adds a batch of counts into that day's totals (one row per event and photo type). */
export async function recordCaptureCounts(db: Db, day: string, counts: CaptureCount[]): Promise<void> {
  if (!counts.length) return;
  await db.insert(captureStats)
    .values(counts.map((c) => ({ day, event: c.event, shot: c.shot ?? '', count: c.n })))
    .onConflictDoUpdate({
      target: [captureStats.day, captureStats.event, captureStats.shot],
      set: { count: sql`${captureStats.count} + excluded.count` },
    });
}

/** Totals per event and photo type from `sinceDay` (inclusive) on. */
export async function listCaptureStats(db: Db, sinceDay: string): Promise<CaptureStatRow[]> {
  const rows = await db.select({
    event: captureStats.event,
    shot: captureStats.shot,
    count: sql<number>`sum(${captureStats.count})::int`,
  }).from(captureStats)
    .where(gte(captureStats.day, sinceDay))
    .groupBy(captureStats.event, captureStats.shot);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}
