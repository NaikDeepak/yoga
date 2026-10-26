import { bilingual } from '@/lib/i18n/bilingual';

// Preset fee types for standalone charges. The clinic profile (`practice.feeTypes`) picks which ones it offers
// and the default amounts; this list is every type the app knows (stored charges keep working whatever the profile).
// Follows the same { key, label } shape as BRANCHES in ./presets.ts.
export const FEE_TYPES = [
  { key: 'consultation' as const, label: bilingual('charges.feeTypeConsultation'), defaultAmount: 500 },
  { key: 'monthly_yoga' as const, label: bilingual('charges.feeTypeMonthlyYoga'), defaultAmount: 3000 },
  { key: 'package' as const, label: bilingual('charges.feeTypePackage'), defaultAmount: null },
  { key: 'session' as const, label: bilingual('charges.feeTypeSession'), defaultAmount: null },
  { key: 'assessment' as const, label: bilingual('charges.feeTypeAssessment'), defaultAmount: null },
  { key: 'other' as const, label: bilingual('charges.feeTypeOther'), defaultAmount: null },
] as const;

export type FeeTypeKey = typeof FEE_TYPES[number]['key'];
export const FEE_TYPE_KEYS = FEE_TYPES.map((f) => f.key) as [FeeTypeKey, ...FeeTypeKey[]];

/** Label for any known key; an unknown key is returned as it is. */
export function feeTypeLabel(key: string): string {
  return FEE_TYPES.find((f) => f.key === key)?.label ?? key;
}
