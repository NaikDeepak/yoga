import { eq, and } from 'drizzle-orm';
import type { Db } from '@/db/types';
import { fees, feePayments, type FeePayment } from '@/db/schema';

export type PaymentRecord = Omit<FeePayment, 'amount'> & { amount: number };

export type PatientFees = {
  courseFee: number | null;
  payments: PaymentRecord[];
  totalPaid: number;
  balance: number | null;
};

export async function getPatientFees(db: Db, patientId: string): Promise<PatientFees> {
  const [feeRow] = await db.select().from(fees).where(eq(fees.patientId, patientId));
  const payments = await db
    .select()
    .from(feePayments)
    .where(eq(feePayments.patientId, patientId))
    .orderBy(feePayments.paymentDate, feePayments.createdAt);
  const courseFeeStr = feeRow?.courseFee ?? null;
  const courseFee = courseFeeStr !== null ? Number(courseFeeStr) : null;
  const mappedPayments = payments.map(p => ({ ...p, amount: Number(p.amount) }));
  const totalPaid = mappedPayments.reduce((sum, p) => sum + p.amount, 0);
  return {
    courseFee,
    payments: mappedPayments,
    totalPaid,
    balance: courseFee !== null ? courseFee - totalPaid : null,
  };
}

export async function setCourseFee(db: Db, patientId: string, courseFee: number): Promise<void> {
  await db
    .insert(fees)
    .values({ patientId, courseFee: courseFee.toString() })
    .onConflictDoUpdate({
      target: fees.patientId,
      set: { courseFee: courseFee.toString(), updatedAt: new Date() },
    });
}

export async function addPayment(
  db: Db,
  patientId: string,
  amount: number,
  paymentDate: string,
  description: string | null,
): Promise<void> {
  await db.insert(feePayments).values({ patientId, amount: amount.toString(), paymentDate, description });
}

export async function deletePayment(db: Db, patientId: string, id: string): Promise<void> {
  await db.delete(feePayments).where(and(eq(feePayments.id, id), eq(feePayments.patientId, patientId)));
}
