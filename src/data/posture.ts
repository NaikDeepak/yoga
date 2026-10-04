import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  postureAssessments, postureViews, type PostureAssessmentRow, type PostureViewRow,
} from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeViewMetrics, POSTURE_VIEWS, type Landmark, type PostureView } from '@/lib/posture';
import type { CameraCheck } from '@/lib/posture-capture';

export interface PostureViewInput {
  view: PostureView;
  photo: File;
  imageWidth: number;
  imageHeight: number;
  landmarks: Landmark[];
  landmarksEdited: boolean;
  cameraCheck: CameraCheck | null;
}

export interface PostureAssessmentInput {
  patientId: string;
  assessedOn: string;
  heightCm: number | null;
  note: string | null;
  consentAt: Date;
  views: PostureViewInput[];
}

export type PostureAssessment = PostureAssessmentRow & { views: PostureViewRow[] };
export type PostureAssessmentSummary = PostureAssessmentRow & { mildCount: number; markedCount: number };

export const posturePhotoPath = (patientId: string, assessmentId: string, view: PostureView) =>
  `patients/${patientId}/posture/${assessmentId}/${view}.jpg`;

/**
 * Reads always recompute metrics from the stored landmarks, so every report (and every before/after
 * comparison) uses the current formulas. The `metrics` column is the snapshot taken at save time.
 */
const currentMetrics = (v: PostureViewRow, heightCm: number | null) =>
  computeViewMetrics(v.view as PostureView, v.landmarks, { width: v.imageWidth, height: v.imageHeight, heightCm });

const byCaptureOrder = (a: PostureViewRow, b: PostureViewRow) =>
  POSTURE_VIEWS.indexOf(a.view as PostureView) - POSTURE_VIEWS.indexOf(b.view as PostureView);

/**
 * Uploads every photo first, then inserts the assessment + views in one transaction.
 * Metrics are always computed here from the landmarks — never accepted from the caller.
 * Any failure removes the photos already uploaded, so no orphan files or rows remain.
 */
export async function addPostureAssessment(
  db: Db,
  storage: FileStorage,
  input: PostureAssessmentInput,
): Promise<PostureAssessment> {
  const assessmentId = crypto.randomUUID();
  const pathFor = (v: PostureView) => posturePhotoPath(input.patientId, assessmentId, v);
  const uploaded: string[] = [];
  const cleanup = () => Promise.all(uploaded.map((p) => storage.remove(p)));

  try {
    for (const v of input.views) {
      await storage.upload(pathFor(v.view), v.photo);
      uploaded.push(pathFor(v.view));
    }
    const result = await db.transaction(async (tx) => {
      const [assessment] = await tx.insert(postureAssessments).values({
        id: assessmentId,
        patientId: input.patientId,
        assessedOn: input.assessedOn,
        heightCm: input.heightCm,
        note: input.note,
        consentAt: input.consentAt,
      }).returning();
      const views = await tx.insert(postureViews).values(input.views.map((v) => ({
        assessmentId,
        view: v.view,
        filePath: pathFor(v.view),
        imageWidth: v.imageWidth,
        imageHeight: v.imageHeight,
        landmarks: v.landmarks,
        landmarksEdited: v.landmarksEdited,
        cameraCheck: v.cameraCheck,
        metrics: computeViewMetrics(v.view, v.landmarks, {
          width: v.imageWidth, height: v.imageHeight, heightCm: input.heightCm,
        }),
      }))).returning();
      return { ...assessment, views: views.sort(byCaptureOrder) };
    });
    return result;
  } catch (err) {
    await cleanup();
    throw err;
  }
}

export async function listPostureAssessments(db: Db, patientId: string): Promise<PostureAssessmentSummary[]> {
  const assessments = await db.select().from(postureAssessments)
    .where(eq(postureAssessments.patientId, patientId))
    .orderBy(desc(postureAssessments.assessedOn), desc(postureAssessments.createdAt));
  if (!assessments.length) return [];

  const views = await db.select().from(postureViews)
    .where(inArray(postureViews.assessmentId, assessments.map((a) => a.id)));

  return assessments.map((a) => {
    const metrics = views.filter((v) => v.assessmentId === a.id).flatMap((v) => currentMetrics(v, a.heightCm));
    return {
      ...a,
      mildCount: metrics.filter((m) => m.severity === 'mild').length,
      markedCount: metrics.filter((m) => m.severity === 'marked').length,
    };
  });
}

export async function getPostureAssessment(db: Db, id: string): Promise<PostureAssessment | null> {
  const [assessment] = await db.select().from(postureAssessments).where(eq(postureAssessments.id, id));
  if (!assessment) return null;
  const views = await db.select().from(postureViews).where(eq(postureViews.assessmentId, id));
  return {
    ...assessment,
    views: views.map((v) => ({ ...v, metrics: currentMetrics(v, assessment.heightCm) })).sort(byCaptureOrder),
  };
}

export async function deletePostureAssessment(
  db: Db,
  storage: FileStorage,
  patientId: string,
  id: string,
): Promise<void> {
  const deleted = await db.delete(postureAssessments) // cascades to views
    .where(and(eq(postureAssessments.id, id), eq(postureAssessments.patientId, patientId)))
    .returning({ id: postureAssessments.id });
  if (!deleted.length) return;
  await Promise.all(POSTURE_VIEWS.map((v) => storage.remove(posturePhotoPath(patientId, id, v))));
}
