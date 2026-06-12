'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { problemSchema, firstError } from '@/lib/validation';
import { addProblem, removeProblem } from '@/data/problems';
import type { ActionResult } from './patients';

export async function addProblemAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = problemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await addProblem(getDb(), patientId, parsed.data);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function removeProblemAction(patientId: string, problemId: string): Promise<ActionResult> {
  await requireUser();
  await removeProblem(getDb(), problemId);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
