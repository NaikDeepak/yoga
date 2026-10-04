import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { revalidatePath } from 'next/cache';
import { savePrescribedExercisesAction, addPrescribedExercisesAction } from '@/actions/exercises';
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

describe('addPrescribedExercisesAction', () => {
  it('adds exercises to the prescription and reports how many were new', async () => {
    const [a, b] = await listAllExercises(db);
    vi.mocked(revalidatePath).mockClear();
    expect(await addPrescribedExercisesAction(patientId, [a.id, b.id])).toEqual({ ok: true, added: 2, alreadyPrescribed: 0 });
    expect(await addPrescribedExercisesAction(patientId, [a.id])).toEqual({ ok: true, added: 0, alreadyPrescribed: 1 });
    expect(await getPrescribedExercises(db, patientId)).toHaveLength(2);
    expect(revalidatePath).toHaveBeenCalledWith(`/patients/${patientId}`);
  });

  it('rejects bad input', async () => {
    const msg = { ok: false, error: 'Invalid exercise selection / अमान्य व्यायाम निवड' };
    expect(await addPrescribedExercisesAction(patientId, [])).toEqual(msg);
    expect(await addPrescribedExercisesAction(patientId, ['not-a-uuid'])).toEqual(msg);
    expect(await addPrescribedExercisesAction('', ['00000000-0000-0000-0000-000000000000'])).toEqual(msg);
  });

  it('reports a failure (e.g. unknown exercise id) without throwing', async () => {
    expect(await addPrescribedExercisesAction(patientId, ['00000000-0000-0000-0000-000000000000'])).toEqual({
      ok: false, error: 'Failed to save / जतन करण्यात अयशस्वी',
    });
  });
});
