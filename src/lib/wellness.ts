import messages from './wellness-messages.json';
import { CLINIC } from './clinic';

export type WellnessMessage = { en: string; mr: string };

export const WELLNESS_MESSAGES: WellnessMessage[] = messages;

/** Deterministic "tip of the day": same date always picks the same message. */
export function wellnessMessageForDay(dateISO: string): WellnessMessage {
  const [year, month, day] = dateISO.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return WELLNESS_MESSAGES[dayNumber % WELLNESS_MESSAGES.length];
}

export function buildWellnessMessage(msg: WellnessMessage): string {
  // BMP-safe emoji only (≤ U+FFFF): WhatsApp Desktop's wa.me handler mangles surrogate pairs.
  return `☘ ${msg.en}\n\n${msg.mr}\n\n— ${CLINIC.name}`;
}

/** No phone number: WhatsApp opens its contact picker, so the doctor can pick a broadcast list or group. */
export function wellnessShareUrl(msg: WellnessMessage): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(buildWellnessMessage(msg))}`;
}
