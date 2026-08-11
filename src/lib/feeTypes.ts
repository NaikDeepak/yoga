// Preset fee types for standalone charges (Consultation, Monthly Yoga Fee, etc).
// Follows the same { key, label } shape as BRANCHES in ./presets.ts.
export const FEE_TYPES = [
  { key: 'consultation', label: 'Consultation Fee / सल्ला शुल्क', defaultAmount: 500 },
  { key: 'monthly_yoga', label: 'Monthly Yoga Fee / मासिक योग शुल्क', defaultAmount: 3000 },
  { key: 'package', label: 'Package Fee / पॅकेज शुल्क', defaultAmount: null },
  { key: 'other', label: 'Other / इतर', defaultAmount: null },
] as const;

export type FeeTypeKey = typeof FEE_TYPES[number]['key'];
export const FEE_TYPE_KEYS = FEE_TYPES.map((f) => f.key) as [FeeTypeKey, ...FeeTypeKey[]];

export function feeTypeLabel(key: FeeTypeKey): string {
  return FEE_TYPES.find((f) => f.key === key)!.label;
}
