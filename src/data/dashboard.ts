import { count, avg, desc, gte, eq } from 'drizzle-orm';
import { patients, patientProblems, visits } from '@/db/schema';
import type { Db } from '@/db/types';

export type DashboardStats = {
  totalPatients: number;
  visitsThisMonth: number;
  mostCommonProblem: string | null;
  avgPainThisMonth: number | null;
};

export async function getDashboardStats(db: Db): Promise<DashboardStats> {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [{ totalPatients }] = await db
    .select({ totalPatients: count() })
    .from(patients);

  const [{ visitsThisMonth }] = await db
    .select({ visitsThisMonth: count() })
    .from(visits)
    .where(gte(visits.visitDate, firstOfMonth));

  const cntExpr = count(patientProblems.id);
  const [top] = await db
    .select({ problem: patientProblems.problem, cnt: cntExpr })
    .from(patientProblems)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(1);

  const [{ avgPain }] = await db
    .select({ avgPain: avg(visits.painScale) })
    .from(visits)
    .where(gte(visits.visitDate, firstOfMonth));

  return {
    totalPatients,
    visitsThisMonth,
    mostCommonProblem: top?.problem ?? null,
    avgPainThisMonth: avgPain !== null && avgPain !== '' ? Math.round(Number(avgPain) * 10) / 10 : null,
  };
}

export async function getAilmentBreakdown(
  db: Db,
): Promise<{ problem: string; count: number }[]> {
  const cntExpr = count(patientProblems.id);
  return db
    .select({ problem: patientProblems.problem, count: cntExpr })
    .from(patientProblems)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(8);
}

export async function getRecentVisits(
  db: Db,
  limit = 10,
): Promise<{
  visitDate: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  weightKg: number | null;
  painScale: number | null;
}[]> {
  return db
    .select({
      visitDate: visits.visitDate,
      patientId: visits.patientId,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      weightKg: visits.weightKg,
      painScale: visits.painScale,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt))
    .limit(limit);
}
