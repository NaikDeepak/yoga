import { asc, eq, inArray } from 'drizzle-orm';
import { patientProblems, type PatientProblem } from '@/db/schema';
import type { Db } from '@/db/types';
import type { ProblemInput } from '@/lib/validation';

export async function addProblem(db: Db, patientId: string, input: ProblemInput): Promise<PatientProblem> {
  const [row] = await db.insert(patientProblems).values({ ...input, patientId }).returning();
  return row;
}

export async function listProblems(db: Db, patientId: string): Promise<PatientProblem[]> {
  return db.select().from(patientProblems)
    .where(eq(patientProblems.patientId, patientId))
    .orderBy(asc(patientProblems.createdAt));
}

export async function removeProblem(db: Db, problemId: string): Promise<void> {
  await db.delete(patientProblems).where(eq(patientProblems.id, problemId));
}

export async function problemsForPatients(
  db: Db, patientIds: string[],
): Promise<Record<string, PatientProblem[]>> {
  if (patientIds.length === 0) return {};
  const rows = await db.select().from(patientProblems)
    .where(inArray(patientProblems.patientId, patientIds));
  const grouped: Record<string, PatientProblem[]> = {};
  for (const row of rows) (grouped[row.patientId] ??= []).push(row);
  return grouped;
}
