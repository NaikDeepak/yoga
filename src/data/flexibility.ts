// Flexibility tests attached to a posture assessment (spec 2026-10-06-flexibility-tests). Photos live in
// the client's folder next to the posture photos; measures and scores are recomputed on every read.
import { and, eq } from 'drizzle-orm';
import { flexibilityTests, postureAssessments, type FlexibilityTestRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
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
 * upserts the rows in one transaction, then removes replaced photos. Any failure removes what was
 * uploaded. Returns null (and stores nothing) if the assessment isn't this client's.
 */
export async function saveFlexibilityShots(
  db: Db,
  storage: FileStorage,
  patientId: string,
  assessmentId: string,
  shots: FlexShotInput[],
): Promise<Flexibility | null> {
  const [owned] = await db.select({ id: postureAssessments.id }).from(postureAssessments)
    .where(and(eq(postureAssessments.id, assessmentId), eq(postureAssessments.patientId, patientId)));
  if (!owned) return null;

  const existing = await db.select({ shot: flexibilityTests.shot, filePath: flexibilityTests.filePath })
    .from(flexibilityTests).where(eq(flexibilityTests.assessmentId, assessmentId));
  const version = crypto.randomUUID().slice(0, 8);
  const pathFor = (s: FlexShot) => flexPhotoPath(patientId, assessmentId, s, version);
  const uploaded: string[] = [];
  try {
    for (const s of shots) {
      await storage.upload(pathFor(s.shot), s.photo);
      uploaded.push(pathFor(s.shot));
    }
    await db.transaction(async (tx) => {
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
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => storage.remove(p)));
    throw err;
  }
  // Only after the rows point at the new photos; best effort, the save itself has succeeded.
  const replaced = new Set<string>(shots.map((s) => s.shot));
  await Promise.allSettled(existing.flatMap((e) => (replaced.has(e.shot) && e.filePath ? [storage.remove(e.filePath)] : [])));
  return getFlexibility(db, assessmentId);
}
