// Flexibility tests attached to a posture assessment (spec 2026-10-06-flexibility-tests). Photos live in
// the client's folder next to the posture photos; measures and scores are recomputed on every read.
import { and, eq, inArray } from 'drizzle-orm';
import { flexibilityTests, postureAssessments, type FlexibilityTestRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import { consentWithdrawn } from './posture';
import type { Landmark } from '@/lib/posture';
import type { CameraCheck } from '@/lib/posture-capture';
import {
  FLEX_SHOTS, measureShot, scoreFlexibility, type FlexMeasures, type FlexResult, type FlexShot, type FlexTest, type ShotMeasure,
} from '@/lib/flexibility';

export interface FlexShotInput {
  shot: FlexShot;
  photo: File;
  imageWidth: number;
  imageHeight: number;
  landmarks: Landmark[];
  landmarksEdited: boolean;
  cameraCheck: CameraCheck;
}

export type FlexShotRecord = FlexibilityTestRow & { shot: FlexShot; measure: ShotMeasure };
export interface Flexibility {
  /** In capture order; only the shots taken so far. */
  shots: FlexShotRecord[];
  scores: Record<FlexTest, FlexResult | null>;
}

/** Storage key for a shot photo; versioned so a retake's old file can be removed after commit. */
export const flexPhotoPath = (patientId: string, assessmentId: string, shot: FlexShot, version: string) =>
  `patients/${patientId}/posture/${assessmentId}/flex-${shot}-${version}.jpg`;

function withScores(rows: FlexibilityTestRow[]): Flexibility {
  const shots = rows
    .map((r) => ({
      ...r,
      shot: r.shot as FlexShot,
      measure: measureShot(r.shot as FlexShot, r.landmarks, { width: r.imageWidth, height: r.imageHeight }),
    }))
    .sort((a, b) => FLEX_SHOTS.indexOf(a.shot) - FLEX_SHOTS.indexOf(b.shot));
  const measures: FlexMeasures = Object.fromEntries(shots.map((s) => [s.shot, s.measure]));
  return { shots, scores: scoreFlexibility(measures) };
}

export async function getFlexibility(db: Db, assessmentId: string): Promise<Flexibility> {
  return withScores(await db.select().from(flexibilityTests).where(eq(flexibilityTests.assessmentId, assessmentId)));
}

/**
 * Saves 1–4 shots for this client's assessment (first capture or retakes): uploads the photos, then
 * upserts the rows in one transaction, then removes the photos they replaced. Any failure removes what
 * was uploaded. Stores nothing for another client's assessment ('notFound'), or when photo consent was
 * withdrawn and not given again ('consentRequired'; `freshConsent` records it).
 */
export async function saveFlexibilityShots(
  db: Db,
  storage: FileStorage,
  patientId: string,
  assessmentId: string,
  shots: FlexShotInput[],
  opts: { freshConsent?: boolean } = {},
): Promise<'saved' | 'notFound' | 'consentRequired'> {
  const [assessment] = await db.select({ photosDeletedAt: postureAssessments.photosDeletedAt, consentAt: postureAssessments.consentAt })
    .from(postureAssessments)
    .where(and(eq(postureAssessments.id, assessmentId), eq(postureAssessments.patientId, patientId)));
  if (!assessment) return 'notFound';
  if (consentWithdrawn(assessment) && !opts.freshConsent) return 'consentRequired';

  const version = crypto.randomUUID().slice(0, 8);
  const pathFor = (s: FlexShot) => flexPhotoPath(patientId, assessmentId, s, version);
  const uploaded: string[] = [];
  let replaced: { filePath: string | null }[];
  try {
    for (const s of shots) {
      await storage.upload(pathFor(s.shot), s.photo);
      uploaded.push(pathFor(s.shot));
    }
    replaced = await db.transaction(async (tx) => {
      // Lock the assessment so overlapping saves run one after the other, and read the photos being
      // replaced inside the lock: each save then removes exactly the file it replaced (no orphans).
      await tx.select({ id: postureAssessments.id }).from(postureAssessments).where(eq(postureAssessments.id, assessmentId)).for('update');
      const old = await tx.select({ filePath: flexibilityTests.filePath }).from(flexibilityTests)
        .where(and(eq(flexibilityTests.assessmentId, assessmentId), inArray(flexibilityTests.shot, shots.map((s) => s.shot))));
      for (const s of shots) {
        const values = {
          filePath: pathFor(s.shot),
          imageWidth: s.imageWidth,
          imageHeight: s.imageHeight,
          landmarks: s.landmarks,
          landmarksEdited: s.landmarksEdited,
          cameraCheck: s.cameraCheck,
        };
        await tx.insert(flexibilityTests).values({ assessmentId, shot: s.shot, ...values })
          .onConflictDoUpdate({ target: [flexibilityTests.assessmentId, flexibilityTests.shot], set: values });
      }
      if (opts.freshConsent) await tx.update(postureAssessments).set({ consentAt: new Date() }).where(eq(postureAssessments.id, assessmentId));
      return old;
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => storage.remove(p)));
    throw err;
  }
  // Only after the rows point at the new photos; best effort, the save itself has succeeded.
  await Promise.allSettled(replaced.flatMap((e) => (e.filePath ? [storage.remove(e.filePath)] : [])));
  return 'saved';
}
