// Allowlist for /api/auth/* (src/app/api/auth/[...path]/route.ts). Our sign-in/out are server
// actions; this route exists for get-session and the emailed password-reset link. Defence in depth:
// even if Neon's "disable sign-up" setting drifts, sign-up/admin/organization paths never pass
// through our origin. Exact match on (method, path); anything new from the SDK is refused by default.
const ALLOWED = new Set([
  'POST sign-in/email',
  'POST sign-out',
  'GET get-session',
  'POST request-password-reset',
  'POST reset-password',
]);

const RESET_TOKEN = /^[A-Za-z0-9_-]{1,256}$/;
// A fixed path segment: lowercase letters and dashes only (no '/', '%', '.', uppercase, empty).
const PLAIN_SEGMENT = /^[a-z-]+$/;

export function isAllowedAuthRoute(method: string, segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (method === 'GET' && segments.length === 2 && segments[0] === 'reset-password') {
    return RESET_TOKEN.test(segments[1]);
  }
  if (!segments.every((s) => PLAIN_SEGMENT.test(s))) return false;
  return ALLOWED.has(`${method} ${segments.join('/')}`);
}
