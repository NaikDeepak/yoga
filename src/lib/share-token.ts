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
    || (origin.host ? `${origin.proto ?? 'https'}://${origin.host}` : null);
  if (!base) throw new Error('Cannot build share link: set APP_URL');
  return `${base}/s/${token}`;
}
