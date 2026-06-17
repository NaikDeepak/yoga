import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient, getPatient, searchPatients, updatePatient, setPhotoPath, countPatients } from '@/data/patients';
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
});
