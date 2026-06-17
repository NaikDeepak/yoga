import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { saveLanguageAction } from '@/actions/preferences';
import { getUserLanguage } from '@/data/preferences';
import type { Db } from '@/db/types';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}));

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

describe('saveLanguageAction', () => {
  it('persists a valid locale to the DB', async () => {
    await saveLanguageAction('mr');
    expect(await getUserLanguage(db, 'admin')).toBe('mr');
  });

  it('rejects an invalid locale', async () => {
    await expect(saveLanguageAction('hi' as 'en' | 'mr')).rejects.toThrow(/Invalid locale/);
  });
});
