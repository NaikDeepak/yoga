import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '@/db/types';
import { charges, type Charge } from '@/db/schema';

export type ChargeRecord = Omit<Charge, 'amount'> & { amount: number };

function toChargeRecord(row: Charge): ChargeRecord {
  return { ...row, amount: Number(row.amount) };
}

export async function addCharge(
  db: Db,
  patientId: string,
  feeType: string,
  label: string,
  amount: number,
  chargeDate: string,
  note: string | null,
): Promise<ChargeRecord> {
  const [row] = await db
    .insert(charges)
    .values({ patientId, feeType, label, amount: amount.toString(), chargeDate, note })
    .returning();
  return toChargeRecord(row);
}

export async function listCharges(db: Db, patientId: string): Promise<ChargeRecord[]> {
  const rows = await db
    .select()
    .from(charges)
    .where(eq(charges.patientId, patientId))
    .orderBy(desc(charges.chargeDate), desc(charges.createdAt));
  return rows.map(toChargeRecord);
}

export async function getCharge(db: Db, patientId: string, id: string): Promise<ChargeRecord | null> {
  const [row] = await db
    .select()
    .from(charges)
    .where(and(eq(charges.id, id), eq(charges.patientId, patientId)));
  return row ? toChargeRecord(row) : null;
}

/** False when this client has no such charge (already deleted, or another client's). */
export async function deleteCharge(db: Db, patientId: string, id: string): Promise<boolean> {
  const rows = await db.delete(charges)
    .where(and(eq(charges.id, id), eq(charges.patientId, patientId)))
    .returning({ id: charges.id });
  return rows.length > 0;
}
