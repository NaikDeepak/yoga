import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { r2Storage } from './r2-storage';
import { isLocalMock } from './local-mock';

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
  const root = resolve(baseDir);
  // Storage keys are relative POSIX paths; anything that resolves outside
  // baseDir (absolute paths, .. segments, backslashes) is rejected.
  const safeTarget = (path: string): string => {
    const target = resolve(root, path);
    if (path.includes('\\') || !target.startsWith(root + sep)) {
      throw new Error(`Invalid storage path: ${path}`);
    }
    return target;
  };
  return {
    async upload(path, file) {
      const target = safeTarget(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await file.arrayBuffer()));
    },
    async remove(path) {
      await rm(safeTarget(path), { force: true });
    },
    async createSignedUrl(path) {
      safeTarget(path);
      return `/uploads/${path}`;
    },
  };
}

const R2_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

let _storage: FileStorage | undefined;
export function getStorage(): FileStorage {
  if (!_storage) {
    if (isLocalMock()) {
      _storage = localFileStorage();
      return _storage;
    }
    // Files live in Cloudflare R2 (the Supabase Storage fallback was removed 2026-10-05).
    const missing = R2_ENV.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`R2 storage is not configured: set ${missing.join(', ')}`);
    _storage = r2Storage();
  }
  return _storage;
}
