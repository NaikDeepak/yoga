import { eq } from 'drizzle-orm';
import type { Db } from '@/db/types';
import { fees, feePayments, type FeePayment } from '@/db/schema';

export type PatientFees = {
  courseFee: number | null;
  payments: FeePayment[];
  totalPaid: number;
  balance: number | null;
};

export async function getPatientFees(db: Db, patientId: string): Promise<PatientFees> {
  const [feeRow] = await db.select().from(fees).where(eq(fees.patientId, patientId));
  const payments = await db
    .select()
    .from(feePayments)
    .where(eq(feePayments.patientId, patientId))
    .orderBy(feePayments.paymentDate);
  const courseFee = feeRow?.courseFee ?? null;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    courseFee,
    payments,
    totalPaid,
    balance: courseFee !== null ? courseFee - totalPaid : null,
  };
}

export async function setCourseFee(db: Db, patientId: string, courseFee: number): Promise<void> {
  await db
    .insert(fees)
    .values({ patientId, courseFee })
    .onConflictDoUpdate({
      target: fees.patientId,
      set: { courseFee, updatedAt: new Date() },
    });
}

export async function addPayment(
  db: Db,
  patientId: string,
  amount: number,
  paymentDate: string,
  description: string | null,
): Promise<void> {
  await db.insert(feePayments).values({ patientId, amount, paymentDate, description });
}

export async function deletePayment(db: Db, id: string): Promise<void> {
  await db.delete(feePayments).where(eq(feePayments.id, id));
}
