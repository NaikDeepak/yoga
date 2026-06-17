import { desc, eq, or, isNotNull, and, gte, lte } from 'drizzle-orm';
import { visits, patients, type Visit } from '@/db/schema';
import type { Db } from '@/db/types';
import type { VisitInput } from '@/lib/validation';
import { getISTDateString } from '@/lib/dates';

export type FollowUp = {
  patientId: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  branch: string | null;
  nextVisitDate: string;
};

export async function addVisit(db: Db, patientId: string, input: VisitInput): Promise<Visit> {
  const [row] = await db.insert(visits).values({ ...input, patientId }).returning();
  return row;
}

export async function listVisits(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt));
}

export async function listVisitsWithData(db: Db, patientId: string): Promise<Visit[]> {
  return db.select().from(visits)
    .where(and(
      eq(visits.patientId, patientId),
      or(isNotNull(visits.weightKg), isNotNull(visits.painScale)),
    ))
    .orderBy(visits.visitDate, visits.createdAt);
}

export { getISTDateString };

export async function getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]> {
  const today = getISTDateString(0);
  const end = getISTDateString(7);

  // Use the most recent *already-happened* visit per patient (visitDate <= today) to
  // read the follow-up date from. A new visit with no next-visit-date intentionally
  // clears any earlier one (the patient came back, the old plan is moot) — but a
  // future-dated visit row (not yet attended) must not be treated as "the latest
  // visit", or it would mask a real, still-valid follow-up from an actual visit.
  const latestPerPatient = db
    .selectDistinctOn([visits.patientId], {
      patientId: visits.patientId,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .where(lte(visits.visitDate, today))
    .orderBy(visits.patientId, desc(visits.visitDate), desc(visits.createdAt))
    .as('latest');

  const rows = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      branch: patients.branch,
      nextVisitDate: latestPerPatient.nextVisitDate,
    })
    .from(latestPerPatient)
    .innerJoin(patients, eq(latestPerPatient.patientId, patients.id))
    .where(
      and(
        isNotNull(latestPerPatient.nextVisitDate),
        gte(latestPerPatient.nextVisitDate, today),
        lte(latestPerPatient.nextVisitDate, end),
        branch ? eq(patients.branch, branch) : undefined,
      ),
    )
    .orderBy(latestPerPatient.nextVisitDate);

  return rows.filter((r): r is FollowUp => r.nextVisitDate !== null);
}
