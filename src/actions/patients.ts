'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validatePhoto } from '@/lib/files';
import { patientSchema, firstError } from '@/lib/validation';
import { createPatient, setPhotoPath, updatePatient } from '@/data/patients';

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
