import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { createPatientAction, updatePatientAction } from '@/actions/patients';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { addVisitAction } from '@/actions/visits';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { createPatient, searchPatients, getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getLifestyleAssessment } from '@/data/lifestyle';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

const fd = (entries: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('createPatientAction', () => {
  it('creates and redirects to detail page', async () => {
    await expect(createPatientAction(fd({ fullName: 'Asha Pawar', mobile: '9876543210' })))
      .rejects.toThrow(/REDIRECT:\/patients\//);
    expect(await searchPatients(db)).toHaveLength(1);
  });
  it('returns validation error without creating', async () => {
    const r = await createPatientAction(fd({ fullName: '', mobile: '12' }));
    expect(r).toMatchObject({ ok: false });
    expect(await searchPatients(db)).toHaveLength(0);
  });
  it('uploads photo when provided', async () => {
    const photo = new File([new Uint8Array([9])], 'face.png', { type: 'image/png' });
    await expect(createPatientAction(fd({ fullName: 'A', mobile: '9876543210', photo })))
      .rejects.toThrow(/REDIRECT/);
    const [p] = await searchPatients(db);
    expect(p.photoPath).toContain(`patients/${p.id}/`);
    expect(storage.files.has(p.photoPath!)).toBe(true);
  });
  it('rejects bad photo type before creating', async () => {
    const photo = new File([new Uint8Array([9])], 'x.pdf', { type: 'application/pdf' });
    const r = await createPatientAction(fd({ fullName: 'A', mobile: '9876543210', photo }));
    expect(r).toMatchObject({ ok: false });
    expect(await searchPatients(db)).toHaveLength(0);
  });
});

describe('updatePatientAction', () => {
  it('updates fields', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await updatePatientAction(p.id, fd({ fullName: 'Asha Pawar', mobile: '9876543210', weightKg: '68' }));
    expect(r).toEqual({ ok: true });
    expect((await getPatient(db, p.id))?.weightKg).toBe(68);
  });
  it('returns validation error without updating', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    expect(await updatePatientAction(p.id, fd({ fullName: '', mobile: '12' }))).toMatchObject({ ok: false });
    expect((await getPatient(db, p.id))?.fullName).toBe('Asha');
  });
  it('replaces photo when provided', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const photo = new File([new Uint8Array([9])], 'new.png', { type: 'image/png' });
    expect(await updatePatientAction(p.id, fd({ fullName: 'Asha', mobile: '9876543210', photo })))
      .toEqual({ ok: true });
    const updated = await getPatient(db, p.id);
    expect(updated?.photoPath).toContain(`patients/${p.id}/`);
    expect(storage.files.has(updated!.photoPath!)).toBe(true);
  });
  it('rejects bad photo type without updating', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const photo = new File([new Uint8Array([9])], 'x.pdf', { type: 'application/pdf' });
    expect(await updatePatientAction(p.id, fd({ fullName: 'Changed', mobile: '9876543210', photo })))
      .toMatchObject({ ok: false });
    expect((await getPatient(db, p.id))?.fullName).toBe('Asha');
  });
});

describe('problems / treatment / visits actions', () => {
  it('full clinical flow', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    expect(await addProblemAction(p.id, fd({ problem: 'कंबर दुखी' }))).toEqual({ ok: true });
    const [prob] = await listProblems(db, p.id);
    expect(await removeProblemAction(p.id, prob.id)).toEqual({ ok: true });

    expect(await saveTreatmentPlanAction(p.id, fd({ yogaProgram: 'Bhujangasana' }))).toEqual({ ok: true });
    expect((await getTreatmentPlan(db, p.id))?.yogaProgram).toBe('Bhujangasana');

    expect(await addVisitAction(p.id, fd({ visitDate: '2026-06-11', progressNote: 'good', painScale: '6' })))
      .toEqual({ ok: true });
    expect(await listVisits(db, p.id)).toHaveLength(1);

    expect(await addVisitAction(p.id, fd({ visitDate: 'bad', progressNote: '' })))
      .toMatchObject({ ok: false });
  });
});

describe('addVisitAction with nextVisitDate', () => {
  it('saves nextVisitDate when provided', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: '2026-06-21' }),
    );
    expect(r).toEqual({ ok: true });
    const [v] = await listVisits(db, p.id);
    expect(v.nextVisitDate).toBe('2026-06-21');
  });

  it('saves null nextVisitDate when field is empty string', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: '' }),
    );
    expect(r).toEqual({ ok: true });
    const [v] = await listVisits(db, p.id);
    expect(v.nextVisitDate).toBeNull();
  });

  it('returns ok:false for invalid nextVisitDate format', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const r = await addVisitAction(
      p.id,
      fd({ visitDate: '2026-06-14', progressNote: 'ok', nextVisitDate: 'not-a-date' }),
    );
    expect(r).toMatchObject({ ok: false });
    expect(await listVisits(db, p.id)).toHaveLength(0);
  });
});

describe('documents actions', () => {
  it('uploads and deletes', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const file = new File([new Uint8Array([1])], 'rx.pdf', { type: 'application/pdf' });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'Prescription', file }))).toEqual({ ok: true });
    const [doc] = await listDocuments(db, p.id);
    expect(await deleteDocumentAction(p.id, doc.id)).toEqual({ ok: true });
    expect(await listDocuments(db, p.id)).toHaveLength(0);
  });
  it('rejects bad file type and missing file', async () => {
    const p = await createPatient(db, { fullName: 'Asha', mobile: '9876543210' });
    const bad = new File([new Uint8Array([1])], 'x.zip', { type: 'application/zip' });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'MRI', file: bad }))).toMatchObject({ ok: false });
    expect(await uploadDocumentAction(p.id, fd({ docType: 'MRI' }))).toMatchObject({ ok: false });
  });
});

describe('saveLifestyleAssessmentAction', () => {
  it('upserts assessment data and returns ok:true', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await saveLifestyleAssessmentAction(
      p.id,
      fd({ chiefComplaint: 'Knee pain', workType: 'desk', sleepQuality: '7' }),
    );
    expect(result).toEqual({ ok: true });
    const saved = await getLifestyleAssessment(db, p.id);
    expect(saved!.chiefComplaint).toBe('Knee pain');
    expect(saved!.workType).toBe('desk');
    expect(saved!.sleepQuality).toBe(7);
  });

  it('returns ok:false for invalid enum value', async () => {
    const p = await createPatient(db, { fullName: 'Asha Pawar', mobile: '9876543210' });
    const result = await saveLifestyleAssessmentAction(
      p.id,
      fd({ workType: 'couch-surfing' }),
    );
    expect(result).toMatchObject({ ok: false });
    expect(await getLifestyleAssessment(db, p.id)).toBeUndefined();
  });
});
