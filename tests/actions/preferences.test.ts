import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { saveLanguageAction } from '@/actions/preferences';
import { getUserLanguage } from '@/data/preferences';
import type { Db } from '@/db/types';

const { mockSet } = vi.hoisted(() => ({
  mockSet: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet }),
}));

let db: Db;
beforeEach(async () => {
  db = await freshTestDb();
  mockSet.mockClear();
});

describe('saveLanguageAction', () => {
  it('persists a valid locale to the DB', async () => {
    const res = await saveLanguageAction('mr');
    expect(res).toEqual({ ok: true });
    expect(await getUserLanguage(db, 'admin')).toBe('mr');
    expect(mockSet).toHaveBeenCalledWith('lang', 'mr', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  });

  it('rejects an invalid locale', async () => {
    const res = await saveLanguageAction('hi' as 'en' | 'mr');
    expect(res).toEqual({
      ok: false,
      error: 'Invalid language / अमान्य भाषा',
    });
  });
});
