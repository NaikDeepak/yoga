// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../helpers/action-mocks';
import { freshTestDb } from '../../helpers/action-mocks';
import { addAssessment } from '../../helpers/posture-assessment';
import { render, screen } from '@testing-library/react';
import { createPatient } from '@/data/patients';
import { listAllExercises, savePrescribedExercises } from '@/data/exercises';
import { createShareLink, revokeShareLinks } from '@/data/share-links';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0 test' }) }));

const SharedLinkPage = (await import('@/app/s/[token]/page')).default;
const page = (token: string, lang?: string) =>
  SharedLinkPage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({ lang }) });

let db: Db;
let patientId: string;

beforeEach(async () => {
  vi.stubEnv('FEATURE_POSTURE', 'true');
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  const [ex] = await listAllExercises(db);
  await savePrescribedExercises(db, patientId, [{ exerciseId: ex.id, customNote: null }]);
});
afterEach(() => vi.unstubAllEnvs());

describe('/s/[token]', () => {
  it('renders the exercise page for an exercise link', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', new Date());
    render(await page(token));
    expect(screen.getByText(/Namaskar Asha/)).toBeTruthy();
    expect(screen.getByText('Did you do your exercises today?')).toBeTruthy();
    expect(screen.queryByText(/Your posture report/)).toBeNull();
  });

  it('renders the posture report for a posture link, in Marathi when asked', async () => {
    const a = await addAssessment(db, patientId);
    const { token } = await createShareLink(db, patientId, 'posture', new Date(), { postureAssessmentId: a.id });
    render(await page(token, 'mr'));
    expect(screen.getByText(/आपला पोश्चर अहवाल/)).toBeTruthy();
    expect(screen.queryByText('Did you do your exercises today?')).toBeNull();
    expect(document.body.textContent).not.toContain('Kulkarni');
  });

  it('gives the same not-found for unknown and revoked links of either kind', async () => {
    await expect(page('not-a-real-token')).rejects.toThrow('NOT_FOUND');
    const a = await addAssessment(db, patientId);
    const ex = await createShareLink(db, patientId, 'exercises', new Date());
    const po = await createShareLink(db, patientId, 'posture', new Date(), { postureAssessmentId: a.id });
    await revokeShareLinks(db, patientId, 'exercises', new Date());
    await revokeShareLinks(db, patientId, 'posture', new Date());
    await expect(page(ex.token)).rejects.toThrow('NOT_FOUND');
    await expect(page(po.token)).rejects.toThrow('NOT_FOUND');
  });

  it('stops posture links while posture analysis is switched off', async () => {
    const a = await addAssessment(db, patientId);
    const { token } = await createShareLink(db, patientId, 'posture', new Date(), { postureAssessmentId: a.id });
    vi.stubEnv('FEATURE_POSTURE', 'false');
    await expect(page(token)).rejects.toThrow('NOT_FOUND');
  });
});
