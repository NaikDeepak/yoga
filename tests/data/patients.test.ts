import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { createPatient, getPatient, searchPatients, updatePatient, setPhotoPath, countPatients, replacePatientPhoto } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const asha = { fullName: 'Asha Pawar', mobile: '9876543210' };

describe('createPatient', () => {
  it('assigns sequential codes', async () => {
    const p1 = await createPatient(db, asha);
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    expect(p1.patientCode).toBe('PYT-0001');
    expect(p2.patientCode).toBe('PYT-0002');
  });
});

describe('getPatient / updatePatient', () => {
  it('round-trips and updates', async () => {
    const p = await createPatient(db, asha);
    expect((await getPatient(db, p.id))?.fullName).toBe('Asha Pawar');
    await updatePatient(db, p.id, { ...asha, weightKg: 68 });
    expect((await getPatient(db, p.id))?.weightKg).toBe(68);
  });
  it('returns undefined for unknown id', async () => {
    expect(await getPatient(db, '00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });
});

describe('setPhotoPath', () => {
  it('stores the storage path', async () => {
    const p = await createPatient(db, asha);
    await setPhotoPath(db, p.id, 'patients/x/photo.jpg');
    expect((await getPatient(db, p.id))?.photoPath).toBe('patients/x/photo.jpg');
  });
});

describe('searchPatients', () => {
  it('matches name (case-insensitive) and mobile, newest first', async () => {
    await createPatient(db, asha);
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });
    expect(await searchPatients(db, 'asha')).toHaveLength(1);
    expect(await searchPatients(db, '90000')).toHaveLength(1);
    expect(await searchPatients(db, '')).toHaveLength(2);
    expect((await searchPatients(db)).map((p) => p.fullName)).toContain('Asha Pawar');
  });

  it('matches patient code', async () => {
    const p = await createPatient(db, asha);
    expect(await searchPatients(db, p.patientCode)).toHaveLength(1);
  });

  it('respects limit', async () => {
    await createPatient(db, asha);
    await createPatient(db, { fullName: 'Asha Two', mobile: '9876543211' });
    expect(await searchPatients(db, 'asha', 1)).toHaveLength(1);
  });
});

describe('searchPatients with offset', () => {
  it('skips the first N results', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Asha Two', mobile: '9000000002' });
    await createPatient(db, { fullName: 'Asha Three', mobile: '9000000003' });
    const page2 = await searchPatients(db, 'asha', 2, 2);
    expect(page2).toHaveLength(1);
  });
});

describe('countPatients', () => {
  it('returns total when no filter', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000002' });
    expect(await countPatients(db)).toBe(2);
  });

  it('filters by search query', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001' });
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000002' });
    expect(await countPatients(db, undefined, 'asha')).toBe(1);
    expect(await countPatients(db, undefined, 'ravi')).toBe(1);
    expect(await countPatients(db, undefined, 'nobody')).toBe(0);
  });

  it('filters by both branch and search query', async () => {
    await createPatient(db, { fullName: 'Asha Pawar', mobile: '9000000001', branch: 'kop' });
    await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000002', branch: 'kop' });
    await createPatient(db, { fullName: 'Asha Joshi', mobile: '9000000003', branch: 'pune' });
    expect(await countPatients(db, 'kop', 'asha')).toBe(1);
    expect(await countPatients(db, 'kop', 'joshi')).toBe(1);
    expect(await countPatients(db, 'pune', 'asha')).toBe(1);
    expect(await countPatients(db, 'pune', 'joshi')).toBe(1);
    expect(await countPatients(db, 'pune', 'ravi')).toBe(0);
  });
});

describe('replacePatientPhoto', () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('stores and sets the first photo', async () => {
    const p = await createPatient(db, asha);
    const file = new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' });
    const res = await replacePatientPhoto(db, storage, p.id, file);

    expect(res.photoPath).toMatch(new RegExp(`^patients/${p.id}/photo-\\d+-avatar\\.png$`));
    const updated = await getPatient(db, p.id);
    expect(updated?.photoPath).toBe(res.photoPath);
    expect(storage.files.has(res.photoPath)).toBe(true);
  });

  it('deletes old file and keeps new one when replacing', async () => {
    const p = await createPatient(db, asha);
    const file1 = new File([new Uint8Array([1])], 'one.png', { type: 'image/png' });
    const res1 = await replacePatientPhoto(db, storage, p.id, file1);
    expect(storage.files.has(res1.photoPath)).toBe(true);

    const file2 = new File([new Uint8Array([2])], 'two.png', { type: 'image/png' });
    const res2 = await replacePatientPhoto(db, storage, p.id, file2);

    expect(res2.photoPath).not.toBe(res1.photoPath);
    expect(storage.files.has(res1.photoPath)).toBe(false);
    expect(storage.files.has(res2.photoPath)).toBe(true);
    const updated = await getPatient(db, p.id);
    expect(updated?.photoPath).toBe(res2.photoPath);
  });

  it('still succeeds if removing old file fails, and row points at new one', async () => {
    const p = await createPatient(db, asha);
    const file1 = new File([new Uint8Array([1])], 'one.png', { type: 'image/png' });
    const res1 = await replacePatientPhoto(db, storage, p.id, file1);

    storage.failRemove.add(res1.photoPath);

    const file2 = new File([new Uint8Array([2])], 'two.png', { type: 'image/png' });
    const res2 = await replacePatientPhoto(db, storage, p.id, file2);

    expect(res2.photoPath).toBeDefined();
    expect(storage.files.has(res2.photoPath)).toBe(true);
    const updated = await getPatient(db, p.id);
    expect(updated?.photoPath).toBe(res2.photoPath);
  });

  it('removes newly uploaded file and throws if DB update fails', async () => {
    const p = await createPatient(db, asha);
    const failingDb = {
      ...db,
      transaction: vi.fn().mockRejectedValue(new Error('db write error')),
    } as unknown as Db;
    const file = new File([new Uint8Array([1])], 'fail.png', { type: 'image/png' });

    await expect(replacePatientPhoto(failingDb, storage, p.id, file)).rejects.toThrow('db write error');
    expect(storage.files.size).toBe(0);
  });

  it('leaves another client’s photo untouched', async () => {
    const p1 = await createPatient(db, asha);
    const p2 = await createPatient(db, { fullName: 'Ravi Joshi', mobile: '9000000001' });

    const file1 = new File([new Uint8Array([1])], 'asha.png', { type: 'image/png' });
    const res1 = await replacePatientPhoto(db, storage, p1.id, file1);

    const file2 = new File([new Uint8Array([2])], 'ravi.png', { type: 'image/png' });
    const res2 = await replacePatientPhoto(db, storage, p2.id, file2);

    const file3 = new File([new Uint8Array([3])], 'asha2.png', { type: 'image/png' });
    const res3 = await replacePatientPhoto(db, storage, p1.id, file3);

    expect(storage.files.has(res1.photoPath)).toBe(false);
    expect(storage.files.has(res3.photoPath)).toBe(true);
    expect(storage.files.has(res2.photoPath)).toBe(true);

    const p2After = await getPatient(db, p2.id);
    expect(p2After?.photoPath).toBe(res2.photoPath);
  });

  it('unknown client: upload removed, throws', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const file = new File([new Uint8Array([1])], 'missing.png', { type: 'image/png' });

    await expect(replacePatientPhoto(db, storage, missingId, file)).rejects.toThrow();
    expect(storage.files.size).toBe(0);
  });
});

