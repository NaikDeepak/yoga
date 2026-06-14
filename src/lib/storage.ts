import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { r2Storage } from './r2-storage';

export const BUCKET = 'patient-files';

export interface FileStorage {
  upload(path: string, file: File): Promise<void>;
  remove(path: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export { r2Storage };

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
    _storage = process.env.R2_ACCOUNT_ID
      ? r2Storage()
      : supabaseStorage(createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ));
  }
  return _storage;
}
