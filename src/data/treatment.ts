import { eq } from 'drizzle-orm';
import { treatmentPlans, type TreatmentPlan } from '@/db/schema';
import type { Db } from '@/db/types';
import type { TreatmentInput } from '@/lib/validation';

export async function getTreatmentPlan(db: Db, patientId: string): Promise<TreatmentPlan | undefined> {
  const [row] = await db.select().from(treatmentPlans).where(eq(treatmentPlans.patientId, patientId));
  return row;
}

export async function upsertTreatmentPlan(db: Db, patientId: string, input: TreatmentInput): Promise<void> {
  await db.insert(treatmentPlans)
    .values({ ...input, patientId })
    .onConflictDoUpdate({
      target: treatmentPlans.patientId,
      set: { ...input, updatedAt: new Date() },
    });
}
