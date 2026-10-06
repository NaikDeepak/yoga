import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { addAssessment } from '../helpers/posture-assessment';
import { requireUser } from '@/lib/auth';
import { deletePatientAction } from '@/actions/patients';
import { withdrawPhotoConsentAction } from '@/actions/posture';
import { createPatient, getPatient } from '@/data/patients';
import { getPostureAssessment } from '@/data/posture';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
});

describe('deletePatientAction', () => {
  it('refuses unless the typed name matches the client', async () => {
    expect(await deletePatientAction(patientId, 'Asha')).toMatchObject({ ok: false });
    expect(await deletePatientAction(patientId, '')).toMatchObject({ ok: false });
    expect(await getPatient(db, patientId)).toBeDefined();
  });

  it('deletes the client and their files, then goes to the client list (name match ignores case and spaces)', async () => {
    await addAssessment(db, patientId, '2026-10-04', {}, storage);
    await expect(deletePatientAction(patientId, '  asha KULKARNI ')).rejects.toThrow('REDIRECT:/patients');
    expect(await getPatient(db, patientId)).toBeUndefined();
    expect(storage.files.size).toBe(0);
  });

  it('reports a storage failure and keeps the client', async () => {
    storage.failNextRemovePrefix = true;
    expect(await deletePatientAction(patientId, 'Asha Kulkarni')).toMatchObject({ ok: false });
    expect(await getPatient(db, patientId)).toBeDefined();
  });

  it('rejects an invalid or unknown client id', async () => {
    expect(await deletePatientAction('not-a-uuid', 'x')).toMatchObject({ ok: false });
    expect(await deletePatientAction('00000000-0000-4000-8000-000000000000', 'x')).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(deletePatientAction(patientId, 'Asha Kulkarni')).rejects.toThrow('REDIRECT:/login');
    expect(await getPatient(db, patientId)).toBeDefined();
  });
});

describe('withdrawPhotoConsentAction', () => {
  it("deletes the client's posture photos and keeps the assessments", async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    expect(await withdrawPhotoConsentAction(patientId)).toEqual({ ok: true, deleted: 4 });
    const after = (await getPostureAssessment(db, a.id))!;
    expect(after.views.every((v) => v.filePath === null)).toBe(true);
    expect(after.photosDeletedAt).not.toBeNull();
  });

  it('reports photos it could not delete as an error (the physio can retry)', async () => {
    const a = await addAssessment(db, patientId, '2026-10-04', {}, storage);
    storage.failRemove.add(a.views[0].filePath!);
    expect(await withdrawPhotoConsentAction(patientId)).toMatchObject({ ok: false, error: expect.stringContaining('1') });
    storage.failRemove.clear();
  });

  it('rejects an invalid client id', async () => {
    expect(await withdrawPhotoConsentAction('nope')).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    await addAssessment(db, patientId, '2026-10-04', {}, storage);
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(withdrawPhotoConsentAction(patientId)).rejects.toThrow('REDIRECT:/login');
    expect(storage.files.size).toBe(4);
  });
});
