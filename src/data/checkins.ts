import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { exerciseCheckins } from '@/db/schema';
import type { Db } from '@/db/types';
import type { CheckinDay } from '@/lib/adherence';
import type { CheckinInput } from '@/lib/validation';

export type Checkin = CheckinDay & { pain: number | null };

/**
 * Today's check-in for the client behind a share link; saving again the same day overwrites it.
 * `today` is the clinic (IST) date computed by the caller on the server, never taken from the form.
 */
export async function saveCheckin(
  db: Db,
  link: { id: string; patientId: string },
  input: CheckinInput,
  today: string,
): Promise<void> {
  const values = { done: input.done, painScale: input.pain ?? null, shareLinkId: link.id };
  await db.insert(exerciseCheckins)
    .values({ ...values, patientId: link.patientId, checkinDate: today })
    .onConflictDoUpdate({
      target: [exerciseCheckins.patientId, exerciseCheckins.checkinDate],
      set: { ...values, updatedAt: new Date() },
    });
}

/** The client's check-ins from `from` to `to` (inclusive), oldest first. */
export async function listCheckins(db: Db, patientId: string, from: string, to: string): Promise<Checkin[]> {
  const rows = await db.select({
    date: exerciseCheckins.checkinDate,
    done: exerciseCheckins.done,
    pain: exerciseCheckins.painScale,
  }).from(exerciseCheckins)
    .where(and(eq(exerciseCheckins.patientId, patientId), gte(exerciseCheckins.checkinDate, from), lte(exerciseCheckins.checkinDate, to)))
    .orderBy(asc(exerciseCheckins.checkinDate));
  return rows as Checkin[]; // `done` is constrained to the three values by a CHECK
}
