import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { addCharge, listCharges, getCharge, deleteCharge } from '@/data/charges';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const PATIENT = { fullName: 'Asha Pawar', mobile: '9876543210' };

describe('addCharge', () => {
  it('inserts a charge and returns it', async () => {
    const p = await createPatient(db, PATIENT);
    const charge = await addCharge(db, p.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    expect(charge.feeType).toBe('consultation');
    expect(charge.label).toBe('Consultation Fee / सल्ला शुल्क');
    expect(charge.amount).toBe(500);
    expect(charge.chargeDate).toBe('2026-08-10');
    expect(charge.note).toBeNull();
  });

  it('stores an optional note', async () => {
    const p = await createPatient(db, PATIENT);
    const charge = await addCharge(db, p.id, 'other', 'Late fee / विलंब शुल्क', 100, '2026-08-10', 'For missed session');
    expect(charge.note).toBe('For missed session');
  });
});

describe('listCharges', () => {
  it('returns empty array for a patient with no charges', async () => {
    const p = await createPatient(db, PATIENT);
    expect(await listCharges(db, p.id)).toEqual([]);
  });

  it('returns charges newest-first by chargeDate', async () => {
    const p = await createPatient(db, PATIENT);
    await addCharge(db, p.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-01', null);
    await addCharge(db, p.id, 'monthly_yoga', 'Monthly Yoga Fee / मासिक योग शुल्क', 3000, '2026-08-10', null);
    const charges = await listCharges(db, p.id);
    expect(charges.map((c) => c.chargeDate)).toEqual(['2026-08-10', '2026-08-01']);
  });

  it('only returns charges for the given patient', async () => {
    const p1 = await createPatient(db, PATIENT);
    const p2 = await createPatient(db, { fullName: 'Other Patient', mobile: '9876500000' });
    await addCharge(db, p1.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    expect(await listCharges(db, p2.id)).toEqual([]);
  });
});

describe('getCharge', () => {
  it('returns the charge when it belongs to the patient', async () => {
    const p = await createPatient(db, PATIENT);
    const created = await addCharge(db, p.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    const found = await getCharge(db, p.id, created.id);
    expect(found?.id).toBe(created.id);
  });

  it('returns null when the charge belongs to a different patient', async () => {
    const p1 = await createPatient(db, PATIENT);
    const p2 = await createPatient(db, { fullName: 'Other Patient', mobile: '9876500000' });
    const created = await addCharge(db, p1.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    expect(await getCharge(db, p2.id, created.id)).toBeNull();
  });

  it('returns null for a non-existent id', async () => {
    const p = await createPatient(db, PATIENT);
    expect(await getCharge(db, p.id, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('deleteCharge', () => {
  it('removes the charge', async () => {
    const p = await createPatient(db, PATIENT);
    const created = await addCharge(db, p.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    await deleteCharge(db, p.id, created.id);
    expect(await listCharges(db, p.id)).toEqual([]);
  });

  it('cascades when the patient is deleted', async () => {
    const p = await createPatient(db, PATIENT);
    await addCharge(db, p.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    const { deletePatientAndFiles } = await import('@/data/patients');
    const { FakeStorage } = await import('../helpers/fake-storage');
    await deletePatientAndFiles(db, new FakeStorage(), p.id);
    expect(await listCharges(db, p.id)).toEqual([]);
  });

  it('does not delete a charge belonging to a different patient', async () => {
    const p1 = await createPatient(db, PATIENT);
    const p2 = await createPatient(db, { fullName: 'Other Patient', mobile: '9876500000' });
    const created = await addCharge(db, p1.id, 'consultation', 'Consultation Fee / सल्ला शुल्क', 500, '2026-08-10', null);
    await deleteCharge(db, p2.id, created.id);
    expect(await listCharges(db, p1.id)).toHaveLength(1);
  });
});
