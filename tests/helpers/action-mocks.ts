import { vi } from 'vitest';
import { createTestDb } from './db';
import { FakeStorage } from './fake-storage';
import type { Db } from '@/db/types';

export const storage = new FakeStorage();
export let testDb: Db;

export async function freshTestDb(): Promise<Db> {
  testDb = await createTestDb();
  storage.files.clear();
  return testDb;
}

vi.mock('@/db/client', () => ({ getDb: () => testDb }));
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getStorage: () => storage,
}));
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn().mockResolvedValue({ id: 'admin' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));
