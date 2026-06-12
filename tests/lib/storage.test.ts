import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseStorage, getStorage, BUCKET } from '@/lib/storage';

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

describe('getStorage', () => {
  it('builds a singleton from env config', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const a = getStorage();
    expect(a).toBe(getStorage());
    expect(typeof a.upload).toBe('function');
    vi.unstubAllEnvs();
  });
});
