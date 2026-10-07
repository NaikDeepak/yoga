import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import {
  flexibilityTests, postureAssessments, postureViews, shareLinks, type PostureAssessmentRow, type PostureViewRow,
} from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { computeViewMetrics, POSTURE_VIEWS, type Landmark, type PostureView } from '@/lib/posture';
import type { CameraCheck } from '@/lib/posture-capture';
import { combineViews, scorePosture, type Grade } from '@/lib/posture-insights';
import type { PostureAiReport } from '@/lib/posture-ai';
import { scoreShots } from '@/lib/flexibility';
import { totalScore } from '@/lib/total-score';

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
  /** Posture views + flexibility shots that still have a photo (0 once photo consent was withdrawn). */
  photoCount: number;
  /** Posture + the three flexibility scores (/400); null unless all four exist. */
  total: number | null;
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

/**
 * `totals: true` also computes each assessment's total /400 (loads and scores the flexibility landmarks);
 * leave it off where the total isn't shown (client list, progress report) — `total` is then null.
 */
export async function listPostureAssessments(
  db: Db,
  patientId: string,
  opts: { totals?: boolean } = {},
): Promise<PostureAssessmentSummary[]> {
  const assessments = await db.select().from(postureAssessments)
    .where(eq(postureAssessments.patientId, patientId))
    .orderBy(desc(postureAssessments.assessedOn), desc(postureAssessments.createdAt));
  return summarize(db, assessments, opts);
}

const groupBy = <T extends { assessmentId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.assessmentId, [...(map.get(r.assessmentId) ?? []), r]);
  return map;
};

/** Score + mild/marked counts on the combined findings (+ total /400 when asked), for each assessment. */
async function summarize(
  db: Db,
  assessments: PostureAssessmentRow[],
  { totals = false }: { totals?: boolean } = {},
): Promise<PostureAssessmentSummary[]> {
  if (!assessments.length) return [];
  const ids = assessments.map((a) => a.id);
  const flexCols = {
    assessmentId: flexibilityTests.assessmentId, shot: flexibilityTests.shot, filePath: flexibilityTests.filePath,
    // Landmarks only when a total is wanted: they're the heavy part.
    ...(totals && { landmarks: flexibilityTests.landmarks, imageWidth: flexibilityTests.imageWidth, imageHeight: flexibilityTests.imageHeight }),
  };
  const [views, flexRows] = await Promise.all([
    db.select().from(postureViews).where(inArray(postureViews.assessmentId, ids)),
    db.select(flexCols).from(flexibilityTests).where(inArray(flexibilityTests.assessmentId, ids)),
  ]);
  const viewsOf = groupBy(views);
  const flexOf = groupBy(flexRows as (typeof flexRows[number] & { assessmentId: string })[]);

  return assessments.map((a) => {
    const own = viewsOf.get(a.id) ?? [];
    const ownFlex = flexOf.get(a.id) ?? [];
    const combined = combineViews(own
      .map((v) => ({ view: v.view as PostureView, metrics: currentMetrics(v, a.heightCm) })));
    const posture = scorePosture(combined);
    return {
      ...a,
      mildCount: combined.filter((m) => m.severity === 'mild').length,
      markedCount: combined.filter((m) => m.severity === 'marked').length,
      score: posture.overall,
      grade: posture.grade,
      photoCount: own.filter((v) => v.filePath !== null).length + ownFlex.filter((f) => f.filePath !== null).length,
      total: totals
        ? totalScore(posture, scoreShots(ownFlex as Parameters<typeof scoreShots>[0]).scores)?.total ?? null
        : null,
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
  /** Total /400 of the latest and the previous assessment; null unless complete. */
  total: number | null;
  previousTotal: number | null;
}

/**
 * Latest posture score per client plus the previous one (for the trend), for the Overview card and
 * the client list. Clients without assessments are absent. Two queries regardless of client count.
 */
/** `totals: true` adds the latest and previous totals (/400); the client list leaves it off. */
export async function latestPostureScores(
  db: Db,
  patientIds: string[],
  opts: { totals?: boolean } = {},
): Promise<Map<string, LatestPostureScore>> {
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
  const summaries = new Map((await summarize(db, [...lastTwo.values()].flat(), opts)).map((s) => [s.id, s]));

  for (const [patientId, [latest, previous]] of lastTwo) {
    const l = summaries.get(latest.id)!;
    const p = previous ? summaries.get(previous.id)! : null;
    result.set(patientId, {
      assessmentId: l.id, assessedOn: l.assessedOn, score: l.score, grade: l.grade,
      mildCount: l.mildCount, markedCount: l.markedCount,
      previousId: p?.id ?? null, previousOn: p?.assessedOn ?? null, previousScore: p?.score ?? null,
      total: l.total, previousTotal: p?.total ?? null,
    });
  }
  return result;
}

/** Just an assessment's date (cheap; e.g. "the client's link shows the report from …"). */
export async function postureAssessedOn(db: Db, id: string): Promise<string | null> {
  const [row] = await db.select({ assessedOn: postureAssessments.assessedOn }).from(postureAssessments)
    .where(eq(postureAssessments.id, id));
  return row?.assessedOn ?? null;
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
  const files = (await Promise.all([
    db.select({ filePath: postureViews.filePath }).from(postureViews).where(eq(postureViews.assessmentId, id)),
    db.select({ filePath: flexibilityTests.filePath }).from(flexibilityTests).where(eq(flexibilityTests.assessmentId, id)),
  ])).flat();
  await db.delete(postureAssessments).where(eq(postureAssessments.id, id)); // cascades to views + flexibility tests
  // Best effort: the record is already gone, so a storage hiccup must not report the delete as failed.
  await Promise.allSettled(files.flatMap((f) => (f.filePath ? [storage.remove(f.filePath)] : [])));
}

/**
 * The client withdrew photo consent: deletes all their posture photos but keeps every assessment's
 * points, measurements and scores (figures are drawn from the points). Files first; only views whose
 * file is gone get `file_path` nulled, so a photo that failed to delete keeps its path and a retry
 * finishes the job. Stamps `photos_deleted_at` (the first withdrawal is kept) and turns photos off on
 * their posture share link.
 */
export async function deletePosturePhotos(
  db: Db,
  storage: FileStorage,
  patientId: string,
  now: Date,
): Promise<{ deleted: number; failed: number }> {
  // Posture views and flexibility shots alike: every photo row of this client's assessments.
  const photoRows = async (table: typeof postureViews | typeof flexibilityTests) => (await db
    .select({ id: table.id, assessmentId: table.assessmentId, filePath: table.filePath })
    .from(table)
    .innerJoin(postureAssessments, eq(table.assessmentId, postureAssessments.id))
    .where(and(eq(postureAssessments.patientId, patientId), isNotNull(table.filePath))))
    .map((r) => ({ ...r, table }));
  const views = (await Promise.all([photoRows(postureViews), photoRows(flexibilityTests)])).flat();
  const results = await Promise.allSettled(views.map((v) => storage.remove(v.filePath!)));
  const gone = views.filter((_, i) => results[i].status === 'fulfilled');
  const failed = views.length - gone.length;
  if (failed) console.error(`Withdrawing photo consent: ${failed} file(s) could not be removed`); // count only

  if (gone.length) {
    await db.transaction(async (tx) => {
      // Only if the view still points at the deleted file: a retake that landed meanwhile keeps its new photo.
      for (const v of gone) {
        await tx.update(v.table).set({ filePath: null })
          .where(and(eq(v.table.id, v.id), eq(v.table.filePath, v.filePath!)));
      }
      await tx.update(postureAssessments).set({ photosDeletedAt: now })
        .where(and(inArray(postureAssessments.id, [...new Set(gone.map((v) => v.assessmentId))]), isNull(postureAssessments.photosDeletedAt)));
      await tx.update(shareLinks).set({ includePhotos: false })
        .where(and(eq(shareLinks.patientId, patientId), eq(shareLinks.kind, 'posture')));
    });
  }
  return { deleted: gone.length, failed };
}

/**
 * New photos for an existing assessment need fresh consent when its photos were deleted (consent
 * withdrawn) after the last consent. Giving it updates `consent_at`, so it's asked once.
 */
export const consentWithdrawn = (a: { photosDeletedAt: Date | null; consentAt: Date }) =>
  a.photosDeletedAt !== null && a.photosDeletedAt >= a.consentAt;

/** The assessment row alone (no views or metric recomputation) — for ownership/consent checks. */
export async function getPostureAssessmentRow(db: Db, id: string): Promise<PostureAssessmentRow | null> {
  const [row] = await db.select().from(postureAssessments).where(eq(postureAssessments.id, id));
  return row ?? null;
}

export async function needsFreshConsent(db: Db, assessmentId: string): Promise<boolean> {
  const [a] = await db.select({ photosDeletedAt: postureAssessments.photosDeletedAt, consentAt: postureAssessments.consentAt })
    .from(postureAssessments).where(eq(postureAssessments.id, assessmentId));
  return !!a && consentWithdrawn(a);
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
  opts: { freshConsent?: boolean } = {},
): Promise<PostureAssessment | null | 'consentRequired'> {
  const [assessment] = await db.select().from(postureAssessments)
    .where(and(eq(postureAssessments.id, assessmentId), eq(postureAssessments.patientId, patientId)));
  if (!assessment) return null;
  if (consentWithdrawn(assessment) && !opts.freshConsent) return 'consentRequired';

  const version = crypto.randomUUID().slice(0, 8);
  const pathFor = (v: PostureView) => posturePhotoPath(patientId, assessmentId, v, version);
  const uploaded: string[] = [];
  let existing: { filePath: string | null }[];
  try {
    for (const v of views) {
      await storage.upload(pathFor(v.view), v.photo);
      uploaded.push(pathFor(v.view));
    }
    existing = await db.transaction(async (tx) => {
      // Lock the assessment so overlapping retakes run one after the other, and read the photos being
      // replaced inside the lock: each save then removes exactly the file it replaced (no orphans).
      await tx.select({ id: postureAssessments.id }).from(postureAssessments).where(eq(postureAssessments.id, assessmentId)).for('update');
      const replaced = await tx.select({ filePath: postureViews.filePath }).from(postureViews)
        .where(and(eq(postureViews.assessmentId, assessmentId), inArray(postureViews.view, views.map((v) => v.view))));
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
      // An approved AI analysis described the old measurements: back to draft until re-approved
      // (it also stops it reaching the client's shared report).
      await tx.update(postureAssessments)
        .set({ aiApprovedAt: null, ...(opts.freshConsent && { consentAt: new Date() }) })
        .where(eq(postureAssessments.id, assessmentId));
      return replaced;
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => storage.remove(p)));
    throw err;
  }
  // Only after the rows point at the new photos; best effort, the retake itself has succeeded.
  await Promise.allSettled(existing.flatMap((e) => (e.filePath ? [storage.remove(e.filePath)] : [])));
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
