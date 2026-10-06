// The client's copy of one posture report, for the public share page (spec 2026-10-05-share-posture-report).
// Whitelisted: nothing from the record reaches the page unless it is listed in SharedPostureReport.
import { eq } from 'drizzle-orm';
import { patients, type ShareLinkRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeBmi } from '@/lib/bmi';
import { firstName } from '@/lib/names';
import { buildOverlay, type Overlay } from '@/lib/posture-overlay';
import { combineViews, detectPatterns, scorePosture, type PatternKey, type PostureScore } from '@/lib/posture-insights';
import type { Metric, PostureView } from '@/lib/posture';
import type { PostureAiReport } from '@/lib/posture-ai';
import { getPostureAssessment } from './posture';
import { visitVitalsOn } from './visits';
import { getLifestyleAssessmentSnapshot } from './lifestyle';
import { safeErrorMessage } from '@/lib/log';

/** Signed photo URLs on the public page expire quickly; the page is re-signed on every load. */
export const SHARED_PHOTO_URL_SECONDS = 600;

export interface SharedPostureReport {
  firstName: string;
  assessedOn: string;
  score: PostureScore;
  /** The physio shared photos (a null photoUrl then means it failed to load, not that it was withheld). */
  photosShared: boolean;
  /**
   * Titles are looked up by key on the page (English in both languages; no cause/effect text). Only
   * patterns the views agree on: low-confidence readings are for the physio to retake, not to tell the client.
   */
  patterns: { key: PatternKey; severity: 'mild' | 'marked' }[];
  views: { view: PostureView; overlay: Overlay; metrics: Metric[]; photoUrl: string | null }[];
  /** Only once the physio approved it, and only the client-facing parts. */
  ai: Pick<PostureAiReport, 'summary' | 'recommendations'> | null;
  wellbeing: {
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    bmi: number | null;
    painScale: number | null;
    stressLevel: number | null;
    goal: string | null;
  };
}

export async function getSharedPostureReport(
  db: Db,
  storage: FileStorage,
  link: ShareLinkRow,
): Promise<SharedPostureReport | null> {
  if (link.kind !== 'posture' || !link.postureAssessmentId) return null;
  const assessment = await getPostureAssessment(db, link.postureAssessmentId); // metrics recomputed
  if (!assessment || assessment.patientId !== link.patientId) return null;
  const [patient] = await db.select({ fullName: patients.fullName, age: patients.age, gender: patients.gender, weightKg: patients.weightKg })
    .from(patients).where(eq(patients.id, link.patientId));
  if (!patient) return null;

  const [vitals, lifestyle] = await Promise.all([
    visitVitalsOn(db, link.patientId, assessment.assessedOn),
    getLifestyleAssessmentSnapshot(db, link.patientId),
  ]);
  const views = await Promise.all(assessment.views.map(async (v) => ({
    view: v.view as PostureView,
    overlay: buildOverlay(v.view as PostureView, v.landmarks, v.imageWidth, v.imageHeight),
    metrics: v.metrics,
    photoUrl: link.includePhotos && v.filePath
      ? await storage.createSignedUrl(v.filePath, SHARED_PHOTO_URL_SECONDS).catch((err: unknown) => {
        // The page then says "Photo unavailable". Message only: no paths or ids in logs.
        console.error('Shared posture photo URL failed:', safeErrorMessage(err));
        return null;
      })
      : null,
  })));
  const combined = combineViews(views);
  // Readings the views disagree on are for the physio to retake: unrate them in each view so they're
  // neither listed nor coloured on the client's page (patterns below skip them too).
  const disputed = new Set(combined.filter((m) => m.lowConfidence).flatMap((m) => m.sources.map((s) => s.metric)));
  const clientViews = views.map((v) => ({
    ...v,
    metrics: v.metrics.map((m) => (disputed.has(m) ? { ...m, severity: null } : m)),
  }));
  const weightKg = vitals.weightKg ?? (patient.weightKg === null ? null : Number(patient.weightKg));

  return {
    firstName: firstName(patient.fullName),
    assessedOn: assessment.assessedOn,
    photosShared: link.includePhotos && assessment.views.some((v) => v.filePath !== null),
    score: scorePosture(combined),
    patterns: detectPatterns(combined.filter((m) => !m.lowConfidence)).map((p) => ({ key: p.key, severity: p.severity })),
    views: clientViews,
    ai: assessment.aiReport && assessment.aiApprovedAt
      ? { summary: assessment.aiReport.summary, recommendations: assessment.aiReport.recommendations }
      : null,
    wellbeing: {
      age: patient.age,
      gender: patient.gender,
      weightKg,
      bmi: computeBmi(weightKg, assessment.heightCm),
      painScale: vitals.painScale,
      stressLevel: lifestyle?.stressLevel ?? null,
      goal: lifestyle?.primaryGoal?.trim() || null,
    },
  };
}
