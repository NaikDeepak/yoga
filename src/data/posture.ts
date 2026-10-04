import { desc, eq, inArray } from 'drizzle-orm';
import {
  postureAssessments, postureViews, type PostureAssessmentRow, type PostureViewRow,
} from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeViewMetrics, POSTURE_VIEWS, type Landmark, type PostureView } from '@/lib/posture';

export interface PostureViewInput {
  view: PostureView;
  photo: File;
  imageWidth: number;
  imageHeight: number;
  landmarks: Landmark[];
  landmarksEdited: boolean;
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
  const pathFor = (v: PostureView) => `patients/${input.patientId}/posture/${assessmentId}/${v}.jpg`;
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

  const views = await db.select({ assessmentId: postureViews.assessmentId, metrics: postureViews.metrics })
    .from(postureViews)
    .where(inArray(postureViews.assessmentId, assessments.map((a) => a.id)));

  return assessments.map((a) => {
    const metrics = views.filter((v) => v.assessmentId === a.id).flatMap((v) => v.metrics);
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
  return { ...assessment, views: views.sort(byCaptureOrder) };
}

export async function deletePostureAssessment(db: Db, storage: FileStorage, id: string): Promise<void> {
  const views = await db.select({ filePath: postureViews.filePath }).from(postureViews)
    .where(eq(postureViews.assessmentId, id));
  await db.delete(postureAssessments).where(eq(postureAssessments.id, id)); // cascades to views
  await Promise.all(views.map((v) => storage.remove(v.filePath)));
}
