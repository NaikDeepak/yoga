export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const PHOTO_MIME = ['image/jpeg', 'image/png'];

type FileLike = { type: string; size: number };

export function validateUpload(file: FileLike): string | null {
  if (!DOC_MIME.includes(file.type)) return 'Only PDF, JPG, PNG allowed / फक्त PDF, JPG, PNG';
  if (file.size > MAX_FILE_BYTES) return 'File too large, max 10 MB / फाईल 10 MB पेक्षा लहान हवी';
  return null;
}

export function validatePhoto(file: FileLike): string | null {
  if (!PHOTO_MIME.includes(file.type)) return 'Photo must be JPG or PNG / फोटो JPG किंवा PNG हवा';
  if (file.size > MAX_FILE_BYTES) return 'File too large, max 10 MB / फाईल 10 MB पेक्षा लहान हवी';
  return null;
}
