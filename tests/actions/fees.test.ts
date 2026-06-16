import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { createPatient } from '@/data/patients';
import { getPatientFees } from '@/data/fees';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const prev = { ok: false as const, error: '' };

describe('setCourseFeeAction', () => {
  it('creates course fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    expect(r).toEqual({ ok: true });
    expect((await getPatientFees(db, p.id)).courseFee).toBe(2000);
  });

  it('updates existing fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '3000' }));
    expect((await getPatientFees(db, p.id)).courseFee).toBe(3000);
  });

  it('returns error for negative fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({ courseFee: '-500' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for missing fee', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await setCourseFeeAction(p.id, prev, fd({}));
    expect(r).toMatchObject({ ok: false });
  });
});

describe('addPaymentAction', () => {
  it('records payment and updates balance', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    const r = await addPaymentAction(p.id, prev, fd({ amount: '1500', paymentDate: '2026-06-15', description: 'First' }));
    expect(r).toEqual({ ok: true });
    const fees = await getPatientFees(db, p.id);
    expect(fees.totalPaid).toBe(1500);
    expect(fees.balance).toBe(500);
  });

  it('returns error for missing amount', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addPaymentAction(p.id, prev, fd({ paymentDate: '2026-06-15' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for invalid date', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addPaymentAction(p.id, prev, fd({ amount: '500', paymentDate: 'not-a-date' }));
    expect(r).toMatchObject({ ok: false });
  });
});

describe('deletePaymentAction', () => {
  it('removes the payment', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await setCourseFeeAction(p.id, prev, fd({ courseFee: '2000' }));
    await addPaymentAction(p.id, prev, fd({ amount: '500', paymentDate: '2026-06-15' }));
    const { payments } = await getPatientFees(db, p.id);
    const r = await deletePaymentAction(p.id, payments[0].id);
    expect(r).toEqual({ ok: true });
    expect((await getPatientFees(db, p.id)).totalPaid).toBe(0);
  });

  it('returns ok when payment id does not exist (idempotent delete)', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await deletePaymentAction(p.id, '00000000-0000-0000-0000-000000000000');
    expect(r.ok).toBe(true);
  });
});
