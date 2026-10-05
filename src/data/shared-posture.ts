// The client's copy of one posture report, for the public share page (spec 2026-10-05-share-posture-report).
// Whitelisted: nothing from the record reaches the page unless it is listed in SharedPostureReport.
import { eq } from 'drizzle-orm';
import { patients, type ShareLinkRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeBmi } from '@/lib/bmi';
import { buildOverlay, type Overlay } from '@/lib/posture-overlay';
import { combineViews, detectPatterns, scorePosture, type PatternKey, type PostureScore } from '@/lib/posture-insights';
import type { Metric, PostureView } from '@/lib/posture';
import type { PostureAiReport } from '@/lib/posture-ai';
import { getPostureAssessment } from './posture';
import { visitVitalsOn } from './visits';
import { getLifestyleAssessmentSnapshot } from './lifestyle';

/** Signed photo URLs on the public page expire quickly; the page is re-signed on every load. */
export const SHARED_PHOTO_URL_SECONDS = 600;

export interface SharedPostureReport {
  firstName: string;
  assessedOn: string;
  score: PostureScore;
  /** Titles are looked up by key on the page (English in both languages; no cause/effect text). */
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
    photoUrl: link.includePhotos
      ? await storage.createSignedUrl(v.filePath, SHARED_PHOTO_URL_SECONDS).catch(() => null)
      : null,
  })));
  const combined = combineViews(views);
  const weightKg = vitals.weightKg ?? (patient.weightKg === null ? null : Number(patient.weightKg));

  return {
    firstName: patient.fullName.trim().split(/\s+/)[0],
    assessedOn: assessment.assessedOn,
    score: scorePosture(combined),
    patterns: detectPatterns(combined).map((p) => ({ key: p.key, severity: p.severity })),
    views,
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
