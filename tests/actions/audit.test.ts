import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { addAssessment } from '../helpers/posture-assessment';
import { storage } from '../helpers/action-mocks';
import { deletePatientAction, updatePatientAction } from '@/actions/patients';
import { addVisitAction } from '@/actions/visits';
import { addPaymentAction, deletePaymentAction, setCourseFeeAction } from '@/actions/fees';
import { addChargeAction } from '@/actions/charges';
import { addProblemAction } from '@/actions/problems';
import { uploadDocumentAction } from '@/actions/documents';
import { withdrawPhotoConsentAction } from '@/actions/posture';
import { createExerciseShareLinkAction, revokeExerciseShareLinkAction } from '@/actions/share-links';
import { listAllExercises, savePrescribedExercises } from '@/data/exercises';
import { createPatient } from '@/data/patients';
import { getPatientFees } from '@/data/fees';
import { listAudit } from '@/data/audit';
import type { Db } from '@/db/types';
import { vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'clinic.test', 'x-forwarded-proto': 'https' }) }));

let db: Db;
const form = (o: Record<string, string | File>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const ok = { ok: true } as const;

beforeEach(async () => { db = await freshTestDb(); });

describe('audit trail across actions', () => {
  it("records each change by client code and action — never the client's name or health details", async () => {
    const p = await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' });
    await updatePatientAction(p.id, form({ fullName: 'Asha Kulkarni', mobile: '9876543211' }));
    await addVisitAction(p.id, form({ visitDate: '2026-10-01', progressNote: 'Sciatica flare, secret note', painScale: '6' }));
    await setCourseFeeAction(p.id, ok, form({ courseFee: '5000' }));
    await addPaymentAction(p.id, ok, form({ amount: '2000', paymentDate: '2026-10-02' }));
    const [payment] = (await getPatientFees(db, p.id)).payments;
    await deletePaymentAction(p.id, payment.id);
    await addChargeAction(p.id, ok, form({ feeType: 'consultation', amount: '500', chargeDate: '2026-10-03' }));
    await addProblemAction(p.id, form({ problem: 'Sciatica', isCustom: 'false' }));
    await uploadDocumentAction(p.id, form({ docType: 'MRI', file: new File([new Uint8Array([1])], 'Asha-MRI-spine.pdf', { type: 'application/pdf' }) }));
    const [ex] = await listAllExercises(db);
    await savePrescribedExercises(db, p.id, [{ exerciseId: ex.id, customNote: null }]);
    await createExerciseShareLinkAction(p.id);
    await revokeExerciseShareLinkAction(p.id);
    await addAssessment(db, p.id, '2026-10-04', {}, storage);
    await withdrawPhotoConsentAction(p.id);

    const rows = await listAudit(db, { limit: 100 });
    expect(rows.map((r) => r.action).reverse()).toEqual([
      'client.update', 'visit.add', 'fee.set', 'payment.add', 'payment.delete', 'charge.add', 'problem.add',
      'document.upload', 'share.create', 'share.revoke', 'photos.withdraw',
    ]);
    expect(rows.every((r) => r.clientCode === p.patientCode && r.actorId === 'admin')).toBe(true);
    expect(rows.find((r) => r.action === 'payment.add')?.summary).toBe('₹2000 on 2026-10-02');
    expect(rows.find((r) => r.action === 'document.upload')?.summary).toBe('MRI'); // the type, not the file name
    const all = JSON.stringify(rows);
    for (const secret of ['Asha', 'Kulkarni', 'Sciatica', 'secret note', '9876543']) expect(all).not.toContain(secret);
  });

  it('a permanent delete is recorded with the code, and earlier entries keep only the code', async () => {
    const p = await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' });
    await addVisitAction(p.id, form({ visitDate: '2026-10-01', progressNote: 'note' }));
    await expect(deletePatientAction(p.id, 'Asha Kulkarni')).rejects.toThrow('REDIRECT:/patients');
    const rows = await listAudit(db);
    expect(rows.map((r) => [r.action, r.clientCode])).toEqual([['client.delete', p.patientCode], ['visit.add', p.patientCode]]);
    expect(JSON.stringify(rows)).not.toContain('Asha');
  });

  it('failed actions are not recorded', async () => {
    const p = await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' });
    await addVisitAction(p.id, form({ visitDate: 'not-a-date', progressNote: 'x' }));
    expect(await listAudit(db)).toEqual([]);
  });
});
