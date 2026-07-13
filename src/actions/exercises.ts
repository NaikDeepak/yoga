'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { prescribedExercisesListSchema } from '@/lib/validation';
import { savePrescribedExercises } from '@/data/exercises';
import type { ActionResult } from './patients';

export async function savePrescribedExercisesAction(
  patientId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireUser();

    const jsonStr = formData.get('prescribedExercisesJson') as string;
    if (!jsonStr) {
      // If no input, set to empty array
      await savePrescribedExercises(getDb(), patientId, []);
      revalidatePath(`/patients/${patientId}`);
      return { ok: true };
    }

    const rawList = JSON.parse(jsonStr);
    const parsed = prescribedExercisesListSchema.safeParse(rawList);
    
    if (!parsed.success) {
      return { ok: false, error: 'Invalid exercise selection / अमान्य व्यायाम निवड' };
    }

    await savePrescribedExercises(getDb(), patientId, parsed.data);
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (error) {
    console.error('Failed to save prescribed exercises:', error);
    return { ok: false, error: 'Failed to save / जतन करण्यात अयशस्वी' };
  }
}
