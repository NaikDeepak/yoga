// 18 preset ailments from the proposal (Module 2), shown in Marathi.
export const PRESET_PROBLEMS = [
  'कंबर दुखी', 'मान दुखी', 'सायटिका', 'थायरॉईड', 'PCOD/PCOS', 'डायबिटीस',
  'बीपी', 'माइग्रेन', 'निद्रानाश', 'Anxiety', 'स्थूलता', 'गुडघे दुखी',
  'स्लिप डिस्क', 'गॅसेस', 'बद्धकोष्ठता', 'सांधेदुखी', 'पाठ दुखी', 'स्ट्रेस',
] as const;

export const DOC_TYPES = ['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const BRANCHES = [
  {
    key: 'Manjari BK',
    label: 'Manjari BK',
    fullAddress: 'Shop No 8, Greenoak Society, Cement Road, near Mhasoba Mandir, Manjari Budruk, Pune, Maharashtra 412307',
  },
  {
    key: 'Kharadi',
    label: 'Kharadi',
    fullAddress: 'Survey no. 24/2B, Opposite of Konark Eureka, Sainath Nagar, Kharadi, Pune, Maharashtra 411014',
  },
  {
    key: 'Morgaon',
    label: 'Morgaon',
    fullAddress: 'Morgaon Pawarwadi, Tal-Dodamarg, Sindhudurg - 416511',
  },
] as const;

export type BranchKey = typeof BRANCHES[number]['key'];
