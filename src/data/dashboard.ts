import { count, countDistinct, sum, desc, gte, lt, eq, and, isNull, or, sql, isNotNull } from 'drizzle-orm';
import { patients, patientProblems, visits, feePayments, lifestyleAssessments, treatmentPlans } from '@/db/schema';
import { getISTDateString } from '@/lib/dates';
import type { Db } from '@/db/types';

export type DashboardStats = {
  totalPatients: number;
  visitsThisMonth: number;
  mostCommonProblem: string | null;
  revenueThisMonth: number;
};

export async function getDashboardStats(db: Db, branch?: string): Promise<DashboardStats> {
  const [istYear, istMonth] = getISTDateString(0).split('-').map(Number);
  const firstOfMonth = `${istYear}-${String(istMonth).padStart(2, '0')}-01`;
  const nextMonthYear = istMonth === 12 ? istYear + 1 : istYear;
  const nextMonth = istMonth === 12 ? 1 : istMonth + 1;
  const firstOfNextMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

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

export type PendingAssessment = {
  patientId: string;
  patientCode: string;
  fullName: string;
  missingLifestyle: boolean;
  missingTreatment: boolean;
};

export async function getPendingAssessments(
  db: Db,
  limit = 5,
  branch?: string,
): Promise<PendingAssessment[]> {
  const branchFilter = branch ? eq(patients.branch, branch) : undefined;
  const rows = await db
    .select({
      patientId: patients.id,
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      lifestyleId: lifestyleAssessments.id,
      treatmentId: treatmentPlans.id,
    })
    .from(patients)
    .leftJoin(lifestyleAssessments, eq(lifestyleAssessments.patientId, patients.id))
    .leftJoin(treatmentPlans, eq(treatmentPlans.patientId, patients.id))
    .where(
      and(
        or(isNull(lifestyleAssessments.id), isNull(treatmentPlans.id)),
        branchFilter,
      )
    )
    .orderBy(desc(patients.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    patientId: r.patientId,
    patientCode: r.patientCode,
    fullName: r.fullName,
    missingLifestyle: r.lifestyleId === null,
    missingTreatment: r.treatmentId === null,
  }));
}

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

export type BirthdayPatient = {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  birthDate: string | null;
  branch: string | null;
  isTomorrow: boolean;
};

export async function getBirthdaysToday(
  db: Db,
  branch?: string,
): Promise<BirthdayPatient[]> {
  const todayIST = getISTDateString(0);
  const tomorrowIST = getISTDateString(1);
  const [, tMM, tDD] = todayIST.split('-');
  const [, tomMM, tomDD] = tomorrowIST.split('-');
  const branchFilter = branch ? eq(patients.branch, branch) : undefined;

  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      patientCode: patients.patientCode,
      mobile: patients.mobile,
      birthDate: patients.birthDate,
      branch: patients.branch,
    })
    .from(patients)
    .where(
      and(
        isNotNull(patients.birthDate),
        or(
          sql`to_char(${patients.birthDate}, 'MM-DD') = ${`${tMM}-${tDD}`}`,
          sql`to_char(${patients.birthDate}, 'MM-DD') = ${`${tomMM}-${tomDD}`}`,
        ),
        branchFilter,
      )
    );

  const todayMD = `${tMM}-${tDD}`;
  return rows.map((r) => {
    const bMD = r.birthDate ? String(r.birthDate).substring(5, 10) : '';
    return {
      ...r,
      isTomorrow: bMD !== todayMD,
    };
  });
}
