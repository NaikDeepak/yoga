// Tokens for client share links (spec 2026-10-05-client-exercise-link). The URL carries the token;
// the database stores only its SHA-256, so a leaked backup can't be turned into working links.
import { createHash, randomBytes } from 'node:crypto';

export const SHARE_LINK_TTL_DAYS = 90;

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 random bytes as base64url (43 chars, 256 bits): not guessable, so no rate limiting needed. */
export function newShareToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashShareToken(token) };
}

export function shareLinkExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SHARE_LINK_TTL_DAYS * 86_400_000);
}

/**
 * Public URL for a token: `APP_URL` when set (set it in production), else the request's host.
 * Protocol defaults to https.
 */
export function shareUrl(token: string, origin: { appUrl: string | undefined; host: string | null; proto: string | null }): string {
  const base = origin.appUrl?.trim().replace(/\/+$/, '')
    || (origin.host?.trim() ? `${origin.proto ?? 'https'}://${origin.host.trim()}` : null);
  if (!base) throw new Error('Cannot build share link: no APP_URL and no Host header on the request');
  return `${base}/s/${token}`;
}

// Chat-app previews, plus search crawlers in case a link ever leaks (pages are noindex, tokens unguessable).
const PREVIEW_BOTS = /whatsapp|facebookexternalhit|telegrambot|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|applebot|googlebot|bingbot|duckduckbot/i;

/** Chat apps fetch a link to build its preview; those fetches aren't the client opening it. */
export function isLinkPreviewBot(userAgent: string | null): boolean {
  return !!userAgent && PREVIEW_BOTS.test(userAgent);
}
