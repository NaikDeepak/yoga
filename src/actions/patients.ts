'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validatePhoto } from '@/lib/files';
import { patientSchema, firstError } from '@/lib/validation';
import { z } from 'zod';
import { createPatient, deletePatientAndFiles, getPatient, setPhotoPath, updatePatient } from '@/data/patients';

export type ActionResult = { ok: true } | { ok: false; error: string };

function getPhoto(formData: FormData): File | null {
  const photo = formData.get('photo');
  return photo instanceof File && photo.size > 0 ? photo : null;
}

export async function createPatientAction(formData: FormData): Promise<ActionResult> {
  await requireUser();
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
    const path = `patients/${patient.id}/photo-${Date.now()}-${photo.name.replace(/[^\w.\-]+/g, '_')}`;
    await getStorage().upload(path, photo);
    await setPhotoPath(db, patient.id, path);
  }
  revalidatePath('/patients');
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(id: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photo = getPhoto(formData);
  if (photo) {
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
  }

  const db = getDb();
  await updatePatient(db, id, parsed.data);
  if (photo) {
    const path = `patients/${id}/photo-${Date.now()}-${photo.name.replace(/[^\w.\-]+/g, '_')}`;
    await getStorage().upload(path, photo);
    await setPhotoPath(db, id, path);
  }
  revalidatePath(`/patients/${id}`);
  revalidatePath(`/patients/${id}/print`);
  revalidatePath(`/patients/${id}/receipt`);
  return { ok: true };
}

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Permanently erases a client and every file of theirs. The physio types the client's full name to
 * confirm; it's checked again here. Goes to the client list afterwards.
 */
export async function deletePatientAction(id: string, confirmName: string): Promise<ActionResult> {
  await requireUser();
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
    console.error('Failed to delete client:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not delete the client / साधक हटवता आला नाही' };
  }
  revalidatePath('/patients');
  revalidatePath('/dashboard');
  redirect('/patients');
}
