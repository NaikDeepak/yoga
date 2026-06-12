import { desc, eq } from 'drizzle-orm';
import { documents, type DocumentRow } from '@/db/schema';
import type { Db } from '@/db/types';
import type { FileStorage } from '@/lib/storage';
import type { DocType } from '@/lib/presets';

export async function addDocument(
  db: Db,
  storage: FileStorage,
  input: { patientId: string; docType: DocType; file: File },
): Promise<DocumentRow> {
  const safeName = input.file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `patients/${input.patientId}/documents/${crypto.randomUUID()}-${safeName}`;
  await storage.upload(filePath, input.file); // upload first: no DB row unless the file exists
  try {
    const [row] = await db.insert(documents).values({
      patientId: input.patientId,
      docType: input.docType,
      filePath,
      originalName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    }).returning();
    return row;
  } catch (err) {
    await storage.remove(filePath); // no orphan files on insert failure
    throw err;
  }
}

export async function listDocuments(db: Db, patientId: string): Promise<DocumentRow[]> {
  return db.select().from(documents)
    .where(eq(documents.patientId, patientId))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(db: Db, storage: FileStorage, id: string): Promise<void> {
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  if (!row) return;
  await db.delete(documents).where(eq(documents.id, id));
  await storage.remove(row.filePath);
}
