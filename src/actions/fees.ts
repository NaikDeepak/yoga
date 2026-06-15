'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { courseFeeSchema, paymentSchema, firstError } from '@/lib/validation';
import { setCourseFee, addPayment, deletePayment } from '@/data/fees';
import type { ActionResult } from '@/actions/patients';

export async function setCourseFeeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = courseFeeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const db = getDb();
  try {
    await setCourseFee(db, patientId, result.data.courseFee);
  } catch {
    return { ok: false, error: 'Could not save fee / शुल्क जतन झाले नाही' };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function addPaymentAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const { amount, paymentDate, description } = result.data;
  const db = getDb();
  try {
    await addPayment(db, patientId, amount, paymentDate, description ?? null);
  } catch {
    return { ok: false, error: 'Could not record payment / पेमेंट नोंदवता आले नाही' };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deletePaymentAction(patientId: string, paymentId: string): Promise<ActionResult> {
  await requireUser();
  const db = getDb();
  try {
    await deletePayment(db, paymentId);
  } catch {
    return { ok: false, error: 'Could not delete payment / पेमेंट हटवता आले नाही' };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
