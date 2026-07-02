import { describe, it, expect } from 'vitest';
import {
  waMeUrl,
  buildReminderMessage,
  reminderUrl,
  buildDigestMessage,
  digestUrl,
  type DigestEntry,
} from '@/lib/whatsapp';
import { CLINIC } from '@/lib/clinic';

describe('waMeUrl', () => {
  it('prefixes 91 to a 10-digit mobile', () => {
    expect(waMeUrl('9876543210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });

  it('passes a 12-digit 91-prefixed number through unchanged', () => {
    expect(waMeUrl('919876543210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });

  it('strips non-digit characters before prefixing', () => {
    expect(waMeUrl('+91 98765 43210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
    expect(waMeUrl('98765-43210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });

  it('URL-encodes the text, including spaces, ampersands, newlines and Devanagari', () => {
    const url = waMeUrl('9876543210', 'a b&c\nनमस्कार');
    expect(url).toBe(`https://wa.me/919876543210?text=${encodeURIComponent('a b&c\nनमस्कार')}`);
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&c');
  });
});

describe('buildReminderMessage', () => {
  it('is byte-for-byte the message the dashboard produced before the refactor', () => {
    expect(buildReminderMessage('Sunita Patil', '2026-07-03')).toBe(
      "Hello Sunita Patil, a reminder from Pawar's Yog Therapy — your next session is on 03 Jul. / नमस्कार Sunita Patil, आपल्या पुढील योग थेरपी भेटीची आठवण — 03 Jul रोजी आहे."
    );
  });

  it('includes the patient name in both language halves', () => {
    const msg = buildReminderMessage('Ramesh', '2026-12-09');
    const [en, mr] = msg.split(' / ');
    expect(en).toContain('Ramesh');
    expect(mr).toContain('Ramesh');
    expect(msg).toContain('09 Dec');
  });
});

describe('reminderUrl', () => {
  it('equals the old dashboard whatsappUrl output verbatim', () => {
    const text = `Hello Sunita Patil, a reminder from Pawar's Yog Therapy — your next session is on 03 Jul. / नमस्कार Sunita Patil, आपल्या पुढील योग थेरपी भेटीची आठवण — 03 Jul रोजी आहे.`;
    expect(reminderUrl('9876543210', 'Sunita Patil', '2026-07-03')).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent(text)}`
    );
  });
});

const entry = (over: Partial<DigestEntry> = {}): DigestEntry => ({
  fullName: 'Sunita Patil',
  patientCode: 'PYT-0007',
  mobile: '9876543210',
  branch: 'Kharadi',
  ...over,
});

describe('buildDigestMessage', () => {
  it('starts with the bilingual header including the formatted date', () => {
    const msg = buildDigestMessage([entry()], '2026-07-03');
    expect(msg.startsWith("Tomorrow's appointments / उद्याच्या भेटी — 03 Jul")).toBe(true);
  });

  it('renders one numbered line per entry with name, code, mobile and branch', () => {
    const msg = buildDigestMessage([entry()], '2026-07-03');
    expect(msg).toContain('1. Sunita Patil (PYT-0007) — 9876543210 — Kharadi');
  });

  it('numbers many entries sequentially, preserving input order', () => {
    const msg = buildDigestMessage(
      [entry({ fullName: 'A One' }), entry({ fullName: 'B Two' }), entry({ fullName: 'C Three' })],
      '2026-07-03'
    );
    const lines = msg.split('\n');
    expect(lines[1]).toMatch(/^1\. A One/);
    expect(lines[2]).toMatch(/^2\. B Two/);
    expect(lines[3]).toMatch(/^3\. C Three/);
  });

  it('renders a null branch as an em dash', () => {
    const msg = buildDigestMessage([entry({ branch: null })], '2026-07-03');
    expect(msg).toContain('1. Sunita Patil (PYT-0007) — 9876543210 — —');
  });

  it('returns header plus a bilingual empty line for zero entries', () => {
    const msg = buildDigestMessage([], '2026-07-03');
    expect(msg).toBe("Tomorrow's appointments / उद्याच्या भेटी — 03 Jul\nNo appointments / भेटी नाहीत");
  });
});

describe('digestUrl', () => {
  it('addresses the clinic own WhatsApp number when given as target', () => {
    const url = digestUrl([entry()], '2026-07-03', CLINIC.whatsappDigits);
    expect(url.startsWith(`https://wa.me/${CLINIC.whatsappDigits}?text=`)).toBe(true);
  });

  it('addresses a configured 10-digit target with 91 prefix', () => {
    const url = digestUrl([entry()], '2026-07-03', '9812345678');
    expect(url.startsWith('https://wa.me/919812345678?text=')).toBe(true);
  });
});
