'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { treatmentSchema, firstError } from '@/lib/validation';
import { upsertTreatmentPlan } from '@/data/treatment';
import type { ActionResult } from './patients';

export async function saveTreatmentPlanAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await upsertTreatmentPlan(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
