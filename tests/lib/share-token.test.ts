import { describe, it, expect } from 'vitest';
import { hashShareToken, isLinkPreviewBot, newShareToken, shareLinkExpiry, shareUrl, SHARE_LINK_TTL_DAYS } from '@/lib/share-token';

describe('newShareToken', () => {
  it('makes a 43-character base64url token (256 bits) and its hash', () => {
    const { token, hash } = newShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashShareToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newShareToken().token));
    expect(tokens.size).toBe(500);
  });
});

describe('hashShareToken', () => {
  it('is deterministic and differs per token', () => {
    expect(hashShareToken('abc')).toBe(hashShareToken('abc'));
    expect(hashShareToken('abc')).not.toBe(hashShareToken('abd'));
  });
});

describe('shareLinkExpiry', () => {
  it('is 90 days after creation', () => {
    expect(SHARE_LINK_TTL_DAYS).toBe(90);
    expect(shareLinkExpiry(new Date('2026-10-05T10:00:00Z')).toISOString()).toBe('2027-01-03T10:00:00.000Z');
  });
});

describe('shareUrl', () => {
  it('prefers APP_URL (trailing slash ignored)', () => {
    expect(shareUrl('tok', { appUrl: 'https://yoga.example.com/', host: 'evil.test', proto: 'http' }))
      .toBe('https://yoga.example.com/s/tok');
  });

  it('falls back to the request host and protocol', () => {
    expect(shareUrl('tok', { appUrl: undefined, host: '192.168.1.5:3000', proto: 'https' })).toBe('https://192.168.1.5:3000/s/tok');
    expect(shareUrl('tok', { appUrl: '', host: 'localhost:3000', proto: null })).toBe('https://localhost:3000/s/tok');
  });

  it('fails without any origin', () => {
    expect(() => shareUrl('tok', { appUrl: undefined, host: null, proto: null })).toThrow();
  });
});

describe('isLinkPreviewBot', () => {
  it('spots chat-app link previews so they are not counted as client views', () => {
    for (const ua of [
      'WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0', 'Mozilla/5.0 (compatible; Discordbot/2.0)', 'Twitterbot/1.0',
    ]) expect(isLinkPreviewBot(ua)).toBe(true);
  });

  it('counts real browsers and missing user agents', () => {
    expect(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36')).toBe(false);
    expect(isLinkPreviewBot(null)).toBe(false);
  });
});
