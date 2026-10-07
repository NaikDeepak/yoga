import { clinicProfile } from '@/clinics';

const PREFIX = `${clinicProfile.patientCodePrefix}-`;
const CODE_REGEX = new RegExp(`^${clinicProfile.patientCodePrefix}-(\\d+)$`);

export function formatPatientCode(n: number): string {
  return `${PREFIX}${String(n).padStart(4, '0')}`;
}

export function nextPatientCode(lastCode: string | null): string {
  const match = lastCode?.match(CODE_REGEX);
  const last = match ? parseInt(match[1], 10) : 0;
  return formatPatientCode(last + 1);
}
