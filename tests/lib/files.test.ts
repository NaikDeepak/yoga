import { describe, it, expect } from 'vitest';
import { validateUpload, validatePhoto, MAX_FILE_BYTES } from '@/lib/files';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';

describe('presets', () => {
  it('has 18 preset problems and 5 doc types', () => {
    expect(PRESET_PROBLEMS).toHaveLength(18);
    expect(PRESET_PROBLEMS).toContain('कंबर दुखी');
    expect(DOC_TYPES).toEqual(['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other']);
  });
});

describe('validateUpload', () => {
  it('accepts pdf, jpeg, png at the limit', () => {
    expect(validateUpload({ type: 'application/pdf', size: MAX_FILE_BYTES })).toBeNull();
    expect(validateUpload({ type: 'image/jpeg', size: MAX_FILE_BYTES })).toBeNull();
    expect(validateUpload({ type: 'image/png', size: MAX_FILE_BYTES })).toBeNull();
  });
  it('rejects wrong type and oversize', () => {
    expect(validateUpload({ type: 'application/zip', size: 10 })).toMatch(/PDF/);
    expect(validateUpload({ type: 'image/png', size: MAX_FILE_BYTES + 1 })).toMatch(/4 MB/);
  });
});

describe('validatePhoto', () => {
  it('accepts jpeg/png, rejects pdf', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validatePhoto({ type: 'application/pdf', size: 100 })).toMatch(/JPG/);
  });
});
