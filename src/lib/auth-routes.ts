// Allowlist for /api/auth/* (src/app/api/auth/[...path]/route.ts). Our sign-in/out are server actions and
// nothing in the app calls this route; only login-smoke uses sign-in and sign-out through our origin. The
// scripts talk to Neon directly, and the emailed reset link lands on our /login (reset-password script).
// Defence in depth: even if Neon's "disable sign-up" setting drifts, sign-up/admin/organization/reset paths
// never pass through our origin. Exact match on (method, path); anything else is refused by default.
const ALLOWED = new Set(['POST sign-in/email', 'POST sign-out']);

// A fixed path segment: lowercase letters and dashes only (no '/', '%', '.', uppercase, empty).
const PLAIN_SEGMENT = /^[a-z-]+$/;

export function isAllowedAuthRoute(method: string, segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (!segments.every((s) => PLAIN_SEGMENT.test(s))) return false;
  return ALLOWED.has(`${method} ${segments.join('/')}`);
}
