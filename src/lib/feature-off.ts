import { bilingual } from '@/lib/i18n/bilingual';
import type { ClinicFeature } from '@/lib/features';

/**
 * The failed action result every action returns when its module is switched off for this clinic.
 * Sync and locale-free ("English / Marathi", like the other action errors) so it needs no cookies/DB.
 * `name` is part of the signature so callers say which module; the text is generic for now.
 */
export function featureOffError(_name: ClinicFeature): { ok: false; error: string } {
  return { ok: false, error: bilingual('features.off') };
}
