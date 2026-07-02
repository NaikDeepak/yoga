import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { r2Storage } from './r2-storage';
import { isLocalMock } from './local-mock';

export const BUCKET = 'patient-files';
export const LOCAL_UPLOADS_DIR = 'public/uploads';

export interface FileStorage {
  upload(path: string, file: File): Promise<void>;
  remove(path: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export { r2Storage };

// Local mock mode: files live under public/uploads so `next dev` serves them
// directly. URLs are not signed or access-controlled — dev-only by design
// (isLocalMock() refuses to run in production).
export function localFileStorage(baseDir: string = LOCAL_UPLOADS_DIR): FileStorage {
  return {
    async upload(path, file) {
      const target = join(baseDir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await file.arrayBuffer()));
    },
    async remove(path) {
      await rm(join(baseDir, path), { force: true });
    },
    async createSignedUrl(path) {
      return `/uploads/${path}`;
    },
  };
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
    if (isLocalMock()) {
      _storage = localFileStorage();
      return _storage;
    }
    const r2Ready = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
    _storage = r2Ready
      ? r2Storage()
      : supabaseStorage(createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ));
  }
  return _storage;
}
