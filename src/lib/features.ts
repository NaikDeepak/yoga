// Feature flags. Server-side only (read at request time from the environment).

type Env = { NODE_ENV?: string; FEATURE_POSTURE?: string };

/**
 * AI posture analysis is a premium feature still being built on. It's visible in local development
 * (`npm run dev` / `dev:phone`) and hidden in production unless FEATURE_POSTURE=true is set
 * (FEATURE_POSTURE=false hides it locally too). Hiding the entry point is the intended soft barrier —
 * the posture routes themselves stay reachable by URL for signed-in staff.
 */
export function isPostureEnabled(env: Env = process.env): boolean {
  if (env.FEATURE_POSTURE === 'true') return true;
  if (env.FEATURE_POSTURE === 'false') return false;
  return env.NODE_ENV === 'development';
}
