import type { FileStorage } from '@/lib/storage';

export class FakeStorage implements FileStorage {
  files = new Map<string, Uint8Array>();
  failNextUpload = false;

  async upload(path: string, file: File): Promise<void> {
    if (this.failNextUpload) { this.failNextUpload = false; throw new Error('storage down'); }
    this.files.set(path, new Uint8Array(await file.arrayBuffer()));
  }
  async remove(path: string): Promise<void> { this.files.delete(path); }
  async createSignedUrl(path: string): Promise<string> { return `https://fake.local/${path}?signed`; }
}
