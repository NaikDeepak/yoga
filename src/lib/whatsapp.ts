import { formatDueDate } from '@/lib/dates';

// Structural subset of FollowUp (src/data/visits.ts) — kept local so lib never imports from data.
export type DigestEntry = {
  fullName: string;
  patientCode: string;
  mobile: string;
  branch: string | null;
};

export function waMeUrl(mobile: string, text: string): string {
  const digits = mobile.replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

export function buildReminderMessage(fullName: string, nextVisitDate: string): string {
  const date = formatDueDate(nextVisitDate);
  return `Hello ${fullName}, a reminder from Pawar's Yog Therapy — your next session is on ${date}. / नमस्कार ${fullName}, आपल्या पुढील योग थेरपी भेटीची आठवण — ${date} रोजी आहे.`;
}

export function reminderUrl(mobile: string, fullName: string, nextVisitDate: string): string {
  return waMeUrl(mobile, buildReminderMessage(fullName, nextVisitDate));
}

export function buildDigestMessage(entries: DigestEntry[], dateISO: string): string {
  const header = `Tomorrow's appointments / उद्याच्या भेटी — ${formatDueDate(dateISO)}`;
  if (entries.length === 0) return `${header}\nNo appointments / भेटी नाहीत`;
  const lines = entries.map(
    (e, i) => `${i + 1}. ${e.fullName} (${e.patientCode}) — ${e.mobile} — ${e.branch ?? '—'}`
  );
  return [header, ...lines].join('\n');
}

export function digestUrl(entries: DigestEntry[], dateISO: string, targetMobile: string): string {
  return waMeUrl(targetMobile, buildDigestMessage(entries, dateISO));
}
