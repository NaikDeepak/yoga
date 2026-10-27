import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase/server';
import { MOCK_SESSION_COOKIE, MOCK_USER } from './local-mock';
import { loginProvider } from './login-provider';
import { safeErrorMessage } from './log';

export type SessionUser = { id: string; email: string | null };

// Non-redirecting session check for API route handlers (they return 401 JSON).
export async function getSessionUser(): Promise<SessionUser | null> {
  // Reading cookies first makes every caller dynamic before the provider check,
  // so builds don't prerender auth'd pages; a missing LOGIN_PROVIDER still fails closed at runtime.
  const cookieStore = await cookies();
  switch (loginProvider()) {
    case 'mock': {
      return cookieStore.get(MOCK_SESSION_COOKIE) ? MOCK_USER : null;
    }
    case 'supabase': {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user ? { id: user.id, email: user.email ?? null } : null;
    }
    case 'neon': {
      // Lazy: the SDK must not load under the mock or supabase providers (or in vitest).
      // A login-service outage sends people to /login instead of a 500.
      try {
        const { readNeonSession } = await import('@/lib/neon-auth');
        return await readNeonSession();
      } catch (err) {
        console.error('Neon session read failed:', safeErrorMessage(err));
        return null;
      }
    }
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
