import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { listAllExercises, getPrescribedExercises, savePrescribedExercises } from '@/data/exercises';
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
