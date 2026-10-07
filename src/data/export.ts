import { eq, asc, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/types';
import { patients, patientProblems, visits, fees, feePayments, charges } from '@/db/schema';
import { getISTDateString } from '@/lib/dates';

export type ExportResult = {
  header: string[];
  rows: (string | number | null)[][];
};

export type ExportOptions = {
  branch?: string;
};

export async function exportClients(db: Db, opts?: ExportOptions): Promise<ExportResult> {
  const branch = opts?.branch;

  const patientRows = await db
    .select({
      id: patients.id,
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      mobile: patients.mobile,
      branch: patients.branch,
      age: patients.age,
      gender: patients.gender,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(branch ? eq(patients.branch, branch) : undefined)
    .orderBy(asc(patients.patientCode));

  const patientIds = patientRows.map((p) => p.id);
  const problemsByPatient: Record<string, string[]> = {};

  if (patientIds.length > 0) {
    const problemsList = await db
      .select({
        patientId: patientProblems.patientId,
        problem: patientProblems.problem,
      })
      .from(patientProblems)
      .where(inArray(patientProblems.patientId, patientIds))
      .orderBy(asc(patientProblems.createdAt));

    for (const p of problemsList) {
      (problemsByPatient[p.patientId] ??= []).push(p.problem);
    }
  }

  return {
    header: [
      'Client code',
      'Name',
      'Mobile',
      'Branch',
      'Age',
      'Gender',
      'Joined',
      'Problems',
    ],
    rows: patientRows.map((r) => [
      r.patientCode,
      r.fullName,
      r.mobile,
      r.branch ?? null,
      r.age ?? null,
      r.gender ?? null,
      getISTDateString(0, r.createdAt),
      (problemsByPatient[r.id] ?? []).join('; '),
    ]),
  };
}

export async function exportVisits(db: Db, opts?: ExportOptions): Promise<ExportResult> {
  const branch = opts?.branch;

  const rows = await db
    .select({
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      visitDate: visits.visitDate,
      painScale: visits.painScale,
      weightKg: visits.weightKg,
      nextVisitDate: visits.nextVisitDate,
    })
    .from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .orderBy(asc(visits.visitDate), asc(patients.patientCode));

  return {
    header: [
      'Client code',
      'Name',
      'Visit date',
      'Pain (0-10)',
      'Weight (kg)',
      'Next visit',
    ],
    rows: rows.map((r) => [
      r.patientCode,
      r.fullName,
      r.visitDate,
      r.painScale ?? null,
      r.weightKg ?? null,
      r.nextVisitDate ?? null,
    ]),
  };
}

export async function exportFees(db: Db, opts?: ExportOptions): Promise<ExportResult> {
  const branch = opts?.branch;
  const paidExpr = sql<string | null>`(select sum(${feePayments.amount}) from ${feePayments} where ${feePayments.patientId} = ${patients.id})`;
  const chargesExpr = sql<string | null>`(select sum(${charges.amount}) from ${charges} where ${charges.patientId} = ${patients.id})`;

  const rows = await db
    .select({
      patientCode: patients.patientCode,
      fullName: patients.fullName,
      courseFee: fees.courseFee,
      totalPaid: paidExpr,
      chargesTotal: chargesExpr,
    })
    .from(patients)
    .leftJoin(fees, eq(fees.patientId, patients.id))
    .where(branch ? eq(patients.branch, branch) : undefined)
    .orderBy(asc(patients.patientCode));

  return {
    header: [
      'Client code',
      'Name',
      'Course fee',
      'Total paid',
      'Balance',
      'Charges total',
    ],
    rows: rows.map((r) => {
      const hasFee = r.courseFee !== null && r.courseFee !== undefined;
      const courseFee = hasFee ? Number(r.courseFee) : null;
      const totalPaid = hasFee ? (r.totalPaid !== null ? Number(r.totalPaid) : 0) : null;
      const balance = hasFee && courseFee !== null && totalPaid !== null ? courseFee - totalPaid : null;
      const chargesTotal = r.chargesTotal !== null ? Number(r.chargesTotal) : 0;

      return [
        r.patientCode,
        r.fullName,
        courseFee,
        totalPaid,
        balance,
        chargesTotal,
      ];
    }),
  };
}
