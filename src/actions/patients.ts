'use server';

import { revalidatePath } from 'next/cache';
import { recordAudit } from '@/data/audit';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validatePhoto } from '@/lib/files';
import { patientSchema, firstError, isId, INVALID_PARAMS } from '@/lib/validation';
import { z } from 'zod';
import { sameName } from '@/lib/names';
import { createPatient, deletePatientAndFiles, getPatient, replacePatientPhoto, updatePatient } from '@/data/patients';
import { safeErrorMessage } from '@/lib/log';

export type ActionResult = { ok: true } | { ok: false; error: string };

function getPhoto(formData: FormData): File | null {
  const photo = formData.get('photo');
  return photo instanceof File && photo.size > 0 ? photo : null;
}

export async function createPatientAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photo = getPhoto(formData);
  if (photo) {
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
  }

  const db = getDb();
  const patient = await createPatient(db, parsed.data);
  if (photo) {
    await replacePatientPhoto(db, getStorage(), patient.id, photo);
  }
  await recordAudit(getDb(), { actor: user, action: 'client.create', patientId: patient.id, summary: null });
  revalidatePath('/patients');
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(id)) return { ok: false, error: INVALID_PARAMS };
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photo = getPhoto(formData);
  if (photo) {
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
  }

  const db = getDb();
  if (!(await updatePatient(db, id, parsed.data))) {
    return { ok: false, error: 'This client no longer exists / हा साधक आता अस्तित्वात नाही' };
  }
  if (photo) {
    await replacePatientPhoto(db, getStorage(), id, photo);
  }
  await recordAudit(getDb(), { actor: user, action: 'client.update', patientId: id, summary: null });
  revalidatePath(`/patients/${id}`);
  revalidatePath(`/patients/${id}/print`);
  revalidatePath(`/patients/${id}/receipt`);
  return { ok: true };
}

/**
 * Permanently erases a client and every file of theirs. The physio types the client's full name to
 * confirm; it's checked again here. Goes to the client list afterwards.
 */
export async function deletePatientAction(id: string, confirmName: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  if (typeof confirmName !== 'string' || !sameName(confirmName, patient.fullName)) {
    return { ok: false, error: "Type the client's full name to confirm / खात्री करण्यासाठी साधकाचे पूर्ण नाव लिहा" };
  }
  try {
    await deletePatientAndFiles(db, getStorage(), id);
  } catch (error) {
    // Files first: on a storage failure the client is kept, so trying again finishes the job.
    console.error('Failed to delete client:', safeErrorMessage(error));
    return { ok: false, error: 'Could not delete the client. Nothing is lost; please try again / साधक हटवता आला नाही. कृपया पुन्हा प्रयत्न करा' };
  }
  await recordAudit(db, { actor: user, action: 'client.delete', clientCode: patient.patientCode });
  revalidatePath('/patients');
  revalidatePath('/dashboard');
  redirect('/patients');
}
