/** Shown whenever a production build or runtime has no clinic. Shared by next.config.ts and index.ts. */
export const CLINIC_PROFILE_MISSING =
  'CLINIC_PROFILE is not set. Set it in Vercel (Production, build and runtime).';

/** The CLINIC_PROFILE value next.config.ts inlines into the build (server and client alike).
 *  Production (`next build` / `next start`) with a missing or empty value throws; elsewhere pawar.
 *  Must be checked here: the inlined literal is never empty, so index.ts could not catch it later. */
export function clinicProfileForBuild(env: Record<string, string | undefined>): string {
  const requested = env.CLINIC_PROFILE;
  if (requested) return requested;
  if (env.NODE_ENV === 'production') throw new Error(CLINIC_PROFILE_MISSING);
  return 'pawar';
}
