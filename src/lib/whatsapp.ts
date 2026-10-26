import { formatDueDate } from '@/lib/dates';
import { clinicName, clinicProfile } from '@/clinics';
import { bilingual } from '@/lib/i18n/bilingual';

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
  return `https://api.whatsapp.com/send?phone=${withCountry}&text=${encodeURIComponent(text)}`;
}

/** Home-exercise link for the client. Only the link — no name, ailment or other health detail. */
export function exerciseShareMessage(url: string): string {
  return bilingual('whatsapp.exerciseShare', { clinic: clinicName('en', true), url });
}

export function buildReminderMessage(fullName: string, nextVisitDate: string): string {
  const date = formatDueDate(nextVisitDate);
  return bilingual('whatsapp.reminder', { fullName, clinic: clinicName('en', true), date });
}

export function reminderUrl(mobile: string, fullName: string, nextVisitDate: string): string {
  return waMeUrl(mobile, buildReminderMessage(fullName, nextVisitDate));
}

export function buildDigestMessage(entries: DigestEntry[], dateISO: string): string {
  const header = `${bilingual('whatsapp.digestHeader')} — ${formatDueDate(dateISO)}`;
  if (entries.length === 0) return `${header}\n${bilingual('whatsapp.digestNoAppointments')}`;
  const lines = entries.map(
    (e, i) => `${i + 1}. ${e.fullName} (${e.patientCode}) — ${e.mobile} — ${e.branch ?? '—'}`
  );
  return [header, ...lines].join('\n');
}

export function digestUrl(entries: DigestEntry[], dateISO: string, targetMobile: string): string {
  return waMeUrl(targetMobile, buildDigestMessage(entries, dateISO));
}

/** Posture report link for the client. Only the link — no name or findings. */
export function postureShareMessage(url: string): string {
  return bilingual('whatsapp.postureShare', { clinic: clinicName('en', true), url });
}

/** Progress report link for the client. Only the link — no name, pain, weight or other health detail. */
export function progressShareMessage(url: string): string {
  return bilingual('whatsapp.progressShare', { clinic: clinicName('en', true), url });
}

/** Nudge for a client whose home check-ins stopped. First name only; no ailment or other health detail. */
export function quietNudgeMessage(firstName: string): string {
  return bilingual('whatsapp.quietNudge', { firstName, clinic: clinicName('en', true) });
}

/** Fills the birthday-wish template (`t.dashboard.birthdayWishMsg`) with the client's name and the clinic's own wording. */
export function birthdayWishText(template: string, fullName: string, locale: 'en' | 'mr'): string {
  return template
    .replaceAll('{name}', fullName)
    .replaceAll('{clinic}', clinicName(locale))
    .replaceAll('{signOff}', clinicProfile.signature.wishSignOff[locale]);
}
