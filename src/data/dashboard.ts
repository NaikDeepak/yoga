import { count, countDistinct, sum, desc, gte, lt, eq, and } from 'drizzle-orm';
import { patients, patientProblems, visits, feePayments } from '@/db/schema';
import type { Db } from '@/db/types';

export type DashboardStats = {
  totalPatients: number;
  visitsThisMonth: number;
  mostCommonProblem: string | null;
  revenueThisMonth: number;
};

export async function getDashboardStats(db: Db, branch?: string): Promise<DashboardStats> {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const firstOfNextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const cntExpr = countDistinct(patientProblems.patientId);
  const branchFilter = branch ? eq(patients.branch, branch) : undefined;

  const [
    [{ totalPatients }],
    [{ visitsThisMonth }],
    [top],
    [{ revenue }],
  ] = await Promise.all([
    db.select({ totalPatients: count() }).from(patients).where(branchFilter),
    db
      .select({ visitsThisMonth: count() })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .where(
        and(
          gte(visits.visitDate, firstOfMonth),
          lt(visits.visitDate, firstOfNextMonth),
          branchFilter,
        )
      ),
    db
      .select({ problem: patientProblems.problem, cnt: cntExpr })
      .from(patientProblems)
      .innerJoin(patients, eq(patientProblems.patientId, patients.id))
      .where(branchFilter)
      .groupBy(patientProblems.problem)
      .orderBy(desc(cntExpr))
      .limit(1),
    db
      .select({ revenue: sum(feePayments.amount) })
      .from(feePayments)
      .innerJoin(patients, eq(feePayments.patientId, patients.id))
      .where(
        and(
          gte(feePayments.paymentDate, firstOfMonth),
          lt(feePayments.paymentDate, firstOfNextMonth),
          branchFilter,
        )
      ),
  ]);

  return {
    totalPatients,
    visitsThisMonth,
    mostCommonProblem: top?.problem ?? null,
    revenueThisMonth: revenue !== null ? Number(revenue) : 0,
  };
}

export async function getAilmentBreakdown(
  db: Db,
  branch?: string,
): Promise<{ problem: string; count: number }[]> {
  const cntExpr = countDistinct(patientProblems.patientId);
  return db
    .select({ problem: patientProblems.problem, count: cntExpr })
    .from(patientProblems)
    .innerJoin(patients, eq(patientProblems.patientId, patients.id))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .groupBy(patientProblems.problem)
    .orderBy(desc(cntExpr))
    .limit(8);
}

export type RecentVisit = {
  visitId: string;
  visitDate: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  weightKg: number | null;
  painScale: number | null;
};

export async function getRecentVisits(
  db: Db,
  limit = 10,
  branch?: string,
): Promise<RecentVisit[]> {
  return db
    .select({
      visitId: visits.id,
      visitDate: visits.visitDate,
      patientId: visits.patientId,
      patientName: patients.fullName,
      patientCode: patients.patientCode,
      weightKg: visits.weightKg,
      painScale: visits.painScale,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .orderBy(desc(visits.visitDate), desc(visits.createdAt))
    .limit(limit);
}
