import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { addAssessment } from '../helpers/posture-assessment';
import { requireUser } from '@/lib/auth';
import { createPostureShareLinkAction, revokePostureShareLinkAction } from '@/actions/share-links';
import { activeShareLink } from '@/data/share-links';
import { createPatient } from '@/data/patients';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'clinic.test', 'x-forwarded-proto': 'https' }),
}));

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
});

describe('createPostureShareLinkAction', () => {
  it('shares that assessment, remembering the photos choice', async () => {
    const a = await addAssessment(db, patientId);
    const r = await createPostureShareLinkAction(a.id, true);
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toMatch(/^https:\/\/clinic\.test\/s\/[A-Za-z0-9_-]{43}$/);
    expect(r.whatsappUrl).toContain('phone=919876543210');
    expect(decodeURIComponent(r.whatsappUrl)).not.toMatch(/Asha|Kulkarni/);
    expect(await activeShareLink(db, patientId, 'posture', new Date())).toMatchObject({ postureAssessmentId: a.id, includePhotos: true });
  });

  it('rejects an invalid or unknown assessment', async () => {
    expect(await createPostureShareLinkAction('nope', false)).toMatchObject({ ok: false });
    expect(await createPostureShareLinkAction('00000000-0000-4000-8000-000000000000', false)).toMatchObject({ ok: false });
  });

  it('requires a signed-in user', async () => {
    const a = await addAssessment(db, patientId);
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(createPostureShareLinkAction(a.id, false)).rejects.toThrow('REDIRECT:/login');
  });
});

describe('revokePostureShareLinkAction', () => {
  it('stops the live posture link only', async () => {
    const a = await addAssessment(db, patientId);
    await createPostureShareLinkAction(a.id, false);
    expect(await revokePostureShareLinkAction(patientId)).toEqual({ ok: true });
    expect(await activeShareLink(db, patientId, 'posture', new Date())).toBeNull();
  });
});
