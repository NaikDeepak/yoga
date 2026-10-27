import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getUserLanguage, setUserLanguage, getWhatsappNumber, setWhatsappNumber, moveUserPreferences } from '@/data/preferences';
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

describe('getWhatsappNumber', () => {
  it('returns null when no preference row exists', async () => {
    expect(await getWhatsappNumber(db, 'user-123')).toBeNull();
  });

  it('returns the saved number after setWhatsappNumber', async () => {
    await setWhatsappNumber(db, 'user-123', '9876543210');
    expect(await getWhatsappNumber(db, 'user-123')).toBe('9876543210');
  });
});

describe('setWhatsappNumber', () => {
  it('inserts a row with default language en when none exists', async () => {
    await setWhatsappNumber(db, 'user-123', '9876543210');
    expect(await getUserLanguage(db, 'user-123')).toBe('en');
  });

  it('does not clobber an existing language preference', async () => {
    await setUserLanguage(db, 'user-123', 'mr');
    await setWhatsappNumber(db, 'user-123', '9876543210');
    expect(await getUserLanguage(db, 'user-123')).toBe('mr');
  });

  it('is not clobbered by a later setUserLanguage', async () => {
    await setWhatsappNumber(db, 'user-123', '9876543210');
    await setUserLanguage(db, 'user-123', 'mr');
    expect(await getWhatsappNumber(db, 'user-123')).toBe('9876543210');
  });

  it('clears the number when passed null', async () => {
    await setWhatsappNumber(db, 'user-123', '9876543210');
    await setWhatsappNumber(db, 'user-123', null);
    expect(await getWhatsappNumber(db, 'user-123')).toBeNull();
  });

  it('rejects a malformed number at the DB check constraint', async () => {
    await expect(setWhatsappNumber(db, 'user-123', '12345')).rejects.toThrow();
  });
});

describe('moveUserPreferences', () => {
  it('moves the language and WhatsApp number to the new user id and returns 1', async () => {
    await setUserLanguage(db, 'old-id', 'mr');
    await setWhatsappNumber(db, 'old-id', '9876543210');
    expect(await moveUserPreferences(db, 'old-id', 'new-id')).toBe(1);
    expect(await getUserLanguage(db, 'new-id')).toBe('mr');
    expect(await getWhatsappNumber(db, 'new-id')).toBe('9876543210');
    expect(await getWhatsappNumber(db, 'old-id')).toBeNull();
  });

  it('refuses when the old id has no row', async () => {
    await expect(moveUserPreferences(db, 'old-id', 'new-id')).rejects.toThrow(/--from/);
  });

  it('refuses when the new id already has a row, and leaves both rows alone', async () => {
    await setUserLanguage(db, 'old-id', 'mr');
    await setUserLanguage(db, 'new-id', 'en');
    await expect(moveUserPreferences(db, 'old-id', 'new-id')).rejects.toThrow(/--to/);
    expect(await getUserLanguage(db, 'old-id')).toBe('mr');
    expect(await getUserLanguage(db, 'new-id')).toBe('en');
  });

  it('refuses the same id twice', async () => {
    await setUserLanguage(db, 'same', 'mr');
    await expect(moveUserPreferences(db, 'same', 'same')).rejects.toThrow(/differ/);
  });
});
