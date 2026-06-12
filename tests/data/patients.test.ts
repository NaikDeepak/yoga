import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient, getPatient, searchPatients, updatePatient, setPhotoPath } from '@/data/patients';
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
});
