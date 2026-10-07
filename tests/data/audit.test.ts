import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient, deletePatientAndFiles } from '@/data/patients';
import { listAudit, recordAudit } from '@/data/audit';
import { FakeStorage } from '../helpers/fake-storage';
import type { Db } from '@/db/types';

let db: Db;
const actor = { id: 'u1', email: 'dr.pawar@example.com' };

beforeEach(async () => { db = await createTestDb(); });

describe('recordAudit / listAudit', () => {
  it('records who did what to which client (by code), newest first', async () => {
    const p = await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' });
    await recordAudit(db, { actor, action: 'client.create', patientId: p.id });
    await recordAudit(db, { actor, action: 'payment.add', patientId: p.id, summary: '₹2000 on 2026-10-07' });
    const rows = await listAudit(db);
    expect(rows.map((r) => r.action)).toEqual(['payment.add', 'client.create']);
    expect(rows[0]).toMatchObject({ actorEmail: 'dr.pawar@example.com', clientCode: p.patientCode, summary: '₹2000 on 2026-10-07' });
  });

  it('keeps entries (code only, no name) after the client is permanently deleted', async () => {
    const p = await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' });
    await recordAudit(db, { actor, action: 'client.create', patientId: p.id });
    await deletePatientAndFiles(db, new FakeStorage(), p.id);
    await recordAudit(db, { actor, action: 'client.delete', clientCode: p.patientCode });
    const rows = await listAudit(db);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.clientCode === p.patientCode)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('Asha');
  });

  it('works without a client (e.g. an export)', async () => {
    await recordAudit(db, { actor, action: 'export', summary: 'clients · all branches' });
    expect((await listAudit(db))[0]).toMatchObject({ action: 'export', clientCode: null });
  });

  it('never throws: a failed write is logged (no data) and the caller carries on', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { ...db, insert: () => { throw new Error('db down'); } } as unknown as Db;
    await expect(recordAudit(broken, { actor, action: 'export' })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith('Audit write failed:', 'db down');
    err.mockRestore();
  });

  it('pages with a limit and an older-than cursor', async () => {
    for (let i = 0; i < 5; i++) await recordAudit(db, { actor, action: 'export', summary: `#${i}` });
    const first = await listAudit(db, { limit: 2 });
    expect(first.map((r) => r.summary)).toEqual(['#4', '#3']);
    const next = await listAudit(db, { limit: 2, before: first[1].id });
    expect(next.map((r) => r.summary)).toEqual(['#2', '#1']);
  });
});
