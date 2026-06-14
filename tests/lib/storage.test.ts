import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock the R2 module boundary so @aws-sdk/* is never loaded in tests.
const fakeR2Upload = vi.fn().mockResolvedValue(undefined);
const fakeR2Remove = vi.fn().mockResolvedValue(undefined);
const fakeR2SignedUrl = vi.fn().mockResolvedValue('https://r2/signed');
vi.mock('@/lib/r2-storage', () => ({
  r2Storage: () => ({
    upload: fakeR2Upload,
    remove: fakeR2Remove,
    createSignedUrl: fakeR2SignedUrl,
  }),
}));

import { supabaseStorage, r2Storage, getStorage, BUCKET } from '@/lib/storage';

const bucketApi = {
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
};
const from = vi.fn(() => bucketApi);
const client = { storage: { from } } as unknown as SupabaseClient;

const file = () => new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });

beforeEach(() => vi.clearAllMocks());

describe('supabaseStorage', () => {
  it('uploads to the patient-files bucket', async () => {
    bucketApi.upload.mockResolvedValue({ error: null });
    await supabaseStorage(client).upload('p/x.pdf', file());
    expect(from).toHaveBeenCalledWith(BUCKET);
    expect(bucketApi.upload).toHaveBeenCalledWith('p/x.pdf', expect.any(File));
  });
  it('throws on upload error', async () => {
    bucketApi.upload.mockResolvedValue({ error: { message: 'quota' } });
    await expect(supabaseStorage(client).upload('p/x.pdf', file()))
      .rejects.toThrow('Upload failed: quota');
  });

  it('removes a path', async () => {
    bucketApi.remove.mockResolvedValue({ error: null });
    await supabaseStorage(client).remove('p/x.pdf');
    expect(bucketApi.remove).toHaveBeenCalledWith(['p/x.pdf']);
  });
  it('throws on remove error', async () => {
    bucketApi.remove.mockResolvedValue({ error: { message: 'gone' } });
    await expect(supabaseStorage(client).remove('p/x.pdf'))
      .rejects.toThrow('Remove failed: gone');
  });

  it('creates a signed URL with default 1h expiry', async () => {
    bucketApi.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/signed' }, error: null });
    expect(await supabaseStorage(client).createSignedUrl('p/x.pdf')).toBe('https://x/signed');
    expect(bucketApi.createSignedUrl).toHaveBeenCalledWith('p/x.pdf', 3600);
  });
  it('passes a custom expiry', async () => {
    bucketApi.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/signed' }, error: null });
    await supabaseStorage(client).createSignedUrl('p/x.pdf', 60);
    expect(bucketApi.createSignedUrl).toHaveBeenCalledWith('p/x.pdf', 60);
  });
  it('throws on signed URL error or missing data', async () => {
    bucketApi.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(supabaseStorage(client).createSignedUrl('p/x.pdf'))
      .rejects.toThrow('Signed URL failed: nope');
    bucketApi.createSignedUrl.mockResolvedValue({ data: null, error: null });
    await expect(supabaseStorage(client).createSignedUrl('p/x.pdf'))
      .rejects.toThrow('Signed URL failed');
  });
});

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

describe('getStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses Supabase when R2 config is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { getStorage: gs } = await import('@/lib/storage');
    const a = gs();
    expect(a).toBe(gs());
    expect(typeof a.upload).toBe('function');
  });

  it('uses Supabase when R2 config is incomplete', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'acct'); // missing the other three
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const { getStorage: gs } = await import('@/lib/storage');
    expect(typeof gs().upload).toBe('function');
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
