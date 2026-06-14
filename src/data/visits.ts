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

export async function getFollowUpsThisWeek(db: Db): Promise<FollowUp[]> {
  const today = getISTDateString(0);
  const end = getISTDateString(6);

  const latestPerPatient = db
    .selectDistinctOn([visits.patientId], {
      patientId: visits.patientId,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .orderBy(visits.patientId, desc(visits.visitDate), desc(visits.createdAt))
    .as('latest');

  const rows = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      nextVisitDate: latestPerPatient.nextVisitDate,
    })
    .from(latestPerPatient)
    .innerJoin(patients, eq(latestPerPatient.patientId, patients.id))
    .where(
      and(
        isNotNull(latestPerPatient.nextVisitDate),
        gte(latestPerPatient.nextVisitDate, today),
        lte(latestPerPatient.nextVisitDate, end),
      ),
    )
    .orderBy(latestPerPatient.nextVisitDate);

  return rows.filter((r): r is FollowUp => r.nextVisitDate !== null);
}
