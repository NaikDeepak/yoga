import { and, desc, eq } from 'drizzle-orm';
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

/** True if a document was deleted (false for an unknown id — nothing to record). */
export async function deleteDocument(db: Db, storage: FileStorage, patientId: string, id: string): Promise<boolean> {
  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.patientId, patientId)));
  if (!row) return false;
  await db.delete(documents).where(eq(documents.id, id));
  await storage.remove(row.filePath);
  return true;
}
