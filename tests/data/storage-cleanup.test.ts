import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { addAssessment } from '../helpers/posture-assessment';
import { alignedLandmarks, jpeg, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { createPatient, deletePatientAndFiles, getPatient, setPhotoPath } from '@/data/patients';
import { addDocument } from '@/data/documents';
import { addVisit } from '@/data/visits';
import {
  deletePosturePhotos, deletePostureAssessment, getPostureAssessment, listPostureAssessments, replacePostureViews,
} from '@/data/posture';
import { createShareLink, resolveAnyShareLink } from '@/data/share-links';
import { getSharedPostureReport } from '@/data/shared-posture';
import { patients, postureAssessments, postureViews, shareLinks, visits } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;
let otherId: string;
const now = new Date('2026-10-06T04:30:00Z');
const pdf = () => new File([new Uint8Array([1])], 'scan.pdf', { type: 'application/pdf' });

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  otherId = (await createPatient(db, { fullName: 'Ravi Patil', mobile: '9876500000' })).id;
});

async function fillClient(id: string) {
  await storage.upload(`patients/${id}/photo-1-old.jpg`, pdf()); // replaced profile photo, never cleaned up
  await storage.upload(`patients/${id}/photo-2.jpg`, pdf());
  await setPhotoPath(db, id, `patients/${id}/photo-2.jpg`);
  await addDocument(db, storage, { patientId: id, docType: 'MRI', file: pdf() });
  await addAssessment(db, id, '2026-10-04', {}, storage);
  await addVisit(db, id, { visitDate: '2026-10-01', progressNote: 'note' });
}

describe('deletePatientAndFiles', () => {
  it("deletes the client's rows and every file in their folder, including orphans; other clients untouched", async () => {
    await fillClient(patientId);
    await fillClient(otherId);
    const otherFiles = [...storage.files.keys()].filter((k) => k.startsWith(`patients/${otherId}/`));
    expect([...storage.files.keys()].filter((k) => k.startsWith(`patients/${patientId}/`))).toHaveLength(7); // 2 photos + doc + 4 views

    expect(await deletePatientAndFiles(db, storage, patientId)).toEqual({ deleted: true, filesRemoved: 7 });

    expect(await getPatient(db, patientId)).toBeUndefined();
    expect(await db.select().from(visits).where(eq(visits.patientId, patientId))).toHaveLength(0);
    expect(await db.select().from(postureAssessments).where(eq(postureAssessments.patientId, patientId))).toHaveLength(0);
    expect([...storage.files.keys()].filter((k) => k.startsWith(`patients/${patientId}/`))).toEqual([]);
    expect([...storage.files.keys()].filter((k) => k.startsWith(`patients/${otherId}/`))).toEqual(otherFiles);
  });

  it('stops their share links at once', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    await deletePatientAndFiles(db, storage, patientId);
    expect(await resolveAnyShareLink(db, token, now)).toBeNull();
    expect(await db.select().from(shareLinks)).toHaveLength(0);
  });

  it('keeps the client (so the physio can retry) when the files could not be deleted', async () => {
    await fillClient(patientId);
    storage.failNextRemovePrefix = true;
    await expect(deletePatientAndFiles(db, storage, patientId)).rejects.toThrow('storage down');
    expect(await db.select().from(patients).where(eq(patients.id, patientId))).toHaveLength(1);
    expect(await deletePatientAndFiles(db, storage, patientId)).toEqual({ deleted: true, filesRemoved: 7 }); // retry
  });

  it('reports nothing deleted for an unknown client and touches no files', async () => {
    await fillClient(otherId);
    const before = storage.files.size;
    expect(await deletePatientAndFiles(db, storage, '00000000-0000-4000-8000-000000000000'))
      .toEqual({ deleted: false, filesRemoved: 0 });
    expect(storage.files.size).toBe(before);
  });
});

describe('deletePosturePhotos (consent withdrawn)', () => {
  it("deletes every posture photo of the client, keeps points/metrics/scores, and stamps the assessments", async () => {
    const a1 = await addAssessment(db, patientId, '2026-09-01', {}, storage);
    const a2 = await addAssessment(db, patientId, '2026-10-04', { front: { RIGHT_SHOULDER: [400, 535] } }, storage);
    const theirs = await addAssessment(db, otherId, '2026-10-04', {}, storage);
    const before = await getPostureAssessment(db, a2.id);

    expect(await deletePosturePhotos(db, storage, patientId, now)).toEqual({ deleted: 8, failed: 0 });

    for (const id of [a1.id, a2.id]) {
      const a = (await getPostureAssessment(db, id))!;
      expect(a.photosDeletedAt).toEqual(now);
      expect(a.views.every((v) => v.filePath === null)).toBe(true);
      expect(a.views).toHaveLength(4);
    }
    const after = (await getPostureAssessment(db, a2.id))!;
    expect(after.views.map((v) => v.metrics)).toEqual(before!.views.map((v) => v.metrics));
    expect(after.views.map((v) => v.landmarks)).toEqual(before!.views.map((v) => v.landmarks));
    expect((await listPostureAssessments(db, patientId)).map((s) => s.score)).not.toContain(null);
    expect([...storage.files.keys()].filter((k) => k.startsWith(`patients/${patientId}/`))).toEqual([]);
    expect((await getPostureAssessment(db, theirs.id))!.views.every((v) => v.filePath && storage.files.has(v.filePath))).toBe(true);
  });

  it('turns photos off on their posture share link; the client page shows figures without photos', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    const { token } = await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a.id, includePhotos: true });
    await deletePosturePhotos(db, storage, patientId, now);
    const link = (await resolveAnyShareLink(db, token, now))!;
    expect(link.includePhotos).toBe(false);
    const r = (await getSharedPostureReport(db, storage, link))!;
    expect(r.photosShared).toBe(false);
    expect(r.views.every((v) => v.photoUrl === null && v.overlay)).toBe(true);
  });

  it('keeps the path of a photo it could not delete, so a retry finishes the job', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    const front = a.views.find((v) => v.view === 'front')!.filePath!;
    storage.failRemove.add(front);
    expect(await deletePosturePhotos(db, storage, patientId, now)).toEqual({ deleted: 3, failed: 1 });
    const after = (await getPostureAssessment(db, a.id))!;
    expect(after.views.filter((v) => v.filePath !== null).map((v) => v.filePath)).toEqual([front]);
    expect(storage.files.has(front)).toBe(true);
    storage.failRemove.clear();
    expect(await deletePosturePhotos(db, storage, patientId, now)).toEqual({ deleted: 1, failed: 0 });
    expect(storage.files.has(front)).toBe(false);
  });

  it('leaves a view alone if it was retaken while the photos were being deleted', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    const back = a.views.find((v) => v.view === 'back')!;
    const retaken = `patients/${patientId}/posture/${a.id}/back-new.jpg`;
    const remove = storage.remove.bind(storage);
    storage.remove = async (path: string) => {
      await remove(path);
      if (path === back.filePath) { // a retake lands mid-withdrawal (fresh consent, new photo)
        await storage.upload(retaken, jpeg());
        await db.update(postureViews).set({ filePath: retaken }).where(eq(postureViews.id, back.id));
      }
    };
    expect(await deletePosturePhotos(db, storage, patientId, now)).toEqual({ deleted: 4, failed: 0 });
    const after = (await getPostureAssessment(db, a.id))!;
    expect(after.views.find((v) => v.view === 'back')!.filePath).toBe(retaken);
    expect(after.views.filter((v) => v.filePath === null)).toHaveLength(3);
  });

  it('is a no-op the second time', async () => {
    await addAssessment(db, patientId, '2026-10-04', {}, storage);
    await deletePosturePhotos(db, storage, patientId, now);
    expect(await deletePosturePhotos(db, storage, patientId, new Date('2026-10-07T00:00:00Z'))).toEqual({ deleted: 0, failed: 0 });
    const [a] = await listPostureAssessments(db, patientId);
    expect(a.photosDeletedAt).toEqual(now); // first withdrawal date kept
  });

  it('a retake afterwards stores the new photo (fresh consent) while the others stay deleted', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    await deletePosturePhotos(db, storage, patientId, now);
    const updated = (await replacePostureViews(db, storage, patientId, a.id, [{
      view: 'back', photo: jpeg(), imageWidth: POSTURE_W, imageHeight: POSTURE_H,
      landmarks: alignedLandmarks('back'), landmarksEdited: false, cameraCheck: null,
    }]))!;
    const back = updated.views.find((v) => v.view === 'back')!;
    expect(back.filePath && storage.files.has(back.filePath)).toBe(true);
    expect(updated.views.filter((v) => v.filePath === null)).toHaveLength(3);
  });

  it('deleting an assessment whose photos are gone still works', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    await deletePosturePhotos(db, storage, patientId, now);
    await deletePostureAssessment(db, storage, patientId, a.id);
    expect(await getPostureAssessment(db, a.id)).toBeNull();
  });
});
