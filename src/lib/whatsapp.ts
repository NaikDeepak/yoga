import { formatDueDate } from '@/lib/dates';
import { clinicName, clinicProfile } from '@/clinics';

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
  return `Namaskar 🙏 Your home exercises from ${clinicName('en', true)}: ${url} / नमस्कार 🙏 आपले घरगुती व्यायाम: ${url}`;
}

export function buildReminderMessage(fullName: string, nextVisitDate: string): string {
  const date = formatDueDate(nextVisitDate);
  return `Hello ${fullName}, a reminder from ${clinicName('en', true)} — your next session is on ${date}. / नमस्कार ${fullName}, आपल्या पुढील योग थेरपी भेटीची आठवण — ${date} रोजी आहे.`;
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

/** Posture report link for the client. Only the link — no name or findings. */
export function postureShareMessage(url: string): string {
  return `Namaskar 🙏 Your posture report from ${clinicName('en', true)}: ${url} / नमस्कार 🙏 आपला पोश्चर अहवाल: ${url}`;
}

/** Progress report link for the client. Only the link — no name, pain, weight or other health detail. */
export function progressShareMessage(url: string): string {
  return `Namaskar 🙏 Your progress report from ${clinicName('en', true)}: ${url} / नमस्कार 🙏 आपला प्रगती अहवाल: ${url}`;
}

/** Nudge for a client whose home check-ins stopped. First name only; no ailment or other health detail. */
export function quietNudgeMessage(firstName: string): string {
  return `Namaskar ${firstName} 🙏 A gentle reminder from ${clinicName('en', true)}: please do your home exercises today and tick them off on the exercise link we sent you. / नमस्कार ${firstName} 🙏 आज आपले घरगुती व्यायाम करा आणि आम्ही पाठवलेल्या लिंकवर नोंद करा.`;
}

/** Fills the birthday-wish template (`t.dashboard.birthdayWishMsg`) with the client's name and the clinic's own wording. */
export function birthdayWishText(template: string, fullName: string, locale: 'en' | 'mr'): string {
  return template
    .replaceAll('{name}', fullName)
    .replaceAll('{clinic}', clinicName(locale))
    .replaceAll('{signOff}', clinicProfile.signature.wishSignOff[locale]);
}
