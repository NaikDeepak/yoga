import { bilingual } from '@/lib/i18n/bilingual';

// 4 MB: Vercel serverless functions reject request bodies over ~4.5 MB, so a
// larger advertised limit would fail with an opaque 413 after upload starts.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const PHOTO_MIME = ['image/jpeg', 'image/png'];

type FileLike = { type: string; size: number };

export function validateUpload(file: FileLike): string | null {
  if (!DOC_MIME.includes(file.type)) return bilingual('documents.onlyPdfJpgPng');
  if (file.size > MAX_FILE_BYTES) return bilingual('documents.fileTooLarge');
  return null;
}

export function validatePhoto(file: FileLike): string | null {
  if (!PHOTO_MIME.includes(file.type)) return bilingual('documents.photoMustBeJpgPng');
  if (file.size > MAX_FILE_BYTES) return bilingual('documents.fileTooLarge');
  return null;
}
