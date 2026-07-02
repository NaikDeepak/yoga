import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase/server';
import { isLocalMock, MOCK_SESSION_COOKIE, MOCK_USER } from './local-mock';

// Non-redirecting session check for API route handlers (they return 401 JSON).
export async function getSessionUser() {
  if (isLocalMock()) {
    const cookieStore = await cookies();
    return cookieStore.get(MOCK_SESSION_COOKIE) ? MOCK_USER : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
