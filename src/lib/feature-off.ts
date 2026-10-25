import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';
import type { ClinicFeature } from '@/lib/features';

/**
 * The failed action result every action returns when its module is switched off for this clinic.
 * Sync and locale-free ("English / मराठी", like the other action errors) so it needs no cookies/DB.
 * `name` is part of the signature so callers say which module; the text is generic for now.
 */
export function featureOffError(_name: ClinicFeature): { ok: false; error: string } {
  return { ok: false, error: `${en.features.off} / ${mr.features.off}` };
}
