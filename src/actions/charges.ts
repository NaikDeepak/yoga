'use server';

import { revalidatePath } from 'next/cache';
import { recordAudit } from '@/data/audit';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { isFeatureEnabled } from '@/lib/features';
import { featureOffError } from '@/lib/feature-off';
import { chargeSchema, firstError, isId, INVALID_PARAMS } from '@/lib/validation';
import { addCharge, deleteCharge } from '@/data/charges';
import { feeTypeLabel } from '@/lib/feeTypes';
import { bilingual } from '@/lib/i18n/bilingual';
import type { ActionResult } from '@/actions/patients';

export async function addChargeAction(
  patientId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!isFeatureEnabled('fees')) return featureOffError('fees');
  const user = await requireUser();
  if (typeof patientId !== 'string' || !patientId) {
    return { ok: false, error: INVALID_PARAMS };
  }
  const result = chargeSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { ok: false, error: firstError(result.error) };
  const { feeType, customLabel, amount, chargeDate, note } = result.data;
  const label = feeType === 'other' ? customLabel! : feeTypeLabel(feeType);
  const db = getDb();
  try {
    await addCharge(db, patientId, feeType, label, amount, chargeDate, note ?? null);
  } catch {
    return { ok: false, error: bilingual('charges.recordFailed') };
  }
  await recordAudit(getDb(), { actor: user, action: 'charge.add', patientId, summary: `${feeType} ₹${amount} on ${chargeDate}` });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deleteChargeAction(patientId: string, chargeId: string): Promise<ActionResult> {
  if (!isFeatureEnabled('fees')) return featureOffError('fees');
  const user = await requireUser();
  if (!isId(patientId) || !isId(chargeId)) return { ok: false, error: INVALID_PARAMS };
  const db = getDb();
  let deleted: boolean;
  try {
    deleted = await deleteCharge(db, patientId, chargeId);
  } catch {
    return { ok: false, error: bilingual('charges.deleteFailed') };
  }
  // Already gone (e.g. a double tap) is still ok, but there is nothing to record.
  if (deleted) await recordAudit(getDb(), { actor: user, action: 'charge.delete', patientId, summary: null });
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
