import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'patient-files';

export interface FileStorage {
  upload(path: string, file: File): Promise<void>;
  remove(path: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export function supabaseStorage(client: SupabaseClient): FileStorage {
  return {
    async upload(path, file) {
      const { error } = await client.storage.from(BUCKET).upload(path, file);
      if (error) throw new Error(`Upload failed: ${error.message}`);
    },
    async remove(path) {
      const { error } = await client.storage.from(BUCKET).remove([path]);
      if (error) throw new Error(`Remove failed: ${error.message}`);
    },
    async createSignedUrl(path, expiresInSeconds = 3600) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
      return data.signedUrl;
    },
  };
}

let _storage: FileStorage | undefined;
export function getStorage(): FileStorage {
  if (!_storage) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    _storage = supabaseStorage(client);
  }
  return _storage;
}
