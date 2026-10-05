'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { shareUrl } from '@/lib/share-token';
import { exerciseShareMessage, postureShareMessage, waMeUrl } from '@/lib/whatsapp';
import { getPatient } from '@/data/patients';
import { getPrescribedExercises } from '@/data/exercises';
import { createShareLink, revokeShareLinks } from '@/data/share-links';
import { getPostureAssessment } from '@/data/posture';

const patientIdSchema = z.string().uuid();

/** Absolute link for a token: APP_URL in production, else the address the physio is using. */
async function publicUrl(token: string): Promise<string> {
  const h = await headers();
  return shareUrl(token, {
    appUrl: process.env.APP_URL,
    host: h.get('x-forwarded-host') ?? h.get('host'),
    proto: h.get('x-forwarded-proto'),
  });
}

/**
 * New home-exercise link for the client (the previous one stops working). The token leaves the
 * server only in this response — it's never stored or logged.
 */
export async function createExerciseShareLinkAction(
  patientId: string,
): Promise<{ ok: true; url: string; whatsappUrl: string; expiresAt: string } | { ok: false; error: string }> {
  await requireUser();
  if (!patientIdSchema.safeParse(patientId).success) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  try {
    const db = getDb();
    const patient = await getPatient(db, patientId);
    if (!patient) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
    if (!(await getPrescribedExercises(db, patientId)).length) {
      return { ok: false, error: 'Add exercises before sharing / शेअर करण्यापूर्वी व्यायाम जोडा' };
    }
    const { token, link } = await createShareLink(db, patientId, 'exercises', new Date());
    const url = await publicUrl(token);
    revalidatePath(`/patients/${patientId}`);
    return { ok: true, url, whatsappUrl: waMeUrl(patient.mobile, exerciseShareMessage(url)), expiresAt: link.expiresAt.toISOString() };
  } catch (error) {
    console.error('Failed to create share link:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not create the link / लिंक तयार करता आली नाही' };
  }
}

export async function revokeExerciseShareLinkAction(patientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  if (!patientIdSchema.safeParse(patientId).success) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  try {
    await revokeShareLinks(getDb(), patientId, 'exercises', new Date());
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (error) {
    console.error('Failed to revoke share link:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not stop sharing / शेअरिंग थांबवता आले नाही' };
  }
}

/**
 * Link to one posture report for its client (replaces their previous posture link). Photos only when
 * the physio ticked "client agreed". The token leaves the server only in this response.
 */
export async function createPostureShareLinkAction(
  assessmentId: string,
  includePhotos: boolean,
): Promise<{ ok: true; url: string; whatsappUrl: string; expiresAt: string } | { ok: false; error: string }> {
  await requireUser();
  if (!patientIdSchema.safeParse(assessmentId).success) return { ok: false, error: 'Report not found / अहवाल सापडला नाही' };
  try {
    const db = getDb();
    const assessment = await getPostureAssessment(db, assessmentId);
    const patient = assessment && await getPatient(db, assessment.patientId);
    if (!assessment || !patient) return { ok: false, error: 'Report not found / अहवाल सापडला नाही' };
    const { token, link } = await createShareLink(db, patient.id, 'posture', new Date(), {
      postureAssessmentId: assessment.id, includePhotos: includePhotos === true,
    });
    const url = await publicUrl(token);
    revalidatePath(`/patients/${patient.id}/posture/${assessment.id}`);
    return { ok: true, url, whatsappUrl: waMeUrl(patient.mobile, postureShareMessage(url)), expiresAt: link.expiresAt.toISOString() };
  } catch (error) {
    console.error('Failed to create posture share link:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not create the link / लिंक तयार करता आली नाही' };
  }
}

export async function revokePostureShareLinkAction(patientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  if (!patientIdSchema.safeParse(patientId).success) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  try {
    await revokeShareLinks(getDb(), patientId, 'posture', new Date());
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true };
  } catch (error) {
    console.error('Failed to revoke posture share link:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not stop sharing / शेअरिंग थांबवता आले नाही' };
  }
}
