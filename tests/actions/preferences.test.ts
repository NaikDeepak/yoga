import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { saveLanguageAction, saveWhatsappNumberAction } from '@/actions/preferences';
import { getUserLanguage, getWhatsappNumber, setWhatsappNumber } from '@/data/preferences';
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

function whatsappFd(value: string): FormData {
  const f = new FormData();
  f.set('whatsappNumber', value);
  return f;
}

describe('saveWhatsappNumberAction', () => {
  it('saves a valid 10-digit number', async () => {
    const res = await saveWhatsappNumberAction(whatsappFd('9876543210'));
    expect(res).toEqual({ ok: true });
    expect(await getWhatsappNumber(db, 'admin')).toBe('9876543210');
  });

  it('trims surrounding whitespace', async () => {
    const res = await saveWhatsappNumberAction(whatsappFd('  9876543210  '));
    expect(res).toEqual({ ok: true });
    expect(await getWhatsappNumber(db, 'admin')).toBe('9876543210');
  });

  it('rejects a 9-digit number with the bilingual error', async () => {
    const res = await saveWhatsappNumberAction(whatsappFd('987654321'));
    expect(res).toEqual({ ok: false, error: '10-digit mobile required / १० अंकी मोबाईल आवश्यक' });
    expect(await getWhatsappNumber(db, 'admin')).toBeNull();
  });

  it('rejects letters', async () => {
    const res = await saveWhatsappNumberAction(whatsappFd('98765abcde'));
    expect(res).toEqual({ ok: false, error: '10-digit mobile required / १० अंकी मोबाईल आवश्यक' });
  });

  it('empty input clears an existing number', async () => {
    await setWhatsappNumber(db, 'admin', '9876543210');
    const res = await saveWhatsappNumberAction(whatsappFd(''));
    expect(res).toEqual({ ok: true });
    expect(await getWhatsappNumber(db, 'admin')).toBeNull();
  });
});
