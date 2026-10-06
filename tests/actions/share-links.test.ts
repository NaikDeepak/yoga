import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { requireUser } from '@/lib/auth';
import { createExerciseShareLinkAction, recordNudgeAction, revokeExerciseShareLinkAction } from '@/actions/share-links';
import { listAllExercises, savePrescribedExercises, getSharedExerciseProgramme } from '@/data/exercises';
import { activeShareLink, resolveAnyShareLink } from '@/data/share-links';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'clinic.test', 'x-forwarded-proto': 'https' }),
}));

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  const [ex] = await listAllExercises(db);
  await savePrescribedExercises(db, patientId, [{ exerciseId: ex.id, customNote: null }]);
});

describe('createExerciseShareLinkAction', () => {
  it('returns a working link and a WhatsApp link without the client name', async () => {
    const r = await createExerciseShareLinkAction(patientId);
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toMatch(/^https:\/\/clinic\.test\/s\/[A-Za-z0-9_-]{43}$/);
    expect(r.whatsappUrl).toContain('phone=919876543210');
    expect(decodeURIComponent(r.whatsappUrl)).toContain(r.url);
    expect(decodeURIComponent(r.whatsappUrl)).not.toMatch(/Asha|Kulkarni/);
    const token = r.url.split('/s/')[1];
    const link = await resolveAnyShareLink(db, token, new Date());
    expect(link && await getSharedExerciseProgramme(db, link, 'en', new Date())).not.toBeNull();
  });

  it('refuses a client with no prescribed exercises', async () => {
    await savePrescribedExercises(db, patientId, []);
    expect(await createExerciseShareLinkAction(patientId)).toMatchObject({ ok: false });
  });

  it('rejects an invalid or unknown client id', async () => {
    expect(await createExerciseShareLinkAction('not-a-uuid')).toMatchObject({ ok: false });
    expect(await createExerciseShareLinkAction('00000000-0000-4000-8000-000000000000')).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(createExerciseShareLinkAction(patientId)).rejects.toThrow('REDIRECT:/login');
  });
});

describe('revokeExerciseShareLinkAction', () => {
  it('stops the active link', async () => {
    await createExerciseShareLinkAction(patientId);
    expect(await activeShareLink(db, patientId, 'exercises', new Date())).not.toBeNull();
    expect(await revokeExerciseShareLinkAction(patientId)).toEqual({ ok: true });
    expect(await activeShareLink(db, patientId, 'exercises', new Date())).toBeNull();
  });
});

describe('recordNudgeAction', () => {
  it('stamps the live exercise link', async () => {
    await createExerciseShareLinkAction(patientId);
    expect(await recordNudgeAction(patientId)).toEqual({ ok: true });
    expect((await activeShareLink(db, patientId, 'exercises', new Date()))?.nudgedAt).toBeInstanceOf(Date);
  });

  it('fails without a live link, or for an invalid id', async () => {
    expect(await recordNudgeAction(patientId)).toMatchObject({ ok: false });
    expect(await recordNudgeAction('nope')).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(recordNudgeAction(patientId)).rejects.toThrow('REDIRECT:/login');
  });
});
