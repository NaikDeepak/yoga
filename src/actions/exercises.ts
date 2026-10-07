'use server';

import { revalidatePath } from 'next/cache';
import { recordAudit } from '@/data/audit';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { prescribedExercisesListSchema } from '@/lib/validation';
import { addPrescribedExercises, savePrescribedExercises } from '@/data/exercises';
import { z } from 'zod';
import type { ActionResult } from './patients';
import { safeErrorMessage } from '@/lib/log';

export async function savePrescribedExercisesAction(
  patientId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const jsonStr = formData.get('prescribedExercisesJson') as string;
    if (!jsonStr) {
      // If no input, set to empty array
      await savePrescribedExercises(getDb(), patientId, []);
      await recordAudit(getDb(), { actor: user, action: 'exercises.save', patientId, summary: null });
      revalidatePath(`/patients/${patientId}`);
      return { ok: true };
    }

    const rawList = JSON.parse(jsonStr);
    const parsed = prescribedExercisesListSchema.safeParse(rawList);
    
    if (!parsed.success) {
      return { ok: false, error: 'Invalid exercise selection / अमान्य व्यायाम निवड' };
    }

    await savePrescribedExercises(getDb(), patientId, parsed.data);
    await recordAudit(getDb(), { actor: user, action: 'exercises.save', patientId, summary: null });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (error) {
    console.error('Failed to save prescribed exercises:', safeErrorMessage(error));
    return { ok: false, error: 'Failed to save / जतन करण्यात अयशस्वी' };
  }
}

const exerciseIdsSchema = z.object({
  patientId: z.string().uuid(),
  exerciseIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Adds exercises (e.g. from a posture report's focus areas or AI recommendations) to the patient's
 * prescription at library defaults, keeping everything already prescribed. The click is the
 * physio's confirmation; they can adjust or remove items on the Treatment tab.
 */
export async function addPrescribedExercisesAction(
  patientId: string,
  exerciseIds: string[],
): Promise<{ ok: true; added: number; alreadyPrescribed: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = exerciseIdsSchema.safeParse({ patientId, exerciseIds });
  if (!parsed.success) return { ok: false, error: 'Invalid exercise selection / अमान्य व्यायाम निवड' };
  try {
    const result = await addPrescribedExercises(getDb(), patientId, parsed.data.exerciseIds);
    await recordAudit(getDb(), { actor: user, action: 'exercises.save', patientId, summary: null });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true, ...result };
  } catch (error) {
    console.error('Failed to add prescribed exercises:', safeErrorMessage(error));
    return { ok: false, error: 'Failed to save / जतन करण्यात अयशस्वी' };
  }
}
