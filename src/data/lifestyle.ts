import { eq, inArray } from 'drizzle-orm';
import { lifestyleAssessments, type LifestyleAssessment } from '@/db/schema';
import type { Db } from '@/db/types';
import type { LifestyleInput } from '@/lib/validation';

export async function getLifestyleAssessment(db: Db, patientId: string): Promise<LifestyleAssessment | undefined> {
  const [row] = await db.select().from(lifestyleAssessments).where(eq(lifestyleAssessments.patientId, patientId));
  return row;
}

// Returns filled-section count (0–5) per patient. Anchor field per section:
// 1=chiefComplaint, 2=currentMedications, 3=workType, 4=previousExercise, 5=primaryGoal
export async function assessmentCompletionForPatients(
  db: Db, patientIds: string[],
): Promise<Record<string, number>> {
  if (patientIds.length === 0) return {};
  const rows = await db
    .select({
      patientId: lifestyleAssessments.patientId,
      chiefComplaint: lifestyleAssessments.chiefComplaint,
      currentMedications: lifestyleAssessments.currentMedications,
      workType: lifestyleAssessments.workType,
      previousExercise: lifestyleAssessments.previousExercise,
      primaryGoal: lifestyleAssessments.primaryGoal,
    })
    .from(lifestyleAssessments)
    .where(inArray(lifestyleAssessments.patientId, patientIds));
  const result: Record<string, number> = {};
  for (const row of rows) {
    const filled = [row.chiefComplaint, row.currentMedications, row.workType, row.previousExercise, row.primaryGoal]
      .filter((v) => v != null).length;
    result[row.patientId] = filled;
  }
  return result;
}

export async function upsertLifestyleAssessment(db: Db, patientId: string, input: LifestyleInput): Promise<void> {
  await db.insert(lifestyleAssessments)
    .values({ ...input, patientId })
    .onConflictDoUpdate({
      target: lifestyleAssessments.patientId,
      set: { ...input, updatedAt: new Date() },
    });
}
