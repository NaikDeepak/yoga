'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MOCK_PASSWORD, MOCK_SESSION_COOKIE, MOCK_USER } from '@/lib/local-mock';
import { loginProvider } from '@/lib/login-provider';
import { safeErrorMessage } from '@/lib/log';

// Neon sign-in. The SDK sets the session cookies itself. Any failure (bad credentials, outage) is
// "failed": redirect() throws, so it must never run inside the try.
async function neonSignIn(email: string, password: string): Promise<boolean> {
  try {
    // Lazy: the SDK must not load under the mock or supabase providers (or in vitest).
    const { getNeonAuth } = await import('@/lib/neon-auth');
    const { error } = await getNeonAuth().signIn.email({ email, password });
    return !error;
  } catch (err) {
    console.error('Neon sign-in failed:', safeErrorMessage(err));
    return false;
  }
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  switch (loginProvider()) {
    case 'mock': {
      if (email !== MOCK_USER.email || password !== MOCK_PASSWORD) redirect('/login?error=1');
      const cookieStore = await cookies();
      cookieStore.set(MOCK_SESSION_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' });
      redirect('/dashboard');
      break;
    }
    case 'supabase': {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) redirect('/login?error=1');
      redirect('/dashboard');
      break;
    }
    case 'neon': {
      const ok = await neonSignIn(email, password);
      redirect(ok ? '/dashboard' : '/login?error=1');
    }
  }
}

export async function signOutAction() {
  switch (loginProvider()) {
    case 'mock': {
      const cookieStore = await cookies();
      // path must match the scope the cookie was set with
      cookieStore.delete({ name: MOCK_SESSION_COOKIE, path: '/' });
      break;
    }
    case 'supabase': {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
      break;
    }
    case 'neon': {
      // Signing out must always land on /login, even if the login service is down.
      try {
        const { getNeonAuth } = await import('@/lib/neon-auth');
        await getNeonAuth().signOut();
      } catch (err) {
        console.error('Neon sign-out failed:', safeErrorMessage(err));
      }
      break;
    }
  }
  redirect('/login');
}
