import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { addChargeAction, deleteChargeAction } from '@/actions/charges';
import { createPatient } from '@/data/patients';
import { listCharges } from '@/data/charges';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const prev = { ok: false as const, error: '' };

describe('addChargeAction', () => {
  it('records a consultation charge with the preset label', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({ feeType: 'consultation', amount: '500', chargeDate: '2026-08-10' }));
    expect(r).toEqual({ ok: true });
    const charges = await listCharges(db, p.id);
    expect(charges).toHaveLength(1);
    expect(charges[0].label).toBe('Consultation Fee / सल्ला शुल्क');
    expect(charges[0].amount).toBe(500);
  });

  it('records an "other" charge using the custom label', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({
      feeType: 'other', customLabel: 'Home visit', amount: '800', chargeDate: '2026-08-10',
    }));
    expect(r).toEqual({ ok: true });
    const charges = await listCharges(db, p.id);
    expect(charges[0].label).toBe('Home visit');
  });

  it('returns error for "other" without a custom label', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({ feeType: 'other', amount: '800', chargeDate: '2026-08-10' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for missing amount', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({ feeType: 'consultation', chargeDate: '2026-08-10' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for invalid date', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({ feeType: 'consultation', amount: '500', chargeDate: 'not-a-date' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('returns error for an unknown fee type', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addChargeAction(p.id, prev, fd({ feeType: 'bogus', amount: '500', chargeDate: '2026-08-10' }));
    expect(r).toMatchObject({ ok: false });
  });
});

describe('deleteChargeAction', () => {
  it('removes the charge', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    await addChargeAction(p.id, prev, fd({ feeType: 'consultation', amount: '500', chargeDate: '2026-08-10' }));
    const [charge] = await listCharges(db, p.id);
    const r = await deleteChargeAction(p.id, charge.id);
    expect(r).toEqual({ ok: true });
    expect(await listCharges(db, p.id)).toEqual([]);
  });

  it('returns ok when the charge id does not exist (idempotent delete)', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await deleteChargeAction(p.id, '00000000-0000-0000-0000-000000000000');
    expect(r.ok).toBe(true);
  });
});
