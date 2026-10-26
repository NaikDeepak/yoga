import { clinicProfile } from '@/clinics';
import { mr } from '@/lib/i18n/mr';

// 18 preset ailments from the proposal (Module 2), shown in Marathi.
export const PRESET_PROBLEMS = mr.problems.presets;

export const DOC_TYPES = ['MRI', 'X-Ray', 'Blood Report', 'Prescription', 'Other'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const BRANCHES = clinicProfile.branches;
export type BranchKey = (typeof BRANCHES)[number]['key'];
