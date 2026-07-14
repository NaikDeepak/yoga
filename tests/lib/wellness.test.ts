import { describe, it, expect } from 'vitest';
import {
  WELLNESS_MESSAGES,
  wellnessMessageForDay,
  buildWellnessMessage,
  wellnessShareUrl,
} from '@/lib/wellness';
import { CLINIC } from '@/lib/clinic';

describe('WELLNESS_MESSAGES', () => {
  it('has at least 10 messages', () => {
    expect(WELLNESS_MESSAGES.length).toBeGreaterThanOrEqual(10);
  });

  it('every message has non-empty English and Marathi text', () => {
    for (const m of WELLNESS_MESSAGES) {
      expect(m.en.trim().length).toBeGreaterThan(0);
      expect(m.mr.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('wellnessMessageForDay', () => {
  it('is deterministic for the same date', () => {
    expect(wellnessMessageForDay('2026-07-14')).toEqual(wellnessMessageForDay('2026-07-14'));
  });

  it('cycles to a different message on consecutive days', () => {
    expect(wellnessMessageForDay('2026-07-14')).not.toEqual(wellnessMessageForDay('2026-07-15'));
  });

  it('wraps around the message list', () => {
    const len = WELLNESS_MESSAGES.length;
    // Two dates exactly `len` days apart pick the same message.
    expect(wellnessMessageForDay('2026-01-01')).toEqual(
      wellnessMessageForDay(`2026-01-${String(1 + len).padStart(2, '0')}`),
    );
  });
});

describe('buildWellnessMessage', () => {
  it('contains both languages and the clinic name', () => {
    const m = { en: 'Drink water.', mr: 'पाणी प्या.' };
    const text = buildWellnessMessage(m);
    expect(text).toContain('Drink water.');
    expect(text).toContain('पाणी प्या.');
    expect(text).toContain(CLINIC.name);
  });
});

describe('wellnessShareUrl', () => {
  it('builds a wa.me URL without a phone number so WhatsApp opens its contact picker', () => {
    const m = { en: 'Drink water.', mr: 'पाणी प्या.' };
    const url = wellnessShareUrl(m);
    expect(url.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent('Drink water.'));
  });
});
