'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { MAX_FILE_BYTES, validatePhoto } from '@/lib/files';
import { firstError, postureAssessmentSchema, postureRetakeSchema } from '@/lib/validation';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import { getPatient } from '@/data/patients';
import {
  addPostureAssessment, deletePostureAssessment, deletePosturePhotos, getPostureAssessment, replacePostureViews, saveAiReport,
  type PostureViewInput,
} from '@/data/posture';
import { listProblems } from '@/data/problems';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { listAllExercises } from '@/data/exercises';
import { computeBmi } from '@/lib/bmi';
import { generatePostureAnalysis } from '@/lib/gemini';
import { postureAiReportSchema, type PostureAiContext } from '@/lib/posture-ai';
import { combineViews, detectPatterns, scorePosture } from '@/lib/posture-insights';
import type { ActionResult } from '@/actions/patients';

const INVALID_PARAMS: ActionResult = { ok: false, error: 'Invalid parameters / अवैध पॅरामीटर्स' };
const INVALID_DATA: ActionResult = { ok: false, error: 'Invalid posture data / चुकीची पोश्चर माहिती' };
const SAVE_FAILED: ActionResult = { ok: false, error: 'Could not save posture assessment / पोश्चर मूल्यांकन जतन करता आले नाही' };

function parsePayload(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get('payload') ?? ''));
  } catch {
    return undefined;
  }
}

/** `photo_<view>` files for the given views: JPG/PNG, non-empty, ≤4 MB combined (Vercel body cap). */
function collectPhotos(formData: FormData, views: PostureView[]): Map<PostureView, File> | ActionResult {
  const photos = new Map<PostureView, File>();
  for (const view of views) {
    const photo = formData.get(`photo_${view}`);
    if (!(photo instanceof File) || photo.size === 0) {
      return { ok: false, error: 'Photo for each view required / प्रत्येक बाजूचा फोटो आवश्यक' };
    }
    const err = validatePhoto(photo);
    if (err) return { ok: false, error: err };
    photos.set(view, photo);
  }
  const total = [...photos.values()].reduce((sum, p) => sum + p.size, 0);
  if (total > MAX_FILE_BYTES) {
    return { ok: false, error: 'Photos too large, max 4 MB total / फोटो खूप मोठे, एकूण 4 MB पर्यंत' };
  }
  return photos;
}

/**
 * Form fields: `payload` (JSON: consent, assessedOn, note, views[] with landmarks) and
 * `photo_<view>` (JPEG/PNG) for each of front/right/back/left. Any metrics in the payload
 * are ignored — the data layer recomputes them from the landmarks.
 * On success redirects to the new assessment's report.
 */
export async function savePostureAssessmentAction(patientId: string, formData: FormData): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || !patientId) return INVALID_PARAMS;

  const raw = parsePayload(formData);
  if (raw === undefined) return INVALID_DATA;
  const parsed = postureAssessmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const photos = collectPhotos(formData, [...POSTURE_VIEWS]);
  if (!(photos instanceof Map)) return photos;

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
        cameraCheck: v.cameraCheck,
      })),
    });
    assessmentId = assessment.id;
  } catch {
    return SAVE_FAILED;
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/posture/${assessmentId}`);
}

/**
 * Retake some views of an existing assessment. Form: `payload` (JSON `{ views: [...] }`) and
 * `photo_<view>` for each. Redirects back to the report on success.
 */
export async function replacePostureViewsAction(
  patientId: string,
  assessmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || typeof assessmentId !== 'string' || !patientId || !assessmentId) {
    return INVALID_PARAMS;
  }
  const raw = parsePayload(formData);
  if (raw === undefined) return INVALID_DATA;
  const parsed = postureRetakeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const photos = collectPhotos(formData, parsed.data.views.map((v) => v.view));
  if (!(photos instanceof Map)) return photos;

  let updated;
  try {
    updated = await replacePostureViews(getDb(), getStorage(), patientId, assessmentId, parsed.data.views.map((v) => ({
      view: v.view,
      photo: photos.get(v.view)!,
      imageWidth: v.imageWidth,
      imageHeight: v.imageHeight,
      landmarks: v.landmarks,
      landmarksEdited: v.landmarksEdited,
      cameraCheck: v.cameraCheck,
    })));
  } catch {
    return SAVE_FAILED;
  }
  if (!updated) return NOT_FOUND;

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
  // Redirect server-side: the caller is the report page of the record that no longer exists.
  redirect(`/patients/${patientId}?tab=assessment`);
}

/**
 * The client withdrew photo consent: deletes all their posture photos, keeping points, measurements
 * and scores. New assessments ask for consent again as usual.
 */
export async function withdrawPhotoConsentAction(
  patientId: string,
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  await requireUser();
  if (!z.string().uuid().safeParse(patientId).success) return { ok: false, error: 'Client not found / साधक सापडला नाही' };
  try {
    const { deleted, failed } = await deletePosturePhotos(getDb(), getStorage(), patientId, new Date());
    revalidatePath(`/patients/${patientId}`, 'layout');
    if (failed) {
      return { ok: false, error: `${failed} photo(s) could not be deleted; please try again / ${failed} फोटो हटवता आले नाहीत; कृपया पुन्हा प्रयत्न करा` };
    }
    return { ok: true, deleted };
  } catch (error) {
    console.error('Failed to withdraw photo consent:', error instanceof Error ? error.message : String(error));
    return { ok: false, error: 'Could not delete the photos / फोटो हटवता आले नाहीत' };
  }
}

const NOT_FOUND: ActionResult = { ok: false, error: 'Assessment not found / मूल्यांकन सापडले नाही' };

/**
 * Generates the AI analysis for an assessment and saves it as a draft. Sends measurements and a
 * de-identified profile (age, gender, body size, ailments, posture-relevant lifestyle) — never the
 * name, contact details or photos.
 */
export async function generatePostureAiAction(patientId: string, assessmentId: string): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || typeof assessmentId !== 'string' || !patientId || !assessmentId) {
    return INVALID_PARAMS;
  }
  const db = getDb();
  const [patient, assessment] = await Promise.all([getPatient(db, patientId), getPostureAssessment(db, assessmentId)]);
  if (!patient || !assessment || assessment.patientId !== patientId) return NOT_FOUND;
  const [problems, lifestyle, library] = await Promise.all([
    listProblems(db, patientId), getLifestyleAssessment(db, patientId), listAllExercises(db),
  ]);

  const measures = combineViews(assessment.views.map((v) => ({ view: v.view as PostureView, metrics: v.metrics })));
  const context: PostureAiContext = {
    client: {
      age: patient.age ?? null,
      gender: patient.gender ?? null,
      heightCm: assessment.heightCm ?? patient.heightCm ?? null,
      weightKg: patient.weightKg ?? null,
      bmi: computeBmi(patient.weightKg, patient.heightCm),
    },
    ailments: problems.map((p) => p.problem),
    lifestyle: lifestyle ? {
      chiefComplaint: lifestyle.chiefComplaint ?? null,
      duration: lifestyle.duration ?? null,
      workType: lifestyle.workType ?? null,
      dailySitting: lifestyle.dailySitting ?? null,
      screenTime: lifestyle.screenTime ?? null,
      activityLevel: lifestyle.activityLevel ?? null,
      primaryGoal: lifestyle.primaryGoal ?? null,
      doctorRestrictions: lifestyle.doctorRestrictions ?? null,
      contraindications: lifestyle.hasContraindications ? (lifestyle.contraindicationDetails ?? 'yes') : null,
    } : null,
    assessment: {
      assessedOn: assessment.assessedOn,
      score: scorePosture(measures),
      patterns: detectPatterns(measures),
      measures,
      cameraLevel: assessment.views.find((v) => v.cameraCheck)?.cameraCheck?.method ?? null,
    },
    library: library.map((e) => ({ name: e.name, category: e.category })),
  };

  let report;
  try {
    report = await generatePostureAnalysis(context);
  } catch (err) {
    // Message only (HTTP status / validation issue) — never the context, which holds health data.
    console.error('[posture-ai] generation failed:', err instanceof Error ? err.message : 'unknown error');
    return { ok: false, error: 'AI analysis failed. Please try again. / AI विश्लेषण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.' };
  }
  await saveAiReport(db, patientId, assessmentId, report, { approved: false });
  revalidatePath(`/patients/${patientId}/posture/${assessmentId}`);
  return { ok: true };
}

const lines = (formData: FormData, key: string) =>
  String(formData.get(key) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** The physio's reviewed/edited analysis (one item per line; findings as "Title: explanation"). Marks it approved. */
export async function savePostureAiAction(
  patientId: string,
  assessmentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (typeof patientId !== 'string' || typeof assessmentId !== 'string' || !patientId || !assessmentId) {
    return INVALID_PARAMS;
  }
  const parsed = postureAiReportSchema.safeParse({
    summary: String(formData.get('summary') ?? ''),
    keyFindings: lines(formData, 'keyFindings').map((l) => {
      const at = l.indexOf(':');
      return at > 0 ? { title: l.slice(0, at).trim(), explanation: l.slice(at + 1).trim() } : { title: l, explanation: l };
    }),
    lifestyleLinks: lines(formData, 'lifestyleLinks'),
    likelyCauses: lines(formData, 'likelyCauses'),
    risks: lines(formData, 'risks'),
    recommendations: {
      exercises: lines(formData, 'exercises'),
      ergonomics: lines(formData, 'ergonomics'),
      yogaAndBreathing: lines(formData, 'yogaAndBreathing'),
    },
    followUp: String(formData.get('followUp') ?? ''),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Summary, at least one finding and follow-up are required / सारांश, किमान एक निष्कर्ष आणि पुढील तपासणी आवश्यक' };
  }
  const saved = await saveAiReport(getDb(), patientId, assessmentId, parsed.data, { approved: true });
  if (!saved) return NOT_FOUND;
  revalidatePath(`/patients/${patientId}/posture/${assessmentId}`);
  return { ok: true };
}
