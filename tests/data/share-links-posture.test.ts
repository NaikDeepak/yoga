import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { addAssessment } from '../helpers/posture-assessment';
import { createPatient } from '@/data/patients';
import { createShareLink, resolveAnyShareLink, resolveShareLink } from '@/data/share-links';
import { postureAssessments, shareLinks } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
const now = new Date('2026-10-05T04:30:00Z');

beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
});

describe('posture share links', () => {
  it('store the assessment and the photos choice', async () => {
    const a = await addAssessment(db, patientId);
    const { token, link } = await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a.id, includePhotos: true });
    expect(link).toMatchObject({ kind: 'posture', postureAssessmentId: a.id, includePhotos: true });
    expect(await resolveAnyShareLink(db, token, now)).toMatchObject({ id: link.id, kind: 'posture' });
  });

  it('must point at an assessment (and exercise links must not)', async () => {
    const a = await addAssessment(db, patientId);
    await expect(createShareLink(db, patientId, 'posture', now)).rejects.toThrow();
    await expect(createShareLink(db, patientId, 'exercises', now, { postureAssessmentId: a.id })).rejects.toThrow();
  });

  it('one live posture link per client: sharing another report replaces it; the exercise link stays', async () => {
    const [a1, a2] = [await addAssessment(db, patientId, '2026-09-01'), await addAssessment(db, patientId)];
    const ex = await createShareLink(db, patientId, 'exercises', now);
    const p1 = await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a1.id });
    const p2 = await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a2.id });
    expect(await resolveAnyShareLink(db, p1.token, now)).toBeNull();
    expect((await resolveAnyShareLink(db, p2.token, now))?.postureAssessmentId).toBe(a2.id);
    expect(await resolveShareLink(db, ex.token, 'exercises', now)).not.toBeNull();
  });

  it('dies with its assessment', async () => {
    const a = await addAssessment(db, patientId);
    await createShareLink(db, patientId, 'posture', now, { postureAssessmentId: a.id });
    await db.delete(postureAssessments).where(eq(postureAssessments.id, a.id));
    expect(await db.select().from(shareLinks)).toHaveLength(0);
  });
});

describe('resolveAnyShareLink', () => {
  it('finds a link of any kind, or null', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect((await resolveAnyShareLink(db, token, now))?.kind).toBe('exercises');
    expect(await resolveAnyShareLink(db, 'nope', now)).toBeNull();
  });
});
