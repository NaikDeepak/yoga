import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase/server';
import { MOCK_SESSION_COOKIE, MOCK_USER } from './local-mock';
import { loginProvider } from './login-provider';

export type SessionUser = { id: string; email: string | null };

// Non-redirecting session check for API route handlers (they return 401 JSON).
export async function getSessionUser(): Promise<SessionUser | null> {
  switch (loginProvider()) {
    case 'mock': {
      const cookieStore = await cookies();
      return cookieStore.get(MOCK_SESSION_COOKIE) ? MOCK_USER : null;
    }
    case 'supabase': {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      return user ? { id: user.id, email: user.email ?? null } : null;
    }
    case 'neon':
      throw new Error('Neon login is not wired yet');
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
