// @vitest-environment jsdom
import '../../helpers/action-mocks';
import { freshTestDb } from '../../helpers/action-mocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SharedLinkPage from '@/app/s/[token]/page';
import { ExercisesBody } from '@/app/s/[token]/ExercisesBody';
import { createPatient } from '@/data/patients';
import { listAllExercises, savePrescribedExercises } from '@/data/exercises';
import { createShareLink } from '@/data/share-links';
import { en } from '@/lib/i18n/en';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0' }),
}));

let db: Db;
let patientId: string;
let token: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  const [ex] = await listAllExercises(db);
  await savePrescribedExercises(db, patientId, [{ exerciseId: ex.id, customNote: null }]);
  const created = await createShareLink(db, patientId, 'exercises', new Date());
  token = created.token;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SharedLinkPage feature flags', () => {
  it('calls notFound when shareLinks is switched off', async () => {
    vi.stubEnv('FEATURE_SHARE_LINKS', 'false');
    await expect(
      SharedLinkPage({
        params: Promise.resolve({ token }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NOT_FOUND');
  });
});

describe('ExercisesBody checkins switch', () => {
  it('hides CheckinForm when checkinsEnabled is false', () => {
    const programme = {
      linkId: 'l1',
      firstName: 'Asha',
      exercises: [
        {
          name: 'Tadasana',
          description: null,
          steps: [],
          repetitions: '5',
          daysPerWeek: '7',
          tip: null,
          note: null,
          imagePath: null,
        },
      ],
      checkins: { today: null, last7: [{ date: '2026-10-05', done: null }] },
    };
    render(
      <ExercisesBody
        token="tok123"
        lang="en"
        programme={programme}
        editing={false}
        error={false}
        t={en.sharedPage}
        checkinsEnabled={false}
      />,
    );
    expect(screen.queryByText(en.sharedPage.checkin.question)).toBeNull();
  });

  it('shows CheckinForm when checkinsEnabled is true', () => {
    const programme = {
      linkId: 'l1',
      firstName: 'Asha',
      exercises: [
        {
          name: 'Tadasana',
          description: null,
          steps: [],
          repetitions: '5',
          daysPerWeek: '7',
          tip: null,
          note: null,
          imagePath: null,
        },
      ],
      checkins: { today: null, last7: [{ date: '2026-10-05', done: null }] },
    };
    render(
      <ExercisesBody
        token="tok123"
        lang="en"
        programme={programme}
        editing={false}
        error={false}
        t={en.sharedPage}
        checkinsEnabled={true}
      />,
    );
    expect(screen.getByText(en.sharedPage.checkin.question)).toBeTruthy();
  });
});
