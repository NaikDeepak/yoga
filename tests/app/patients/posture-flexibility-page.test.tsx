// @vitest-environment jsdom
import '../../helpers/action-mocks';
import { freshTestDb, storage } from '../../helpers/action-mocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlexibilityCapturePage from '@/app/(app)/patients/[id]/posture/[assessmentId]/flexibility/page';
import PostureReportPage from '@/app/(app)/patients/[id]/posture/[assessmentId]/page';
import PostureComparePage from '@/app/(app)/patients/[id]/posture/compare/page';
import PatientPage from '@/app/(app)/patients/[id]/page';
import { createPatient } from '@/data/patients';
import { addAssessment } from '../../helpers/posture-assessment';
import { saveFlexibilityShots } from '@/data/flexibility';
import { flexShot } from '../../helpers/flexibility';
import { jpeg } from '../../helpers/posture';
import { en } from '@/lib/i18n/en';
import { resolveServerTree } from '../../helpers/server-render';
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
  it('shows flexibility section and capture link when on, and hides whole section when off', async () => {
    // Present when on
    vi.stubEnv('FEATURE_FLEXIBILITY', 'true');
    const onElement = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    const { unmount } = render(onElement);
    expect(screen.getByText(en.posture.flex.title)).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(en.posture.flex.add) })).toBeTruthy();
    unmount();

    // Absent when off
    vi.stubEnv('FEATURE_FLEXIBILITY', 'false');
    const offElement = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    render(offElement);
    expect(screen.queryByText(en.posture.flex.title)).toBeNull();
    expect(screen.queryByRole('link', { name: new RegExp(en.posture.flex.add) })).toBeNull();
    expect(screen.queryByText(en.posture.total.title)).toBeNull();
  });

  it('shows AI card when on, and hides it when off', async () => {
    // Present when on
    vi.stubEnv('FEATURE_AI', 'true');
    const onElement = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    const { unmount } = render(onElement);
    expect(screen.getByText(en.posture.ai.title)).toBeTruthy();
    unmount();

    // Absent when off
    vi.stubEnv('FEATURE_AI', 'false');
    const offElement = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    render(offElement);
    expect(screen.queryByText(en.posture.ai.title)).toBeNull();
  });

  it('hides the share panel when shareLinks is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    const element = await PostureReportPage({
      params: Promise.resolve({ id: patientId, assessmentId }),
    });
    render(element);
    expect(screen.queryAllByText(en.shareExercises.title)).toHaveLength(0);
  });
});

describe('PostureComparePage feature flags', () => {
  it('shows flexibility block and totals when on, hides them when off', async () => {
    const a2 = await addAssessment(db, patientId, '2026-10-10', {}, storage);
    const s = flexShot('butterfly');
    await saveFlexibilityShots(db, storage, patientId, assessmentId, [{
      shot: 'butterfly', photo: jpeg(), imageWidth: s.imageWidth, imageHeight: s.imageHeight,
      landmarks: s.landmarks, landmarksEdited: false, cameraCheck: s.cameraCheck,
    }]);

    // Present when on
    vi.stubEnv('FEATURE_FLEXIBILITY', 'true');
    const onElement = await PostureComparePage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ a: assessmentId, b: a2.id }),
    });
    const { unmount } = render(onElement);
    expect(screen.getByText(en.posture.flex.title)).toBeTruthy();
    unmount();

    // Absent when off
    vi.stubEnv('FEATURE_FLEXIBILITY', 'false');
    const offElement = await PostureComparePage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ a: assessmentId, b: a2.id }),
    });
    render(offElement);
    expect(screen.queryByText(en.posture.flex.title)).toBeNull();
    expect(screen.queryByText(new RegExp(en.posture.total.title))).toBeNull();
  });
});

describe('PatientPage feature flags', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('hides the share panel on treatment tab when shareLinks is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    const element = await PatientPage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ tab: 'treatment' }),
    });
    render(await resolveServerTree(element));
    expect(screen.queryAllByText(en.shareExercises.title)).toHaveLength(0);
    expect(screen.queryAllByText(en.shareProgress.title)).toHaveLength(0);
  });

  it('shows the progress share panel on treatment tab when shareLinks is on', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'true');
    const element = await PatientPage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ tab: 'treatment' }),
    });
    render(await resolveServerTree(element));
    expect(screen.getAllByText(en.shareProgress.title).length).toBeGreaterThan(0);
  });

  it('hides the home-exercise check-in card on treatment tab when checkins is switched off', async () => {
    vi.stubEnv('FEATURE_CHECKINS', 'false');
    const element = await PatientPage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ tab: 'treatment' }),
    });
    render(await resolveServerTree(element));
    expect(screen.queryAllByText(en.homeExercise.title)).toHaveLength(0);
  });

  it('shows the home-exercise check-in card when checkins is on', async () => {
    vi.stubEnv('FEATURE_CHECKINS', 'true');
    const element = await PatientPage({
      params: Promise.resolve({ id: patientId }),
      searchParams: Promise.resolve({ tab: 'treatment' }),
    });
    render(await resolveServerTree(element));
    expect(screen.getAllByText(en.homeExercise.title).length).toBeGreaterThan(0);
  });
});

