import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { requireUser } from '@/lib/auth';
import {
  createExerciseShareLinkAction,
  createPostureShareLinkAction,
  createProgressShareLinkAction,
  recordNudgeAction,
  revokeExerciseShareLinkAction,
  revokePostureShareLinkAction,
  revokeProgressShareLinkAction,
} from '@/actions/share-links';
import { featureOffError } from '@/lib/feature-off';
import { addAssessment } from '../helpers/posture-assessment';
import { addVisit } from '@/data/visits';
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

afterEach(() => {
  vi.unstubAllEnvs();
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

  it('refuses when shareLinks is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    expect(await createExerciseShareLinkAction(patientId)).toEqual(featureOffError('shareLinks'));
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(createExerciseShareLinkAction(patientId)).rejects.toThrow('REDIRECT:/login');
  });
});

describe('createPostureShareLinkAction feature switches', () => {
  it('refuses when shareLinks is switched off', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    expect(await createPostureShareLinkAction(a.id, false)).toEqual(featureOffError('shareLinks'));
  });

  it('refuses with featureOffError("posture") when posture is switched off', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    vi.stubEnv('FEATURE_POSTURE', 'false');
    expect(await createPostureShareLinkAction(a.id, false)).toEqual(featureOffError('posture'));
  });
});

describe('createProgressShareLinkAction feature switches', () => {
  it('refuses when shareLinks is switched off', async () => {
    await addVisit(db, patientId, { visitDate: '2026-10-01', progressNote: 'Visit 1', painScale: 4 });
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    expect(await createProgressShareLinkAction(patientId, { hideWeight: false })).toEqual(featureOffError('shareLinks'));
  });
});

describe('revoke actions when shareLinks is switched off', () => {
  it('allows revoking exercise, posture and progress links', async () => {
    await createExerciseShareLinkAction(patientId);
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    await createPostureShareLinkAction(a.id, false);
    await addVisit(db, patientId, { visitDate: '2026-10-01', progressNote: 'Visit 1', painScale: 4 });
    await createProgressShareLinkAction(patientId, { hideWeight: false });

    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    expect(await revokeExerciseShareLinkAction(patientId)).toEqual({ ok: true });
    expect(await revokePostureShareLinkAction(patientId)).toEqual({ ok: true });
    expect(await revokeProgressShareLinkAction(patientId)).toEqual({ ok: true });
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

  it('refuses and writes nothing when shareLinks is switched off', async () => {
    await createExerciseShareLinkAction(patientId);
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    expect(await recordNudgeAction(patientId)).toEqual(featureOffError('shareLinks'));
    expect((await activeShareLink(db, patientId, 'exercises', new Date()))?.nudgedAt).toBeNull();
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
