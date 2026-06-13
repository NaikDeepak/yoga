import { desc, eq, or, isNotNull, and } from 'drizzle-orm';
import { visits, type Visit } from '@/db/schema';
import type { Db } from '@/db/types';
import type { VisitInput } from '@/lib/validation';

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
