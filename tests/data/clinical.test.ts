import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { addProblem, listProblems, removeProblem, problemsForPatients } from '@/data/problems';
import { getTreatmentPlan, upsertTreatmentPlan } from '@/data/treatment';
import { addVisit, listVisits, getFollowUpsThisWeek, getISTDateString } from '@/data/visits';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
});

describe('problems', () => {
  it('adds, lists, removes', async () => {
    const p = await addProblem(db, patientId, { problem: 'कंबर दुखी', isCustom: false });
    await addProblem(db, patientId, { problem: 'Vertigo', isCustom: true, note: 'mild' });
    expect(await listProblems(db, patientId)).toHaveLength(2);
    await removeProblem(db, p.id);
    expect((await listProblems(db, patientId)).map((x) => x.problem)).toEqual(['Vertigo']);
  });
  it('groups problems for many patients', async () => {
    await addProblem(db, patientId, { problem: 'बीपी', isCustom: false });
    const grouped = await problemsForPatients(db, [patientId]);
    expect(grouped[patientId].map((p) => p.problem)).toEqual(['बीपी']);
    expect(await problemsForPatients(db, [])).toEqual({});
  });
});

describe('treatment plan', () => {
  it('upserts a single plan per patient', async () => {
    expect(await getTreatmentPlan(db, patientId)).toBeUndefined();
    await upsertTreatmentPlan(db, patientId, { yogaProgram: 'Surya Namaskar' });
    await upsertTreatmentPlan(db, patientId, { yogaProgram: 'Surya Namaskar x12', dietPlan: 'No sugar' });
    const plan = await getTreatmentPlan(db, patientId);
    expect(plan?.yogaProgram).toBe('Surya Namaskar x12');
    expect(plan?.dietPlan).toBe('No sugar');
  });
});

describe('visits', () => {
  it('adds and lists newest-first', async () => {
    await addVisit(db, patientId, { visitDate: '2026-06-01', progressNote: 'start', weightKg: 72, painScale: 8 });
    await addVisit(db, patientId, { visitDate: '2026-06-10', progressNote: 'better', painScale: 5 });
    const all = await listVisits(db, patientId);
    expect(all).toHaveLength(2);
    expect(all[0].visitDate).toBe('2026-06-10');
    expect(all[1].weightKg).toBe(72);
  });
});

describe('getFollowUpsThisWeek', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns patient whose latest visit has nextVisitDate within 7 days', async () => {
    const tomorrow = getISTDateString(1);
    await addVisit(db, patientId, { visitDate: getISTDateString(), progressNote: 'ok', nextVisitDate: tomorrow });
    const results = await getFollowUpsThisWeek(db);
    expect(results).toHaveLength(1);
    expect(results[0].nextVisitDate).toBe(tomorrow);
    expect(results[0].mobile).toBe('9876543210');
  });

  it('excludes patient whose nextVisitDate is beyond 7 days', async () => {
    await addVisit(db, patientId, { visitDate: getISTDateString(), progressNote: 'ok', nextVisitDate: getISTDateString(10) });
    expect(await getFollowUpsThisWeek(db)).toHaveLength(0);
  });

  it('uses most recent visit — new visit without nextVisitDate clears the follow-up', async () => {
    await addVisit(db, patientId, { visitDate: '2026-06-01', progressNote: 'first', nextVisitDate: getISTDateString(1) });
    await addVisit(db, patientId, { visitDate: '2026-06-14', progressNote: 'attended' });
    expect(await getFollowUpsThisWeek(db)).toHaveLength(0);
  });
});
