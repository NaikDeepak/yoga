import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { savePrescribedExercisesAction } from '@/actions/exercises';
import { listAllExercises, getPrescribedExercises } from '@/data/exercises';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Deshmukh', mobile: '9876543210' })).id;
});

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('savePrescribedExercisesAction', () => {
  it('saves prescribed exercises successfully', async () => {
    const all = await listAllExercises(db);
    const ex1 = all[0];
    const ex2 = all[1];
    const payload = JSON.stringify([
      { exerciseId: ex1.id, customNote: 'Do it slowly', repetitions: '10 repetitions', daysPerWeek: '5 days a week' },
      { exerciseId: ex2.id, customNote: null },
    ]);

    const result = await savePrescribedExercisesAction(patientId, fd({ prescribedExercisesJson: payload }));
    expect(result).toEqual({ ok: true });

    const prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(2);
    expect(prescribed[0].exerciseId).toBe(ex1.id);
    expect(prescribed[0].customNote).toBe('Do it slowly');
    expect(prescribed[0].repetitionsOverride).toBe('10 repetitions');
    expect(prescribed[0].daysPerWeekOverride).toBe('5 days a week');
    expect(prescribed[1].exerciseId).toBe(ex2.id);
    expect(prescribed[1].customNote).toBeNull();
    expect(prescribed[1].repetitionsOverride).toBeNull();
  });

  it('saves empty list if json field is empty or missing', async () => {
    const result = await savePrescribedExercisesAction(patientId, fd({}));
    expect(result).toEqual({ ok: true });

    const prescribed = await getPrescribedExercises(db, patientId);
    expect(prescribed).toHaveLength(0);
  });

  it('returns error if json is invalid or does not match schema', async () => {
    const badPayload = JSON.stringify([
      { exerciseId: 'not-a-uuid', customNote: 'Bad' },
    ]);

    const result = await savePrescribedExercisesAction(patientId, fd({ prescribedExercisesJson: badPayload }));
    expect(result).toMatchObject({ ok: false });
  });
});
