// Clients who have stopped logging their home exercises (spec 2026-10-06-quiet-client-alerts), for the
// dashboard card. Same rule and threshold as the Treatment tab's Home exercise card.
import { and, eq, gt, isNull, max } from 'drizzle-orm';
import { exerciseCheckins, patients, shareLinks } from '@/db/schema';
import type { Db } from '@/db/types';
import { getISTDateString } from '@/lib/dates';
import { QUIET_AFTER_DAYS, quietDays } from '@/lib/adherence';

export interface QuietClient {
  patientId: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  quietDays: number;
  /** Latest check-in ever, or null if they never checked in. */
  lastCheckin: string | null;
  /** When "WhatsApp nudge" was last tapped for their current link. */
  nudgedAt: Date | null;
}

/**
 * Clients with a live exercise link and no check-in for QUIET_AFTER_DAYS+ days (counted from the later
 * of their last check-in and the day the current link was shared), quietest first. `today` is the IST date.
 */
export async function listQuietClients(
  db: Db,
  today: string,
  now: Date,
  { branch, limit = 8 }: { branch?: string; limit?: number } = {},
): Promise<{ clients: QuietClient[]; total: number }> {
  const lastCheckins = db
    .select({ patientId: exerciseCheckins.patientId, last: max(exerciseCheckins.checkinDate).as('last') })
    .from(exerciseCheckins)
    .groupBy(exerciseCheckins.patientId)
    .as('last_checkins');

  const rows = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      sharedAt: shareLinks.createdAt,
      nudgedAt: shareLinks.nudgedAt,
      lastCheckin: lastCheckins.last,
    })
    .from(shareLinks)
    .innerJoin(patients, eq(patients.id, shareLinks.patientId))
    .leftJoin(lastCheckins, eq(lastCheckins.patientId, patients.id))
    .where(and(
      eq(shareLinks.kind, 'exercises'),
      isNull(shareLinks.revokedAt),
      gt(shareLinks.expiresAt, now),
      branch ? eq(patients.branch, branch) : undefined,
    ));

  const quiet = rows
    .map((r) => ({
      patientId: r.patientId,
      fullName: r.fullName,
      patientCode: r.patientCode,
      mobile: r.mobile,
      quietDays: quietDays(today, r.lastCheckin, getISTDateString(0, r.sharedAt)) ?? 0,
      lastCheckin: r.lastCheckin,
      nudgedAt: r.nudgedAt,
    }))
    .filter((c) => c.quietDays >= QUIET_AFTER_DAYS)
    .sort((a, b) => b.quietDays - a.quietDays || a.fullName.localeCompare(b.fullName));
  return { clients: quiet.slice(0, limit), total: quiet.length };
}
