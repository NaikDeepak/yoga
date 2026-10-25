// @vitest-environment jsdom
import '../../helpers/action-mocks';
import { freshTestDb, storage } from '../../helpers/action-mocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlexibilityCapturePage from '@/app/(app)/patients/[id]/posture/[assessmentId]/flexibility/page';
import PostureReportPage from '@/app/(app)/patients/[id]/posture/[assessmentId]/page';
import { createPatient } from '@/data/patients';
import { addAssessment } from '../../helpers/posture-assessment';
import { en } from '@/lib/i18n/en';
import type { Db } from '@/db/types';

vi.mock('@/lib/i18n/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));

let db: Db;
let patientId: string;
let assessmentId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  assessmentId = (await addAssessment(db, patientId, '2026-10-04', {}, storage)).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('FlexibilityCapturePage', () => {
  it('calls notFound when flexibility is switched off', async () => {
    vi.stubEnv('FEATURE_FLEXIBILITY', 'false');
    await expect(
      FlexibilityCapturePage({
        params: Promise.resolve({ id: patientId, assessmentId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NOT_FOUND');
  });
});

describe('PostureReportPage feature flags', () => {
  it('hides the flexibility capture link when flexibility is switched off', async () => {
    vi.stubEnv('FEATURE_FLEXIBILITY', 'false');
    const element = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    render(element);
    expect(screen.queryByRole('link', { name: new RegExp(en.posture.flex.add) })).toBeNull();
  });

  it('hides the AI card when AI is switched off', async () => {
    vi.stubEnv('FEATURE_AI', 'false');
    const element = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    render(element);
    expect(screen.queryByText(en.posture.ai.title)).toBeNull();
  });
});
