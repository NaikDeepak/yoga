import { and, desc, eq, getTableColumns, inArray, lte, sql } from 'drizzle-orm';
import {
  postureAssessments, postureViews, type PostureAssessmentRow, type PostureViewRow,
} from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeViewMetrics, POSTURE_VIEWS, type Landmark, type PostureView } from '@/lib/posture';
import type { CameraCheck } from '@/lib/posture-capture';
import { combineViews, scorePosture, type Grade } from '@/lib/posture-insights';
import type { PostureAiReport } from '@/lib/posture-ai';

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
/** List row: score and counts use the averaged (combined) findings, the same as the report. */
export type PostureAssessmentSummary = PostureAssessmentRow & {
  mildCount: number;
  markedCount: number;
  score: number | null;
  grade: Grade | null;
};

/** Storage key for a view photo; retakes get a `version` suffix so the old file can be removed after commit. */
export const posturePhotoPath = (patientId: string, assessmentId: string, view: PostureView, version?: string) =>
  `patients/${patientId}/posture/${assessmentId}/${view}${version ? `-${version}` : ''}.jpg`;

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
  const cleanup = () => Promise.allSettled(uploaded.map((p) => storage.remove(p)));

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
  return summarize(db, assessments);
}

/** Score + mild/marked counts on the combined findings, for each assessment (one views query). */
async function summarize(db: Db, assessments: PostureAssessmentRow[]): Promise<PostureAssessmentSummary[]> {
  if (!assessments.length) return [];
  const views = await db.select().from(postureViews)
    .where(inArray(postureViews.assessmentId, assessments.map((a) => a.id)));

  return assessments.map((a) => {
    const combined = combineViews(views.filter((v) => v.assessmentId === a.id)
      .map((v) => ({ view: v.view as PostureView, metrics: currentMetrics(v, a.heightCm) })));
    const { overall, grade } = scorePosture(combined);
    return {
      ...a,
      mildCount: combined.filter((m) => m.severity === 'mild').length,
      markedCount: combined.filter((m) => m.severity === 'marked').length,
      score: overall,
      grade,
    };
  });
}

export interface LatestPostureScore {
  assessmentId: string;
  assessedOn: string;
  score: number | null;
  grade: Grade | null;
  mildCount: number;
  markedCount: number;
  previousId: string | null;
  previousOn: string | null;
  previousScore: number | null;
}

/**
 * Latest posture score per client plus the previous one (for the trend), for the Overview card and
 * the client list. Clients without assessments are absent. Two queries regardless of client count.
 */
export async function latestPostureScores(db: Db, patientIds: string[]): Promise<Map<string, LatestPostureScore>> {
  const result = new Map<string, LatestPostureScore>();
  if (!patientIds.length) return result;
  // Only the newest two per client leave the database, however long a client's history gets.
  const ranked = db.select({
    ...getTableColumns(postureAssessments),
    rank: sql<number>`row_number() over (partition by ${postureAssessments.patientId}
      order by ${postureAssessments.assessedOn} desc, ${postureAssessments.createdAt} desc)`.as('rank'),
  }).from(postureAssessments)
    .where(inArray(postureAssessments.patientId, patientIds))
    .as('ranked');
  const rows = await db.select().from(ranked).where(lte(ranked.rank, 2)).orderBy(ranked.patientId, ranked.rank);

  const lastTwo = new Map<string, PostureAssessmentRow[]>();
  for (const { rank: _rank, ...a } of rows) lastTwo.set(a.patientId, [...(lastTwo.get(a.patientId) ?? []), a]);
  const summaries = new Map((await summarize(db, [...lastTwo.values()].flat())).map((s) => [s.id, s]));

  for (const [patientId, [latest, previous]] of lastTwo) {
    const l = summaries.get(latest.id)!;
    const p = previous ? summaries.get(previous.id)! : null;
    result.set(patientId, {
      assessmentId: l.id, assessedOn: l.assessedOn, score: l.score, grade: l.grade,
      mildCount: l.mildCount, markedCount: l.markedCount,
      previousId: p?.id ?? null, previousOn: p?.assessedOn ?? null, previousScore: p?.score ?? null,
    });
  }
  return result;
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
  const [owned] = await db.select({ id: postureAssessments.id }).from(postureAssessments)
    .where(and(eq(postureAssessments.id, id), eq(postureAssessments.patientId, patientId)));
  if (!owned) return;
  const views = await db.select({ filePath: postureViews.filePath }).from(postureViews)
    .where(eq(postureViews.assessmentId, id));
  await db.delete(postureAssessments).where(eq(postureAssessments.id, id)); // cascades to views
  // Best effort: the record is already gone, so a storage hiccup must not report the delete as failed.
  await Promise.allSettled(views.map((v) => storage.remove(v.filePath)));
}

/**
 * Retakes some views of an existing assessment (e.g. when front and back disagree). Uploads the new
 * photos under versioned keys, updates those view rows in one transaction, then removes the replaced
 * photos. Any failure leaves the assessment as it was. Returns null if the assessment isn't this client's.
 */
export async function replacePostureViews(
  db: Db,
  storage: FileStorage,
  patientId: string,
  assessmentId: string,
  views: PostureViewInput[],
): Promise<PostureAssessment | null> {
  const [assessment] = await db.select().from(postureAssessments)
    .where(and(eq(postureAssessments.id, assessmentId), eq(postureAssessments.patientId, patientId)));
  if (!assessment) return null;

  const existing = await db.select({ view: postureViews.view, filePath: postureViews.filePath }).from(postureViews)
    .where(and(eq(postureViews.assessmentId, assessmentId), inArray(postureViews.view, views.map((v) => v.view))));
  const version = crypto.randomUUID().slice(0, 8);
  const pathFor = (v: PostureView) => posturePhotoPath(patientId, assessmentId, v, version);
  const uploaded: string[] = [];
  try {
    for (const v of views) {
      await storage.upload(pathFor(v.view), v.photo);
      uploaded.push(pathFor(v.view));
    }
    await db.transaction(async (tx) => {
      for (const v of views) {
        const [row] = await tx.update(postureViews).set({
          filePath: pathFor(v.view),
          imageWidth: v.imageWidth,
          imageHeight: v.imageHeight,
          landmarks: v.landmarks,
          landmarksEdited: v.landmarksEdited,
          cameraCheck: v.cameraCheck,
          metrics: computeViewMetrics(v.view, v.landmarks, {
            width: v.imageWidth, height: v.imageHeight, heightCm: assessment.heightCm,
          }),
        }).where(and(eq(postureViews.assessmentId, assessmentId), eq(postureViews.view, v.view)))
          .returning({ id: postureViews.id });
        if (!row) throw new Error(`No ${v.view} view to replace`);
      }
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => storage.remove(p)));
    throw err;
  }
  // Only after the rows point at the new photos; best effort, the retake itself has succeeded.
  await Promise.allSettled(existing.map((e) => storage.remove(e.filePath)));
  return getPostureAssessment(db, assessmentId);
}

/**
 * Stores the AI analysis. `approved: false` = a freshly generated draft (stamps ai_generated_at,
 * clears approval); `approved: true` = the physio's reviewed/edited version (stamps ai_approved_at).
 * Returns false if the assessment isn't this client's.
 */
export async function saveAiReport(
  db: Db,
  patientId: string,
  assessmentId: string,
  report: PostureAiReport,
  { approved }: { approved: boolean },
): Promise<boolean> {
  const now = new Date();
  const updated = await db.update(postureAssessments)
    .set(approved
      ? { aiReport: report, aiApprovedAt: now }
      : { aiReport: report, aiGeneratedAt: now, aiApprovedAt: null })
    .where(and(eq(postureAssessments.id, assessmentId), eq(postureAssessments.patientId, patientId)))
    .returning({ id: postureAssessments.id });
  return updated.length > 0;
}
