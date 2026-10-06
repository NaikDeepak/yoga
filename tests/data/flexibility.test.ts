import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { addAssessment } from '../helpers/posture-assessment';
import { flexShot } from '../helpers/flexibility';
import { createPatient } from '@/data/patients';
import { getFlexibility, saveFlexibilityShots } from '@/data/flexibility';
import { deletePostureAssessment, deletePosturePhotos, listPostureAssessments } from '@/data/posture';
import { flexibilityTests } from '@/db/schema';
import { FLEX_SHOTS } from '@/lib/flexibility';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;
let assessmentId: string;
const now = new Date('2026-10-06T04:30:00Z');

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  assessmentId = (await addAssessment(db, patientId, '2026-10-04', {}, storage)).id;
});

const all = () => FLEX_SHOTS.map((s) => flexShot(s));

describe('saveFlexibilityShots', () => {
  it('stores the four shots with photos under the client folder; scores are computed on read', async () => {
    const r = (await saveFlexibilityShots(db, storage, patientId, assessmentId, all()))!;
    expect(r.shots.map((s) => s.shot)).toEqual([...FLEX_SHOTS]);
    for (const s of r.shots) {
      expect(s.filePath).toMatch(new RegExp(`^patients/${patientId}/posture/${assessmentId}/flex-${s.shot}-[a-z0-9]+\\.jpg$`));
      expect(storage.files.has(s.filePath!)).toBe(true);
    }
    expect(r.scores.shoulderExtension).toMatchObject({ score: 75, band: 'flexible' });
    expect(r.scores.forwardFold).not.toBeNull();
    expect(r.scores.butterfly).not.toBeNull();
    expect(r.shots[0].measure.shoulderExtensionDeg).toBeCloseTo(45, 0);
  });

  it('a retake of one shot replaces only that shot and removes its old photo', async () => {
    const first = (await saveFlexibilityShots(db, storage, patientId, assessmentId, all()))!;
    const oldFold = first.shots.find((s) => s.shot === 'forwardFold')!.filePath!;
    const oldButterfly = first.shots.find((s) => s.shot === 'butterfly')!.filePath!;
    const r = (await saveFlexibilityShots(db, storage, patientId, assessmentId, [flexShot('forwardFold')]))!;
    const fold = r.shots.find((s) => s.shot === 'forwardFold')!;
    expect(fold.filePath).not.toBe(oldFold);
    expect(storage.files.has(oldFold)).toBe(false);
    expect(r.shots.find((s) => s.shot === 'butterfly')!.filePath).toBe(oldButterfly);
    expect(await db.select().from(flexibilityTests)).toHaveLength(4);
  });

  it("refuses another client's assessment and stores nothing", async () => {
    const otherId = (await createPatient(db, { fullName: 'Ravi Patil', mobile: '9876500000' })).id;
    const before = storage.files.size;
    expect(await saveFlexibilityShots(db, storage, otherId, assessmentId, all())).toBeNull();
    expect(storage.files.size).toBe(before);
    expect(await db.select().from(flexibilityTests)).toHaveLength(0);
  });

  it('removes uploaded photos when an upload fails part-way', async () => {
    const before = storage.files.size;
    const shots = all();
    const upload = storage.upload.bind(storage);
    let n = 0;
    storage.upload = async (path, file) => { if (++n === 3) throw new Error('storage down'); return upload(path, file); };
    await expect(saveFlexibilityShots(db, storage, patientId, assessmentId, shots)).rejects.toThrow('storage down');
    expect(storage.files.size).toBe(before);
  });
});

describe('getFlexibility', () => {
  it('is empty (all scores null) before any shots', async () => {
    const r = await getFlexibility(db, assessmentId);
    expect(r.shots).toEqual([]);
    expect(r.scores).toEqual({ shoulderExtension: null, forwardFold: null, butterfly: null });
  });
});

describe('with posture deletes', () => {
  it('withdrawing photo consent deletes flexibility photos too and keeps the scores', async () => {
    await saveFlexibilityShots(db, storage, patientId, assessmentId, all());
    expect((await listPostureAssessments(db, patientId))[0].photoCount).toBe(8); // drives the Withdraw button
    const { deleted } = await deletePosturePhotos(db, storage, patientId, now);
    expect(deleted).toBe(8); // 4 posture views + 4 flexibility shots
    const r = await getFlexibility(db, assessmentId);
    expect(r.shots.every((s) => s.filePath === null)).toBe(true);
    expect(r.scores.shoulderExtension!.score).toBe(75);
    expect((await listPostureAssessments(db, patientId))[0].photoCount).toBe(0);
    expect([...storage.files.keys()].filter((k) => k.includes('/flex-'))).toEqual([]);
  });

  it('deleting the assessment removes its flexibility rows and photos', async () => {
    await saveFlexibilityShots(db, storage, patientId, assessmentId, all());
    await deletePostureAssessment(db, storage, patientId, assessmentId);
    expect(await db.select().from(flexibilityTests).where(eq(flexibilityTests.assessmentId, assessmentId))).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });
});
