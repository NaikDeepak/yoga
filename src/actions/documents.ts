'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validateUpload } from '@/lib/files';
import { docTypeSchema } from '@/lib/validation';
import { addDocument, deleteDocument } from '@/data/documents';
import type { ActionResult } from './patients';

export async function uploadDocumentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const docType = docTypeSchema.safeParse(formData.get('docType'));
  if (!docType.success) return { ok: false, error: 'Choose a document type / प्रकार निवडा' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file / फाईल निवडा' };
  }
  const err = validateUpload(file);
  if (err) return { ok: false, error: err };

  await addDocument(getDb(), getStorage(), { patientId, docType: docType.data, file });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deleteDocumentAction(patientId: string, documentId: string): Promise<ActionResult> {
  await requireUser();
  await deleteDocument(getDb(), getStorage(), documentId);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
