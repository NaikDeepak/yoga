const PREFIX = 'PYT-';

export function formatPatientCode(n: number): string {
  return `${PREFIX}${String(n).padStart(4, '0')}`;
}

export function nextPatientCode(lastCode: string | null): string {
  const match = lastCode?.match(/^PYT-(\d+)$/);
  const last = match ? parseInt(match[1], 10) : 0;
  return formatPatientCode(last + 1);
}
