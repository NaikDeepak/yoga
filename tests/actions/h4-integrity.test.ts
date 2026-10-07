import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { updatePatientAction } from '@/actions/patients';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { addChargeAction, deleteChargeAction } from '@/actions/charges';
import { createPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getPatientFees } from '@/data/fees';
import { listCharges } from '@/data/charges';
import { listAudit } from '@/data/audit';
import type { Db } from '@/db/types';

// H4 (hardening audit): deletes are scoped to the client; nothing deleted → nothing in the activity log;
// ids that are not UUIDs are rejected before reaching the database.
let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const prev = { ok: false as const, error: '' };
const MISSING = '00000000-0000-4000-8000-000000000000';

async function twoClients() {
  const a = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
  const b = await createPatient(db, { fullName: 'Meera', mobile: '9876500000' });
  return { a, b };
}

describe('deletes stay inside the client they were asked for', () => {
  it('problem: wrong client → kept, not logged', async () => {
    const { a, b } = await twoClients();
    await addProblemAction(a.id, fd({ problem: 'Vertigo' }));
    const [problem] = await listProblems(db, a.id);
    const before = (await listAudit(db)).length;
    expect(await removeProblemAction(b.id, problem.id)).toEqual({ ok: true });
    expect(await listProblems(db, a.id)).toHaveLength(1);
    expect(await listAudit(db)).toHaveLength(before);
  });

  it('document: wrong client → kept (row and file), not logged', async () => {
    const { a, b } = await twoClients();
    const file = new File([new Uint8Array([1])], 'rx.pdf', { type: 'application/pdf' });
    await uploadDocumentAction(a.id, fd({ docType: 'Prescription', file }));
    const [doc] = await listDocuments(db, a.id);
    const before = (await listAudit(db)).length;
    expect(await deleteDocumentAction(b.id, doc.id)).toEqual({ ok: true });
    expect(await listDocuments(db, a.id)).toHaveLength(1);
    expect(storage.files.has(doc.filePath)).toBe(true);
    expect(await listAudit(db)).toHaveLength(before);
  });

  it('payment and charge: unknown id → ok (double tap) but nothing logged', async () => {
    const { a } = await twoClients();
    await addPaymentAction(a.id, prev, fd({ amount: '500', paymentDate: '2026-06-15' }));
    await addChargeAction(a.id, prev, fd({ feeType: 'consultation', amount: '500', chargeDate: '2026-08-10' }));
    const before = (await listAudit(db)).length;
    expect(await deletePaymentAction(a.id, MISSING)).toEqual({ ok: true });
    expect(await deleteChargeAction(a.id, MISSING)).toEqual({ ok: true });
    expect(await listAudit(db)).toHaveLength(before);
    expect((await getPatientFees(db, a.id)).payments).toHaveLength(1);
    expect(await listCharges(db, a.id)).toHaveLength(1);
  });
});

describe('ids that are not UUIDs are rejected', () => {
  it.each([
    ['problem', () => removeProblemAction('nope', MISSING)],
    ['document', () => deleteDocumentAction(MISSING, 'nope')],
    ['payment', () => deletePaymentAction(MISSING, "1' or '1'='1")],
    ['charge', () => deleteChargeAction('', MISSING)],
    ['client edit', () => updatePatientAction('nope', fd({ fullName: 'Asha', mobile: '9876543210' }))],
  ])('%s', async (_name, call) => {
    expect(await call()).toMatchObject({ ok: false });
  });
});

describe('editing a client that no longer exists', () => {
  it('says so and logs nothing', async () => {
    const r = await updatePatientAction(MISSING, fd({ fullName: 'Asha', mobile: '9876543210' }));
    expect(r).toMatchObject({ ok: false });
    expect(await listAudit(db)).toEqual([]);
  });
});
