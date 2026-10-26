// @vitest-environment jsdom
import '../../helpers/action-mocks';
import { freshTestDb } from '../../helpers/action-mocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(app)/dashboard/page';
import { createPatient } from '@/data/patients';
import { listAllExercises, savePrescribedExercises } from '@/data/exercises';
import { createShareLink } from '@/data/share-links';
import { en } from '@/lib/i18n/en';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'en' }) }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  const [ex] = await listAllExercises(db);
  await savePrescribedExercises(db, patientId, [{ exerciseId: ex.id, customNote: null }]);
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  await createShareLink(db, patientId, 'exercises', fiveDaysAgo);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DashboardPage quiet clients card feature switches', () => {
  it('shows the quiet clients card when both shareLinks and checkins are on', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'true');
    vi.stubEnv('FEATURE_CHECKINS', 'true');
    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(element);
    expect(screen.getByText(en.dashboard.quiet.title)).toBeTruthy();
  });

  it('hides the quiet clients card when shareLinks is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    vi.stubEnv('FEATURE_CHECKINS', 'true');
    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(element);
    expect(screen.queryByText(en.dashboard.quiet.title)).toBeNull();
  });

  it('hides the quiet clients card when checkins is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'true');
    vi.stubEnv('FEATURE_CHECKINS', 'false');
    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(element);
    expect(screen.queryByText(en.dashboard.quiet.title)).toBeNull();
  });
});

describe('DashboardPage fees switch', () => {
  it('shows revenue and outstanding balances when fees is on', async () => {
    vi.stubEnv('FEATURE_FEES', 'true');
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(en.dashboard.revenueThisMonth)).toBeTruthy();
    expect(screen.getByText(en.dashboard.outstandingBalances)).toBeTruthy();
  });

  it('hides revenue and outstanding balances when fees is off', async () => {
    vi.stubEnv('FEATURE_FEES', 'false');
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(en.dashboard.revenueThisMonth)).toBeNull();
    expect(screen.queryByText(en.dashboard.outstandingBalances)).toBeNull();
  });
});
