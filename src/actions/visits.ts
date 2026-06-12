'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { visitSchema, firstError } from '@/lib/validation';
import { addVisit } from '@/data/visits';
import type { ActionResult } from './patients';

export async function addVisitAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = visitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await addVisit(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
