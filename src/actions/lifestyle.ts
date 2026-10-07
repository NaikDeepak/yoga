'use server';

import { revalidatePath } from 'next/cache';
import { recordAudit } from '@/data/audit';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { lifestyleSchema, firstError } from '@/lib/validation';
import { upsertLifestyleAssessment } from '@/data/lifestyle';
import type { ActionResult } from './patients';

export async function saveLifestyleAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = lifestyleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await upsertLifestyleAssessment(getDb(), patientId, parsed.data);
  await recordAudit(getDb(), { actor: user, action: 'lifestyle.save', patientId, summary: null });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
