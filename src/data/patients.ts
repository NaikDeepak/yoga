import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { patients, type Patient } from '@/db/schema';
import type { Db } from '@/db/types';
import { nextPatientCode } from '@/lib/patient-code';
import type { PatientInput } from '@/lib/validation';

export async function createPatient(db: Db, input: PatientInput): Promise<Patient> {
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ code: patients.patientCode })
      .from(patients)
      .orderBy(desc(patients.patientCode))
      .limit(1);
    const [row] = await tx
      .insert(patients)
      .values({ ...input, patientCode: nextPatientCode(last?.code ?? null) })
      .returning();
    return row;
  });
}

export async function getPatient(db: Db, id: string): Promise<Patient | undefined> {
  const [row] = await db.select().from(patients).where(eq(patients.id, id));
  return row;
}

export async function updatePatient(db: Db, id: string, input: PatientInput): Promise<void> {
  await db.update(patients).set(input).where(eq(patients.id, id));
}

export async function setPhotoPath(db: Db, id: string, photoPath: string): Promise<void> {
  await db.update(patients).set({ photoPath }).where(eq(patients.id, id));
}

export async function searchPatients(
  db: Db,
  q?: string,
  limit?: number,
  offset?: number,
): Promise<Patient[]> {
  const query = q?.trim();
  const where = query
    ? or(
        ilike(patients.fullName, `%${query}%`),
        ilike(patients.mobile, `%${query}%`),
        ilike(patients.patientCode, `%${query}%`),
      )
    : undefined;
  const base = db.select().from(patients).where(where).orderBy(desc(patients.createdAt));
  if (limit !== undefined) {
    return offset !== undefined ? base.limit(limit).offset(offset) : base.limit(limit);
  }
  return base;
}

export async function countPatients(db: Db, branch?: string, q?: string): Promise<number> {
  const query = q?.trim();
  const qWhere = query
    ? or(
        ilike(patients.fullName, `%${query}%`),
        ilike(patients.mobile, `%${query}%`),
        ilike(patients.patientCode, `%${query}%`),
      )
    : undefined;
  const branchWhere = branch ? eq(patients.branch, branch) : undefined;
  const where =
    qWhere && branchWhere ? and(qWhere, branchWhere) : (qWhere ?? branchWhere);
  const [{ value }] = await db.select({ value: count() }).from(patients).where(where);
  return value;
}
