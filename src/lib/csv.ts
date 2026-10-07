/**
 * Pure CSV formatting utilities adhering to RFC 4180 with UTF-8 BOM
 * and spreadsheet formula injection safeguards.
 */

function formatCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  let s = String(val);
  // Formula-injection guard, including formulas hidden behind leading whitespace (spaces, NBSP, tabs).
  if (/^[\s\u00a0]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [
    header.map(formatCell).join(','),
    ...rows.map((row) => row.map(formatCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function csvFilename(kind: string, isoDate: string): string {
  return `${kind}-${isoDate}.csv`;
}
