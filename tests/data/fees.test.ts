import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getPatientFees, setCourseFee, addPayment, deletePayment, getOutstandingBalances } from '@/data/fees';
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

  it('handles decimal amounts correctly without rounding errors', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 1500.50);
    await addPayment(db, p.id, 999.99, '2026-06-03', 'First');
    const result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(999.99);
    expect(result.balance).toBe(500.51);
  });
});

describe('deletePayment', () => {
  it('removes the payment and balance recalculates', async () => {
    const p = await createPatient(db, PATIENT);
    await setCourseFee(db, p.id, 2000);
    await addPayment(db, p.id, 1500, '2026-06-03', null);
    let result = await getPatientFees(db, p.id);
    await deletePayment(db, p.id, result.payments[0].id);
    result = await getPatientFees(db, p.id);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(2000);
    expect(result.payments).toHaveLength(0);
  });
});

describe('getOutstandingBalances', () => {
  it('returns only patients with positive balance, largest first', async () => {
    const a = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const b = await createPatient(db, { fullName: 'Baban Jadhav', mobile: '9876543211' });
    const c = await createPatient(db, { fullName: 'Chhaya More', mobile: '9876543212' });
    const d = await createPatient(db, { fullName: 'Dinesh Kale', mobile: '9876543213' });

    await setCourseFee(db, a.id, 2000); // no payments → 2000 due
    await setCourseFee(db, b.id, 3000);
    await addPayment(db, b.id, 500, '2026-06-01', null); // 2500 due
    await setCourseFee(db, c.id, 1000);
    await addPayment(db, c.id, 1000, '2026-06-01', null); // fully paid
    // d has no course fee at all → excluded

    const rows = await getOutstandingBalances(db);
    expect(rows.map((r) => r.fullName)).toEqual(['Baban Jadhav', 'Asha Pawar']);
    expect(rows[0]).toMatchObject({ courseFee: 3000, totalPaid: 500, balance: 2500 });
    expect(rows[1]).toMatchObject({ courseFee: 2000, totalPaid: 0, balance: 2000 });
    expect(rows[0].patientCode).toMatch(/^PYT-/);
    expect(rows[0].mobile).toBe('9876543211');
  });

  it('respects the limit', async () => {
    for (let i = 0; i < 4; i++) {
      const p = await createPatient(db, { fullName: `P ${i}`, mobile: `987654321${i}` });
      await setCourseFee(db, p.id, 1000 + i);
    }
    const rows = await getOutstandingBalances(db, 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].balance).toBe(1003);
  });

  it('returns empty when nobody owes', async () => {
    expect(await getOutstandingBalances(db)).toEqual([]);
  });
});
