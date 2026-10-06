import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the R2 module boundary so @aws-sdk/* is never loaded in tests.
const fakeR2Upload = vi.fn().mockResolvedValue(undefined);
const fakeR2Remove = vi.fn().mockResolvedValue(undefined);
const fakeR2SignedUrl = vi.fn().mockResolvedValue('https://r2/signed');
const fakeR2RemovePrefix = vi.fn().mockResolvedValue(0);
vi.mock('@/lib/r2-storage', () => ({
  r2Storage: () => ({
    upload: fakeR2Upload,
    remove: fakeR2Remove,
    createSignedUrl: fakeR2SignedUrl,
    removePrefix: fakeR2RemovePrefix,
  }),
}));

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { r2Storage, getStorage, localFileStorage, clientFolder } from '@/lib/storage';


const file = () => new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });

beforeEach(() => vi.clearAllMocks());

describe('r2Storage (via mocked module boundary)', () => {
  it('upload delegates to R2', async () => {
    await r2Storage().upload('p/x.pdf', file());
    expect(fakeR2Upload).toHaveBeenCalledWith('p/x.pdf', expect.any(File));
  });

  it('remove delegates to R2', async () => {
    await r2Storage().remove('p/x.pdf');
    expect(fakeR2Remove).toHaveBeenCalledWith('p/x.pdf');
  });

  it('createSignedUrl delegates to R2 with default expiry', async () => {
    const url = await r2Storage().createSignedUrl('p/x.pdf');
    expect(url).toBe('https://r2/signed');
  });

  it('createSignedUrl passes custom expiry', async () => {
    await r2Storage().createSignedUrl('p/x.pdf', 60);
    expect(fakeR2SignedUrl).toHaveBeenCalledWith('p/x.pdf', 60);
  });
});

describe('localFileStorage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'yoga-uploads-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('round-trips a file through upload, url, and remove', async () => {
    const storage = localFileStorage(dir);
    const content = new Uint8Array([1, 2, 3]);
    const f = new File([content], 'scan.pdf', { type: 'application/pdf' });

    await storage.upload('patients/p1/documents/abc-scan.pdf', f);
    const written = await readFile(join(dir, 'patients/p1/documents/abc-scan.pdf'));
    expect(new Uint8Array(written)).toEqual(content);

    expect(await storage.createSignedUrl('patients/p1/documents/abc-scan.pdf'))
      .toBe('/uploads/patients/p1/documents/abc-scan.pdf');

    await storage.remove('patients/p1/documents/abc-scan.pdf');
    await expect(stat(join(dir, 'patients/p1/documents/abc-scan.pdf'))).rejects.toThrow();
  });

  it('remove tolerates missing files', async () => {
    await expect(localFileStorage(dir).remove('does/not/exist.pdf')).resolves.toBeUndefined();
  });

  it("removePrefix deletes one client's folder only, and counts the files", async () => {
    const storage = localFileStorage(dir);
    const a = clientFolder('11111111-1111-4111-8111-111111111111');
    const b = clientFolder('22222222-2222-4222-8222-222222222222');
    await storage.upload(`${a}photo-1.jpg`, file());
    await storage.upload(`${a}posture/x/front.jpg`, file());
    await storage.upload(`${b}photo-1.jpg`, file());
    expect(await storage.removePrefix(a)).toBe(2);
    await expect(stat(join(dir, a))).rejects.toThrow();
    expect((await stat(join(dir, `${b}photo-1.jpg`))).isFile()).toBe(true);
    expect(await storage.removePrefix(a)).toBe(0); // already gone
    await expect(storage.removePrefix('patients/')).rejects.toThrow('Invalid storage prefix');
  });

  it('rejects path traversal, absolute paths, and backslashes', async () => {
    const storage = localFileStorage(dir);
    const f = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });
    for (const evil of ['../escape.pdf', 'p/../../escape.pdf', '/etc/passwd', 'a\\..\\b.pdf']) {
      await expect(storage.upload(evil, f)).rejects.toThrow('Invalid storage path');
      await expect(storage.remove(evil)).rejects.toThrow('Invalid storage path');
      await expect(storage.createSignedUrl(evil)).rejects.toThrow('Invalid storage path');
    }
    // interior dots that don't escape are fine
    await expect(storage.createSignedUrl('p/x..y.pdf')).resolves.toBe('/uploads/p/x..y.pdf');
  });
});

describe('getStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('refuses to start without R2 outside mock mode (no Supabase Storage fallback)', async () => {
    const { getStorage: gs } = await import('@/lib/storage');
    expect(() => gs()).toThrow(/R2 storage is not configured/);
  });

  it('refuses when R2 config is incomplete', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'acct'); // missing the other three
    const { getStorage: gs } = await import('@/lib/storage');
    expect(() => gs()).toThrow(/R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET/);
  });

  it('uses local file storage in local mock mode, even with R2 configured', async () => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    vi.stubEnv('R2_ACCOUNT_ID', 'acct');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_BUCKET', 'bucket');
    const { getStorage: gs } = await import('@/lib/storage');
    expect(await gs().createSignedUrl('a/b.pdf')).toBe('/uploads/a/b.pdf');
  });

  it('uses R2 when all four R2 env vars are set', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'acct');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_BUCKET', 'bucket');
    const { getStorage: gs } = await import('@/lib/storage');
    expect(typeof gs().upload).toBe('function');
  });
});
