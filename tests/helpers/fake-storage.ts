import type { FileStorage } from '@/lib/storage';
import { assertClientFolder } from '@/lib/storage-paths';

export class FakeStorage implements FileStorage {
  files = new Map<string, Uint8Array>();
  failNextUpload = false;
  failNextRemovePrefix = false;

  async upload(path: string, file: File): Promise<void> {
    if (this.failNextUpload) { this.failNextUpload = false; throw new Error('storage down'); }
    this.files.set(path, new Uint8Array(await file.arrayBuffer()));
  }
  async remove(path: string): Promise<void> { this.files.delete(path); }
  async createSignedUrl(path: string): Promise<string> { return `https://fake.local/${path}?signed`; }
  async removePrefix(prefix: string): Promise<number> {
    assertClientFolder(prefix);
    if (this.failNextRemovePrefix) { this.failNextRemovePrefix = false; throw new Error('storage down'); }
    const keys = [...this.files.keys()].filter((k) => k.startsWith(prefix));
    keys.forEach((k) => this.files.delete(k));
    return keys.length;
  }
}
