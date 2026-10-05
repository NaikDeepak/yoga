import { FakeStorage } from './fake-storage';
import { alignedLandmarks, jpeg, POSTURE_W, POSTURE_H } from './posture';
import { addPostureAssessment } from '@/data/posture';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import type { Db } from '@/db/types';

type Overrides = Partial<Record<PostureView, Parameters<typeof alignedLandmarks>[1]>>;

/** A saved 4-view assessment (with a private physio note) for tests that need one. */
export function addAssessment(db: Db, patientId: string, assessedOn = '2026-10-04', overrides: Overrides = {}, storage = new FakeStorage()) {
  return addPostureAssessment(db, storage, {
    patientId, assessedOn, heightCm: 160, note: 'private physio note', consentAt: new Date('2026-10-04T10:00:00Z'),
    views: POSTURE_VIEWS.map((v) => ({
      view: v, photo: jpeg(), imageWidth: POSTURE_W, imageHeight: POSTURE_H,
      landmarks: alignedLandmarks(v, overrides[v]), landmarksEdited: false, cameraCheck: null,
    })),
  });
}
