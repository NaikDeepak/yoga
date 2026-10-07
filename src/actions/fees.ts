'use server';

import { revalidatePath } from 'next/cache';
import { recordAudit } from '@/data/audit';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { courseFeeSchema, paymentSchema, firstError, isId, INVALID_PARAMS } from '@/lib/validation';
import { setCourseFee, addPayment, deletePayment } from '@/data/fees';
import type { ActionResult } from '@/actions/patients';

export async function setCourseFeeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const result = courseFeeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const db = getDb();
  try {
    await setCourseFee(db, patientId, result.data.courseFee);
  } catch {
    return { ok: false, error: 'Could not save fee / शुल्क जतन झाले नाही' };
  }
  await recordAudit(getDb(), { actor: user, action: 'fee.set', patientId, summary: `₹${result.data.courseFee}` });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function addPaymentAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const result = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const { amount, paymentDate, description } = result.data;
  const db = getDb();
  try {
    await addPayment(db, patientId, amount, paymentDate, description ?? null);
  } catch {
    return { ok: false, error: 'Could not record payment / पेमेंट नोंदवता आले नाही' };
  }
  await recordAudit(getDb(), { actor: user, action: 'payment.add', patientId, summary: `₹${amount} on ${paymentDate}` });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deletePaymentAction(patientId: string, paymentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isId(patientId) || !isId(paymentId)) return { ok: false, error: INVALID_PARAMS };
  const db = getDb();
  let deleted: boolean;
  try {
    deleted = await deletePayment(db, patientId, paymentId);
  } catch {
    return { ok: false, error: 'Could not delete payment / पेमेंट हटवता आले नाही' };
  }
  // Already gone (e.g. a double tap) is still ok, but there is nothing to record.
  if (deleted) await recordAudit(getDb(), { actor: user, action: 'payment.delete', patientId, summary: null });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
