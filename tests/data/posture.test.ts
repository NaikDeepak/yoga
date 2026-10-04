import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { alignedLandmarks, jpeg, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { createPatient } from '@/data/patients';
import {
  addPostureAssessment,
  listPostureAssessments,
  getPostureAssessment,
  deletePostureAssessment,
  replacePostureViews,
  type PostureViewInput,
} from '@/data/posture';
import { patients, postureAssessments, postureViews } from '@/db/schema';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;

const consentAt = new Date('2026-10-04T10:00:00Z');

function view(v: PostureView, overrides: Parameters<typeof alignedLandmarks>[1] = {}): PostureViewInput {
  return {
    view: v, photo: jpeg(), imageWidth: POSTURE_W, imageHeight: POSTURE_H,
    landmarks: alignedLandmarks(v, overrides), landmarksEdited: false,
    cameraCheck: { method: 'sensor', rollDeg: 0.4, pitchDeg: -1.2 },
  };
}

const allViews = () => POSTURE_VIEWS.map((v) => view(v));

function input(overrides: Partial<Parameters<typeof addPostureAssessment>[2]> = {}) {
  return { patientId, assessedOn: '2026-10-04', heightCm: 170, note: null, consentAt, views: allViews(), ...overrides };
}

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
});

describe('addPostureAssessment', () => {
  it('uploads one photo per view and stores the assessment with its views', async () => {
    const a = await addPostureAssessment(db, storage, input({ note: 'Baseline' }));
    expect(a).toMatchObject({ patientId, assessedOn: '2026-10-04', heightCm: 170, note: 'Baseline' });
    expect(a.views.map((v) => v.view)).toEqual(['front', 'right', 'back', 'left']);
    for (const v of a.views) {
      expect(v.filePath).toBe(`patients/${patientId}/posture/${a.id}/${v.view}.jpg`);
      expect(storage.files.has(v.filePath)).toBe(true);
      expect(v.landmarks).toHaveLength(33);
    }
  });

  it('computes metrics itself from the landmarks, using the height snapshot', async () => {
    const views = allViews();
    views[0] = view('front', { RIGHT_SHOULDER: [400, 535] });
    const a = await addPostureAssessment(db, storage, input({ views }));
    const front = a.views.find((v) => v.view === 'front')!;
    expect(front.metrics.find((m) => m.key === 'shoulderLevel')).toMatchObject({ value: 9.9, side: 'right', severity: 'marked' });
    expect(front.metrics.find((m) => m.key === 'armHang')?.unit).toBe('cm');
    const left = a.views.find((v) => v.view === 'left')!;
    expect(left.metrics.find((m) => m.key === 'forwardHead')?.value).toBe(0);
  });

  it('keeps the landmarksEdited flag per view', async () => {
    const views = allViews();
    views[2] = { ...views[2], landmarksEdited: true };
    const a = await addPostureAssessment(db, storage, input({ views }));
    expect(a.views.find((v) => v.view === 'back')?.landmarksEdited).toBe(true);
    expect(a.views.find((v) => v.view === 'front')?.landmarksEdited).toBe(false);
  });

  it('stores how the camera level was verified', async () => {
    const views = allViews();
    views[1] = { ...views[1], cameraCheck: { method: 'reference', rollDeg: -0.8, pitchDeg: null } };
    const a = await addPostureAssessment(db, storage, input({ views }));
    expect(a.views.find((v) => v.view === 'front')?.cameraCheck).toEqual({ method: 'sensor', rollDeg: 0.4, pitchDeg: -1.2 });
    expect(a.views.find((v) => v.view === 'right')?.cameraCheck).toEqual({ method: 'reference', rollDeg: -0.8, pitchDeg: null });
  });

  it('removes already-uploaded photos and inserts nothing when an upload fails part-way', async () => {
    let uploads = 0;
    const flaky = new FakeStorage();
    const realUpload = flaky.upload.bind(flaky);
    flaky.upload = async (path, file) => {
      if (++uploads === 3) throw new Error('storage down');
      return realUpload(path, file);
    };
    await expect(addPostureAssessment(db, flaky, input())).rejects.toThrow('storage down');
    expect(flaky.files.size).toBe(0);
    expect(await db.select().from(postureAssessments)).toHaveLength(0);
  });

  it('removes all photos and rolls back when the insert fails', async () => {
    const views = [view('front'), view('front')]; // violates one-row-per-view
    await expect(addPostureAssessment(db, storage, input({ views }))).rejects.toThrow();
    expect(storage.files.size).toBe(0);
    expect(await db.select().from(postureAssessments)).toHaveLength(0);
    expect(await db.select().from(postureViews)).toHaveLength(0);
  });
});

describe('listPostureAssessments', () => {
  it('returns an empty list for a client with no assessments', async () => {
    expect(await listPostureAssessments(db, patientId)).toEqual([]);
  });

  it('lists newest first with mild/marked finding counts, for that client only', async () => {
    const views = allViews();
    views[0] = view('front', { RIGHT_SHOULDER: [400, 535], LEFT_HIP: [560, 1008] }); // marked + mild
    await addPostureAssessment(db, storage, input({ assessedOn: '2026-09-01' }));
    const latest = await addPostureAssessment(db, storage, input({ assessedOn: '2026-10-04', views }));
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    await addPostureAssessment(db, storage, input({ patientId: otherId }));

    const list = await listPostureAssessments(db, patientId);
    expect(list.map((a) => a.assessedOn)).toEqual(['2026-10-04', '2026-09-01']);
    expect(list[0]).toMatchObject({ id: latest.id, markedCount: 1, mildCount: 1 });
    expect(list[1]).toMatchObject({ markedCount: 0, mildCount: 0 });
  });
});

describe('getPostureAssessment', () => {
  it('returns the assessment with views in capture order', async () => {
    const shuffled = [view('left'), view('back'), view('front'), view('right')];
    const { id } = await addPostureAssessment(db, storage, input({ views: shuffled }));
    const a = await getPostureAssessment(db, id);
    expect(a?.views.map((v) => v.view)).toEqual(['front', 'right', 'back', 'left']);
  });

  it('recomputes metrics from the stored landmarks with the current formulas', async () => {
    const { id } = await addPostureAssessment(db, storage, input());
    await db.update(postureViews).set({ metrics: [] }).where(eq(postureViews.assessmentId, id)); // simulate stale snapshot
    const a = await getPostureAssessment(db, id);
    expect(a!.views[0].metrics.find((m) => m.key === 'shoulderLevel')).toMatchObject({ value: 0, severity: 'normal' });
    const views = allViews();
    views[0] = view('front', { RIGHT_SHOULDER: [400, 535] });
    const marked = await addPostureAssessment(db, storage, input({ views }));
    await db.update(postureViews).set({ metrics: [] }).where(eq(postureViews.assessmentId, marked.id));
    const [summary] = await listPostureAssessments(db, patientId);
    expect(summary).toMatchObject({ id: marked.id, markedCount: 1 });
  });

  it('returns null for an unknown id', async () => {
    expect(await getPostureAssessment(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('deletePostureAssessment', () => {
  it('deletes the assessment, its views and photos', async () => {
    const { id } = await addPostureAssessment(db, storage, input());
    await deletePostureAssessment(db, storage, patientId, id);
    expect(await db.select().from(postureAssessments)).toHaveLength(0);
    expect(await db.select().from(postureViews)).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });

  it('ignores an unknown id', async () => {
    await expect(deletePostureAssessment(db, storage, patientId, '00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
  });

  it("does not delete another client's assessment", async () => {
    const { id } = await addPostureAssessment(db, storage, input());
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    await deletePostureAssessment(db, storage, otherId, id);
    expect(await getPostureAssessment(db, id)).not.toBeNull();
    expect(storage.files.size).toBe(4);
  });

  it('is removed with the client (cascade)', async () => {
    await addPostureAssessment(db, storage, input());
    await db.delete(patients).where(eq(patients.id, patientId));
    expect(await db.select().from(postureViews)).toHaveLength(0);
  });
});

describe('replacePostureViews', () => {
  it('replaces only the retaken views: new photo, landmarks, metrics and camera check', async () => {
    const a = await addPostureAssessment(db, storage, input());
    const oldBack = a.views.find((v) => v.view === 'back')!;
    const oldFront = a.views.find((v) => v.view === 'front')!;
    const retake = { ...view('back', { RIGHT_SHOULDER: [400, 535] }), cameraCheck: { method: 'sensor' as const, rollDeg: -0.3, pitchDeg: 0.5 } };

    const updated = await replacePostureViews(db, storage, patientId, a.id, [retake]);
    const back = updated!.views.find((v) => v.view === 'back')!;
    expect(back.filePath).not.toBe(oldBack.filePath);
    expect(back.filePath).toMatch(new RegExp(`^patients/${patientId}/posture/${a.id}/back-[a-z0-9]+\\.jpg$`));
    expect(storage.files.has(back.filePath)).toBe(true);
    expect(storage.files.has(oldBack.filePath)).toBe(false);
    expect(back.cameraCheck).toEqual({ method: 'sensor', rollDeg: -0.3, pitchDeg: 0.5 });
    expect(back.metrics.find((m) => m.key === 'shoulderLevel')?.value).toBeGreaterThan(0);
    expect(updated!.views.find((v) => v.view === 'front')).toMatchObject({ filePath: oldFront.filePath });
    expect(storage.files.size).toBe(4);
  });

  it("returns null and changes nothing for another client's assessment", async () => {
    const a = await addPostureAssessment(db, storage, input());
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    expect(await replacePostureViews(db, storage, otherId, a.id, [view('back')])).toBeNull();
    expect(storage.files.size).toBe(4);
    expect((await getPostureAssessment(db, a.id))!.views.map((v) => v.filePath)).toEqual(a.views.map((v) => v.filePath));
  });

  it('keeps the old photos and removes new uploads when an upload fails', async () => {
    const a = await addPostureAssessment(db, storage, input());
    let uploads = 0;
    const realUpload = storage.upload.bind(storage);
    storage.upload = async (path, file) => {
      if (++uploads === 2) throw new Error('storage down');
      return realUpload(path, file);
    };
    await expect(replacePostureViews(db, storage, patientId, a.id, [view('front'), view('back')])).rejects.toThrow('storage down');
    expect([...storage.files.keys()].sort()).toEqual(a.views.map((v) => v.filePath).sort());
  });

  it('deletes retaken photos along with the assessment', async () => {
    const a = await addPostureAssessment(db, storage, input());
    await replacePostureViews(db, storage, patientId, a.id, [view('left')]);
    await deletePostureAssessment(db, storage, patientId, a.id);
    expect(storage.files.size).toBe(0);
  });
});
