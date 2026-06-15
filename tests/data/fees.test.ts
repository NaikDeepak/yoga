import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getPatientFees, setCourseFee, addPayment, deletePayment } from '@/data/fees';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

const PATIENT = { fullName: 'Asha Pawar', mobile: '9876543210' };

describe('getPatientFees', () => {
  it('returns null fee and empty payments for new patient', async () => {
    const p = await createPatient(db, PATIENT);
    const result = await getPatientFees(db, p.id);
    expect(result).toEqual({ courseFee: null, payments: [], totalPaid: 0, balance: null });
  });
});

describe('setCourseFee', () => {
  it('creates a fee row', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    const result = await getPatientFees(db, p.id);
    expect(result.courseFee).toBe(2000);
    expect(result.balance).toBe(2000);
    expect(result.totalPaid).toBe(0);
  });

  it('updates existing fee row on second call', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await setCourseFee(db, p.id, 3000);
    const result = await getPatientFees(db, p.id);
    expect(result.courseFee).toBe(3000);
  });
});

describe('addPayment + getPatientFees', () => {
  it('computes totalPaid and balance from payments', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await addPayment(db, p.id, 1500, '2026-06-03', 'First instalment');
    const result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(1500);
    expect(result.balance).toBe(500);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].description).toBe('First instalment');
  });

  it('accepts null description', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 1000);
    await addPayment(db, p.id, 1000, '2026-06-10', null);
    const result = await getPatientFees(db, p.id);
    expect(result.payments[0].description).toBeNull();
    expect(result.balance).toBe(0);
  });

  it('handles overpayment (totalPaid > courseFee)', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 1000);
    await addPayment(db, p.id, 600, '2026-06-01', null);
    await addPayment(db, p.id, 600, '2026-06-02', null);
    const result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(1200);
    expect(result.balance).toBe(-200);
  });

  it('returns payments ordered by paymentDate', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 3000);
    await addPayment(db, p.id, 500, '2026-06-05', 'Third');
    await addPayment(db, p.id, 500, '2026-06-01', 'First');
    await addPayment(db, p.id, 500, '2026-06-03', 'Second');
    const result = await getPatientFees(db, p.id);
    expect(result.payments[0].description).toBe('First');
    expect(result.payments[1].description).toBe('Second');
    expect(result.payments[2].description).toBe('Third');
  });
});

describe('deletePayment', () => {
  it('removes the payment and balance recalculates', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await addPayment(db, p.id, 1500, '2026-06-03', null);
    let result = await getPatientFees(db, p.id);
    await deletePayment(db, result.payments[0].id);
    result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(2000);
    expect(result.payments).toHaveLength(0);
  });
});
