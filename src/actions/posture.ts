'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { MAX_FILE_BYTES, validatePhoto } from '@/lib/files';
import { firstError, postureAssessmentSchema } from '@/lib/validation';
import { POSTURE_VIEWS } from '@/lib/posture';
import { getPatient } from '@/data/patients';
import { addPostureAssessment, deletePostureAssessment, type PostureViewInput } from '@/data/posture';
import type { ActionResult } from '@/actions/patients';

const INVALID_PARAMS: ActionResult = { ok: false, error: 'Invalid parameters / अवैध पॅरामीटर्स' };
const INVALID_DATA: ActionResult = { ok: false, error: 'Invalid posture data / चुकीची पोश्चर माहिती' };

/**
 * Form fields: `payload` (JSON: consent, assessedOn, note, views[] with landmarks) and
 * `photo_<view>` (JPEG/PNG) for each of front/right/back/left. Any metrics in the payload
 * are ignored — the data layer recomputes them from the landmarks.
 * On success redirects to the new assessment's report.
 */
export async function savePostureAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || !patientId) return INVALID_PARAMS;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('payload') ?? ''));
  } catch {
    return INVALID_DATA;
  }
  const parsed = postureAssessmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const photos = new Map<string, File>();
  for (const view of POSTURE_VIEWS) {
    const photo = formData.get(`photo_${view}`);
    if (!(photo instanceof File) || photo.size === 0) {
      return { ok: false, error: 'Photo for each view required / प्रत्येक बाजूचा फोटो आवश्यक' };
    }
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
    photos.set(view, photo);
  }
  // Vercel rejects request bodies over ~4.5 MB, so the four photos share the single-file cap.
  const total = [...photos.values()].reduce((sum, p) => sum + p.size, 0);
  if (total > MAX_FILE_BYTES) {
    return { ok: false, error: 'Photos too large, max 4 MB total / फोटो खूप मोठे, एकूण 4 MB पर्यंत' };
  }

  const db = getDb();
  const patient = await getPatient(db, patientId);
  if (!patient) return { ok: false, error: 'Client not found / साधक सापडला नाही' };

  const { assessedOn, note, views } = parsed.data;
  let assessmentId: string;
  try {
    const assessment = await addPostureAssessment(db, getStorage(), {
      patientId,
      assessedOn,
      heightCm: patient.heightCm ?? null,
      note: note ?? null,
      consentAt: new Date(),
      views: views.map((v): PostureViewInput => ({
        view: v.view,
        photo: photos.get(v.view)!,
        imageWidth: v.imageWidth,
        imageHeight: v.imageHeight,
        landmarks: v.landmarks,
        landmarksEdited: v.landmarksEdited,
      })),
    });
    assessmentId = assessment.id;
  } catch {
    return { ok: false, error: 'Could not save posture assessment / पोश्चर मूल्यांकन जतन करता आले नाही' };
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/posture/${assessmentId}`);
}

export async function deletePostureAssessmentAction(patientId: string, assessmentId: string): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || typeof assessmentId !== 'string' || !patientId || !assessmentId) {
    return INVALID_PARAMS;
  }
  try {
    await deletePostureAssessment(getDb(), getStorage(), patientId, assessmentId);
  } catch {
    return { ok: false, error: 'Could not delete posture assessment / पोश्चर मूल्यांकन हटवता आले नाही' };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
