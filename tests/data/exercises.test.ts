import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import {
  listAllExercises, getPrescribedExercises, savePrescribedExercises, addPrescribedExercises, getSharedExerciseProgramme,
} from '@/data/exercises';
import { createShareLink, resolveAnyShareLink, revokeShareLinks } from '@/data/share-links';
import { saveCheckin } from '@/data/checkins';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Deshmukh', mobile: '9876543210' })).id;
});

describe('Exercises data helpers', () => {
  it('listAllExercises returns the seeded exercises', async () => {
    const list = await listAllExercises(db);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('name');
    expect(list[0]).toHaveProperty('steps');
  });

  it('getPrescribedExercises returns empty for new patient', async () => {
    const prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(0);
  });

  it('rejects duplicate exercise prescriptions for the same patient at the DB level', async () => {
    const [ex] = await listAllExercises(db);
    await expect(
      savePrescribedExercises(db, patientId, [
        { exerciseId: ex.id, customNote: null },
        { exerciseId: ex.id, customNote: null },
      ]),
    ).rejects.toThrow();
  });

  it('savePrescribedExercises saves exercise prescriptions and getPrescribedExercises returns them', async () => {
    const all = await listAllExercises(db);
    const ex1 = all[0];
    const ex2 = all[1];

    await savePrescribedExercises(db, patientId, [
      { exerciseId: ex1.id, customNote: 'Hold for 10 seconds', repetitions: '5 repetitions', daysPerWeek: '3 days a week' },
      { exerciseId: ex2.id, customNote: null },
    ]);

    const prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(2);
    expect(prescribed[0].exerciseId).toBe(ex1.id);
    expect(prescribed[0].customNote).toBe('Hold for 10 seconds');
    expect(prescribed[0].repetitionsOverride).toBe('5 repetitions');
    expect(prescribed[0].daysPerWeekOverride).toBe('3 days a week');
    expect(prescribed[1].exerciseId).toBe(ex2.id);
    expect(prescribed[1].customNote).toBeNull();
    // No override → falls back to the library default at display time
    expect(prescribed[1].repetitionsOverride).toBeNull();
    expect(prescribed[1].daysPerWeekOverride).toBeNull();
    expect(prescribed[1].repetitions).toBe(ex2.repetitions);
  });

  it('savePrescribedExercises overwrites previous selections when called again', async () => {
    const all = await listAllExercises(db);
    const ex1 = all[0];
    const ex2 = all[1];

    await savePrescribedExercises(db, patientId, [
      { exerciseId: ex1.id, customNote: 'Note 1' },
    ]);

    let prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(1);

    // Call again with a new list
    await savePrescribedExercises(db, patientId, [
      { exerciseId: ex2.id, customNote: 'Note 2' },
    ]);

    prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(1);
    expect(prescribed[0].exerciseId).toBe(ex2.id);
    expect(prescribed[0].customNote).toBe('Note 2');
  });
});

describe('addPrescribedExercises', () => {
  it('adds new exercises at library defaults and keeps existing prescriptions untouched', async () => {
    const [a, b, c] = await listAllExercises(db);
    await savePrescribedExercises(db, patientId, [{ exerciseId: a.id, repetitions: '5 reps', customNote: 'gently' }]);
    expect(await addPrescribedExercises(db, patientId, [a.id, b.id, c.id])).toEqual({ added: 2, alreadyPrescribed: 1 });
    const list = await getPrescribedExercises(db, patientId);
    expect(list).toHaveLength(3);
    const kept = list.find((e) => e.exerciseId === a.id)!;
    expect(kept).toMatchObject({ repetitionsOverride: '5 reps', customNote: 'gently' });
    expect(list.find((e) => e.exerciseId === b.id)!.repetitionsOverride).toBeNull();
  });

  it('ignores duplicates in the request and an empty list', async () => {
    const [a] = await listAllExercises(db);
    expect(await addPrescribedExercises(db, patientId, [a.id, a.id])).toEqual({ added: 1, alreadyPrescribed: 0 });
    expect(await addPrescribedExercises(db, patientId, [])).toEqual({ added: 0, alreadyPrescribed: 0 });
  });
});

describe('getSharedExerciseProgramme', () => {
  const now = new Date('2026-10-05T10:00:00Z');

  it('returns only the first name and whitelisted exercise fields, in the chosen language', async () => {
    const [a, b] = await listAllExercises(db);
    await savePrescribedExercises(db, patientId, [
      { exerciseId: a.id, customNote: 'Slowly, no pain', repetitions: '8 times', daysPerWeek: null },
      { exerciseId: b.id, customNote: null },
    ]);
    const { token } = await createShareLink(db, patientId, 'exercises', now);

    const en = await getSharedExerciseProgramme(db, (await resolveAnyShareLink(db, token, now))!, 'en', now);
    expect(Object.keys(en!).sort()).toEqual(['checkins', 'exercises', 'firstName', 'linkId']);
    expect(en!.firstName).toBe('Asha');
    expect(Object.keys(en!.exercises[0]).sort()).toEqual(
      ['daysPerWeek', 'description', 'imagePath', 'name', 'note', 'repetitions', 'steps', 'tip'],
    );
    const first = en!.exercises.find((e) => e.name === a.name)!;
    expect(first).toMatchObject({ repetitions: '8 times', daysPerWeek: a.daysPerWeek, note: 'Slowly, no pain', steps: a.steps });

    const mr = await getSharedExerciseProgramme(db, (await resolveAnyShareLink(db, token, now))!, 'mr', now);
    expect(mr!.exercises.find((e) => e.name === a.nameMr)).toMatchObject({ repetitions: '8 times', daysPerWeek: a.daysPerWeekMr, steps: a.stepsMr });
  });

  it('shows the current prescription, not a snapshot', async () => {
    const [a, b] = await listAllExercises(db);
    await savePrescribedExercises(db, patientId, [{ exerciseId: a.id, customNote: null }]);
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    await savePrescribedExercises(db, patientId, [{ exerciseId: b.id, customNote: null }]);
    expect((await getSharedExerciseProgramme(db, (await resolveAnyShareLink(db, token, now))!, 'en', now))!.exercises.map((e) => e.name)).toEqual([b.name]);
  });

  it('has no programme once the link is revoked or for a non-exercise link', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect(await resolveAnyShareLink(db, 'nope', now)).toBeNull();
    await revokeShareLinks(db, patientId, 'exercises', now);
    expect(await resolveAnyShareLink(db, token, now)).toBeNull();
    const posture = { ...(await createShareLink(db, patientId, 'exercises', now)).link, kind: 'posture' };
    expect(await getSharedExerciseProgramme(db, posture, 'en', now)).toBeNull();
  });
});

describe('getSharedExerciseProgramme check-ins', () => {
  const now = new Date('2026-10-10T04:30:00Z'); // 10 Oct in IST

  it("gives today's entry and the last 7 days' answers only — no past pain", async () => {
    const { token, link } = await createShareLink(db, patientId, 'exercises', new Date('2026-10-01T04:30:00Z'));
    await saveCheckin(db, link, { done: 'some', pain: 7 }, '2026-10-03'); // outside the 7 days
    await saveCheckin(db, link, { done: 'all', pain: 5 }, '2026-10-04');
    await saveCheckin(db, link, { done: 'none', pain: 4 }, '2026-10-08');
    await saveCheckin(db, link, { done: 'all', pain: 2 }, '2026-10-10');

    const p = await getSharedExerciseProgramme(db, (await resolveAnyShareLink(db, token, now))!, 'en', now);
    expect(p!.checkins).toEqual({
      today: { done: 'all', pain: 2 },
      last7: [{ date: '2026-10-04', done: 'all' }, { date: '2026-10-05', done: null }, { date: '2026-10-06', done: null },
        { date: '2026-10-07', done: null }, { date: '2026-10-08', done: 'none' }, { date: '2026-10-09', done: null },
        { date: '2026-10-10', done: 'all' }],
    });
    expect(JSON.stringify(p!.checkins.last7)).not.toContain('pain');
  });

  it('has no entry for today until the client saves one', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect((await getSharedExerciseProgramme(db, (await resolveAnyShareLink(db, token, now))!, 'en', now))!.checkins.today).toBeNull();
  });
});
