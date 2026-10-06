import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { requireUser } from '@/lib/auth';
import { createProgressShareLinkAction, revokeProgressShareLinkAction } from '@/actions/share-links';
import { activeShareLink, resolveAnyShareLink } from '@/data/share-links';
import { getSharedProgressReport } from '@/data/shared-progress';
import { createPatient } from '@/data/patients';
import { addVisit } from '@/data/visits';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'clinic.test', 'x-forwarded-proto': 'https' }),
}));

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  await addVisit(db, patientId, { visitDate: '2026-09-01', progressNote: 'note', painScale: 6, weightKg: 80 });
});

describe('createProgressShareLinkAction', () => {
  it('returns a working link and a WhatsApp link without the client name', async () => {
    const r = await createProgressShareLinkAction(patientId, { hideWeight: false });
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toMatch(/^https:\/\/clinic\.test\/s\/[A-Za-z0-9_-]{43}$/);
    expect(r.whatsappUrl).toContain('phone=919876543210');
    expect(decodeURIComponent(r.whatsappUrl)).toContain(r.url);
    expect(decodeURIComponent(r.whatsappUrl)).not.toMatch(/Asha|Kulkarni/);
    const link = await resolveAnyShareLink(db, r.url.split('/s/')[1], new Date());
    expect(link).toMatchObject({ kind: 'progress', hideWeight: false });
    expect(await getSharedProgressReport(db, link!, new Date())).not.toBeNull();
  });

  it('stores "hide weight" (only a literal true counts)', async () => {
    await createProgressShareLinkAction(patientId, { hideWeight: true });
    expect((await activeShareLink(db, patientId, 'progress', new Date()))?.hideWeight).toBe(true);
    await createProgressShareLinkAction(patientId, { hideWeight: 'yes' as never });
    expect((await activeShareLink(db, patientId, 'progress', new Date()))?.hideWeight).toBe(false);
  });

  it('refuses a client with no pain or weight recorded yet', async () => {
    const other = (await createPatient(db, { fullName: 'Ravi Patil', mobile: '9876500000' })).id;
    await addVisit(db, other, { visitDate: '2026-09-01', progressNote: 'note only' });
    expect(await createProgressShareLinkAction(other, { hideWeight: false })).toMatchObject({ ok: false });
  });

  it('rejects an invalid or unknown client id', async () => {
    expect(await createProgressShareLinkAction('not-a-uuid', { hideWeight: false })).toMatchObject({ ok: false });
    expect(await createProgressShareLinkAction('00000000-0000-4000-8000-000000000000', { hideWeight: false })).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(createProgressShareLinkAction(patientId, { hideWeight: false })).rejects.toThrow('REDIRECT:/login');
  });
});

describe('revokeProgressShareLinkAction', () => {
  it('stops the active progress link only', async () => {
    await createProgressShareLinkAction(patientId, { hideWeight: false });
    expect(await revokeProgressShareLinkAction(patientId)).toEqual({ ok: true });
    expect(await activeShareLink(db, patientId, 'progress', new Date())).toBeNull();
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(revokeProgressShareLinkAction(patientId)).rejects.toThrow('REDIRECT:/login');
  });
});
