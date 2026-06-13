import { eq } from 'drizzle-orm';
import { lifestyleAssessments, type LifestyleAssessment } from '@/db/schema';
import type { Db } from '@/db/types';
import type { LifestyleInput } from '@/lib/validation';

export async function getLifestyleAssessment(db: Db, patientId: string): Promise<LifestyleAssessment | undefined> {
  const [row] = await db.select().from(lifestyleAssessments).where(eq(lifestyleAssessments.patientId, patientId));
  return row;
}

export async function upsertLifestyleAssessment(db: Db, patientId: string, input: LifestyleInput): Promise<void> {
  await db.insert(lifestyleAssessments)
    .values({ ...input, patientId })
    .onConflictDoUpdate({
      target: lifestyleAssessments.patientId,
      set: { ...input, updatedAt: new Date() },
    });
}
