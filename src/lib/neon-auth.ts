// Neon managed login (LOGIN_PROVIDER=neon). Only ever loaded with `await import()` from the neon
// branches: the SDK's ESM breaks vitest when imported at the top level, and `createNeonAuth`
// throws at construction without its env vars, so everything is built on first use.
import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';
import {
  createAuthServer,
  extractNeonAuthCookies,
  type NeonAuthServer,
  type RequestContext,
} from '@neondatabase/auth/server';
import { cookies, headers } from 'next/headers';
import type { SessionUser } from './auth';

function neonEnv(): { baseUrl: string; secret: string } {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) {
    throw new Error('NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set');
  }
  return { baseUrl, secret };
}

let neonAuth: NeonAuth | undefined;

// Sign-in/out (server actions), proxy middleware and the /api/auth handler.
export function getNeonAuth(): NeonAuth {
  if (!neonAuth) {
    const { baseUrl, secret } = neonEnv();
    neonAuth = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return neonAuth;
}

// Same as the SDK's own Next.js context, except cookie writes are ignored where Next forbids them
// (server components): an uncached read can refresh cookies mid-render. The proxy refreshes them instead.
async function renderSafeContext(): Promise<RequestContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return {
    getCookies: () => extractNeonAuthCookies(headerStore),
    setCookie: (name, value, options) => {
      try {
        cookieStore.set(name, value, options);
      } catch {
        // called from a Server Component — proxy (src/proxy.ts) refreshes sessions instead
      }
    },
    getHeader: (name) => headerStore.get(name) ?? null,
    getOrigin: () =>
      headerStore.get('origin') || headerStore.get('referer')?.split('/').slice(0, 3).join('/') || '',
    getFramework: () => 'nextjs',
  };
}

let sessionReader: NeonAuthServer | undefined;

function getSessionReader(): NeonAuthServer {
  if (!sessionReader) {
    const { baseUrl, secret } = neonEnv();
    sessionReader = createAuthServer({ baseUrl, cookieSecret: secret, context: renderSafeContext });
  }
  return sessionReader;
}

// Uncached: the SDK's 5-minute signed cookie copy would keep a signed-out or revoked session alive.
export async function readNeonSession(): Promise<SessionUser | null> {
  const { data, error } = await getSessionReader().getSession({ query: { disableCookieCache: 'true' } });
  // Status and code only: the upstream message is not ours to log.
  if (error) throw new Error(`Neon session read failed (${error.status} ${error.code})`);
  const user = data?.user;
  return user ? { id: user.id, email: user.email ?? null } : null;
}
