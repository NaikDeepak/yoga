import { and, asc, eq, inArray } from 'drizzle-orm';
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

/** Removes one of this client's problems; false when there was no such problem for this client. */
export async function removeProblem(db: Db, patientId: string, problemId: string): Promise<boolean> {
  const rows = await db.delete(patientProblems)
    .where(and(eq(patientProblems.id, problemId), eq(patientProblems.patientId, patientId)))
    .returning({ id: patientProblems.id });
  return rows.length > 0;
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
