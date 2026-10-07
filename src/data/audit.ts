// Audit log (spec 2026-10-07-audit-log): who changed, deleted or exported what. Entries name the client
// by code only — never names or health details — so they can outlive a client's permanent deletion.
import { desc, eq, lt } from 'drizzle-orm';
import { auditLog, patients, type AuditRow } from '@/db/schema';
import type { Db } from '@/db/types';
import { safeErrorMessage } from '@/lib/log';

export type AuditAction =
  | 'client.create' | 'client.update' | 'client.delete'
  | 'visit.add'
  | 'fee.set' | 'payment.add' | 'payment.delete' | 'charge.add' | 'charge.delete'
  | 'document.upload' | 'document.delete'
  | 'problem.add' | 'problem.remove'
  | 'treatment.save' | 'lifestyle.save' | 'exercises.save'
  | 'posture.add' | 'posture.retake' | 'posture.delete' | 'posture.ai_approve' | 'flexibility.save' | 'photos.withdraw'
  | 'share.create' | 'share.revoke'
  | 'export';

export interface AuditEntry {
  actor: { id: string; email?: string | null };
  action: AuditAction;
  /** The client concerned; their code is looked up (pass `clientCode` instead when the row is gone). */
  patientId?: string | null;
  clientCode?: string | null;
  /** Short, non-identifying detail (amounts, dates, kinds) — never names or clinical text. */
  summary?: string | null;
}

/** Best effort: an audit write must never make the action itself fail (the error is logged, without data). */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  try {
    let clientCode = entry.clientCode ?? null;
    if (!clientCode && entry.patientId) {
      const [p] = await db.select({ code: patients.patientCode }).from(patients).where(eq(patients.id, entry.patientId));
      clientCode = p?.code ?? null;
    }
    await db.insert(auditLog).values({
      actorId: entry.actor.id,
      actorEmail: entry.actor.email ?? null,
      action: entry.action,
      patientId: entry.patientId ?? null,
      clientCode,
      summary: entry.summary ?? null,
    });
  } catch (err) {
    console.error('Audit write failed:', safeErrorMessage(err));
  }
}

/** Newest first (write order); `before` = id of the last row of the previous page. */
export async function listAudit(db: Db, { limit = 50, before }: { limit?: number; before?: string } = {}): Promise<AuditRow[]> {
  let cursor;
  if (before) {
    const [b] = await db.select({ seq: auditLog.seq }).from(auditLog).where(eq(auditLog.id, before));
    if (b) cursor = lt(auditLog.seq, b.seq);
  }
  return db.select().from(auditLog).where(cursor).orderBy(desc(auditLog.seq)).limit(limit);
}
