// Tabs of the patient detail page. Pure, so the fees switch can be tested without rendering the page.

export const PATIENT_TABS = ['overview', 'treatment', 'documents', 'fees', 'assessment'] as const;
export type PatientTab = (typeof PATIENT_TABS)[number];

// Old bookmarked/dashboard links may still use the pre-merge tab names.
const LEGACY_TAB_MAP: Record<string, PatientTab> = { problems: 'overview', progress: 'treatment' };

/** Tabs to show, in order. The fees tab only exists while the fees switch is on. */
export function patientTabKeys(feesEnabled: boolean): PatientTab[] {
  return PATIENT_TABS.filter((tab) => tab !== 'fees' || feesEnabled);
}

/** The tab to open for a `?tab=` value; unknown, legacy and switched-off tabs fall back sensibly. */
export function resolvePatientTab(raw: string | undefined, feesEnabled: boolean): PatientTab {
  const tabs = patientTabKeys(feesEnabled);
  if (raw !== undefined && (tabs as string[]).includes(raw)) return raw as PatientTab;
  return LEGACY_TAB_MAP[raw ?? ''] ?? 'overview';
}
