// 18 preset ailments from the proposal (Module 2), shown in Marathi.
export const PRESET_PROBLEMS = [
  'कंबर दुखी', 'मान दुखी', 'सायटिका', 'थायरॉईड', 'PCOD/PCOS', 'डायबिटीस',
  'बीपी', 'माइग्रेन', 'निद्रानाश', 'Anxiety', 'स्थूलता', 'गुडघे दुखी',
  'स्लिप डिस्क', 'गॅसेस', 'बद्धकोष्ठता', 'सांधेदुखी', 'पाठ दुखी', 'स्ट्रेस',
] as const;

export const DOC_TYPES = ['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other'] as const;
export type DocType = (typeof DOC_TYPES)[number];
