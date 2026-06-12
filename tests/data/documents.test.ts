import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { FakeStorage } from '../helpers/fake-storage';
import { createPatient } from '@/data/patients';
import { addDocument, listDocuments, deleteDocument } from '@/data/documents';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;
let storage: FakeStorage;
let patientId: string;

const pdf = () => new File([new Uint8Array([1, 2, 3])], 'mri-scan.pdf', { type: 'application/pdf' });

beforeEach(async () => {
  db = await createTestDb();
  storage = new FakeStorage();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210' })).id;
});

describe('addDocument', () => {
  it('uploads file then inserts row with metadata', async () => {
    const doc = await addDocument(db, storage, { patientId, docType: 'MRI', file: pdf() });
    expect(doc.originalName).toBe('mri-scan.pdf');
    expect(doc.sizeBytes).toBe(3);
    expect(storage.files.has(doc.filePath)).toBe(true);
    expect(doc.filePath).toContain(`patients/${patientId}/documents/`);
  });
  it('does not insert a row when upload fails', async () => {
    storage.failNextUpload = true;
    await expect(addDocument(db, storage, { patientId, docType: 'MRI', file: pdf() }))
      .rejects.toThrow('storage down');
    expect(await db.select().from(documents)).toHaveLength(0);
  });
});

describe('listDocuments / deleteDocument', () => {
  it('lists by patient and deletes row + file', async () => {
    const doc = await addDocument(db, storage, { patientId, docType: 'Prescription', file: pdf() });
    expect(await listDocuments(db, patientId)).toHaveLength(1);
    await deleteDocument(db, storage, doc.id);
    expect(await listDocuments(db, patientId)).toHaveLength(0);
    expect(storage.files.size).toBe(0);
  });
  it('ignores delete of unknown id', async () => {
    await expect(deleteDocument(db, storage, '00000000-0000-0000-0000-000000000000'))
      .resolves.toBeUndefined();
  });
});
