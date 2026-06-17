import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getUserLanguage, setUserLanguage } from '@/data/preferences';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('getUserLanguage', () => {
  it('returns en when no preference row exists', async () => {
    expect(await getUserLanguage(db, 'user-123')).toBe('en');
  });

  it('returns saved language after setUserLanguage', async () => {
    await setUserLanguage(db, 'user-123', 'mr');
    expect(await getUserLanguage(db, 'user-123')).toBe('mr');
  });
});

describe('setUserLanguage', () => {
  it('upserts — calling twice updates, not duplicates', async () => {
    await setUserLanguage(db, 'user-123', 'mr');
    await setUserLanguage(db, 'user-123', 'en');
    expect(await getUserLanguage(db, 'user-123')).toBe('en');
  });
});
