import { desc, eq, or, isNotNull, and, gte, lte, gt } from 'drizzle-orm';
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

export async function getFollowUpsInRange(db: Db, start: string, end: string, branch?: string): Promise<FollowUp[]> {
  const cutoff = getISTDateString(0);

  // 1. Follow-ups based on the latest past/present visit's nextVisitDate
  const latestPerPatient = db
    .selectDistinctOn([visits.patientId], {
      patientId: visits.patientId,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .where(lte(visits.visitDate, cutoff))
    .orderBy(visits.patientId, desc(visits.visitDate), desc(visits.createdAt))
    .as('latest');

  const rows1 = await db
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
        gte(latestPerPatient.nextVisitDate, start),
        lte(latestPerPatient.nextVisitDate, end),
        branch ? eq(patients.branch, branch) : undefined,
      ),
    );

  // 2. Future visits explicitly logged with a future visitDate
  const rows2 = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      branch: patients.branch,
      nextVisitDate: visits.visitDate,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(
      and(
        gte(visits.visitDate, start),
        lte(visits.visitDate, end),
        gt(visits.visitDate, cutoff), // Only future visits
        branch ? eq(patients.branch, branch) : undefined,
      ),
    );

  const combined = [...rows1, ...rows2];
  
  // Deduplicate and normalize date objects to strings if needed
  const uniqueMap = new Map<string, FollowUp>();
  
  for (const r of combined) {
    if (!r.nextVisitDate) continue;
    // Normalize in case the driver returns a Date object
    const dateStr = r.nextVisitDate instanceof Date 
      ? r.nextVisitDate.toISOString().substring(0, 10) 
      : String(r.nextVisitDate).substring(0, 10);
      
    if (dateStr) {
      uniqueMap.set(`${r.patientId}-${dateStr}`, { ...r, nextVisitDate: dateStr });
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) => a.nextVisitDate.localeCompare(b.nextVisitDate));
}

export async function getFollowUpsThisWeek(db: Db, branch?: string): Promise<FollowUp[]> {
  return getFollowUpsInRange(db, getISTDateString(0), getISTDateString(7), branch);
}
