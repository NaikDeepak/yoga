import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { addAssessment } from '../helpers/posture-assessment';
import { flexShot } from '../helpers/flexibility';
import { createPatient } from '@/data/patients';
import { getFlexibility, saveFlexibilityShots } from '@/data/flexibility';
import { latestPostureScores, listPostureAssessments } from '@/data/posture';
import { FLEX_SHOTS } from '@/lib/flexibility';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
});

async function assessed(on: string, shots = FLEX_SHOTS) {
  const a = await addAssessment(db, patientId, on, {}, storage);
  if (shots.length) await saveFlexibilityShots(db, storage, patientId, a.id, shots.map((s) => flexShot(s)));
  return a.id;
}

describe('total score in posture summaries', () => {
  it('is posture + the three flexibility scores when everything was captured', async () => {
    const id = await assessed('2026-10-04');
    const [summary] = await listPostureAssessments(db, patientId);
    const { scores } = await getFlexibility(db, id);
    expect(summary.total).toBe(summary.score! + scores.shoulderExtension!.score! + scores.forwardFold!.score! + scores.butterfly!.score!);
    expect(summary.total).toBeGreaterThan(summary.score!);
  });

  it('is null without flexibility tests, or with only some of them', async () => {
    await assessed('2026-10-01', []);
    await assessed('2026-10-02', ['shoulderExtLeft', 'shoulderExtRight', 'forwardFold']); // no butterfly
    expect((await listPostureAssessments(db, patientId)).map((s) => s.total)).toEqual([null, null]);
  });

  it('latestPostureScores carries the latest and previous totals', async () => {
    await assessed('2026-09-01');
    await assessed('2026-10-01');
    const latest = (await latestPostureScores(db, [patientId])).get(patientId)!;
    expect(latest.total).not.toBeNull();
    expect(latest.previousTotal).toBe(latest.total); // same synthetic body both times
  });

  it('previousTotal is null when the previous assessment had no flexibility tests', async () => {
    await assessed('2026-09-01', []);
    await assessed('2026-10-01');
    const latest = (await latestPostureScores(db, [patientId])).get(patientId)!;
    expect(latest.total).not.toBeNull();
    expect(latest.previousTotal).toBeNull();
  });
});
