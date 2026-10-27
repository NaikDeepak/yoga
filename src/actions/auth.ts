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
      // Signing out must always land on /login. If the login service fails, the browser would keep
      // its session cookies (a shared phone stays signed in), so drop them ourselves.
      let ok = false;
      try {
        const { getNeonAuth } = await import('@/lib/neon-auth');
        const { error } = await getNeonAuth().signOut();
        ok = !error;
      } catch (err) {
        console.error('Neon sign-out failed:', safeErrorMessage(err));
      }
      if (!ok) {
        const cookieStore = await cookies();
        // Expire with Secure: browsers ignore a Set-Cookie for a __Secure- name without it, and
        // Next's delete() omits it. SDK cookie prefixes (it exports no constant for them).
        for (const { name } of cookieStore.getAll()) {
          if (name.startsWith('__Secure-neon-auth.') || name.startsWith('neon-auth.')) {
            cookieStore.set(name, '', {
              path: '/', expires: new Date(0), secure: true, httpOnly: true, sameSite: 'lax',
            });
          }
        }
      }
      break;
    }
  }
  redirect('/login');
}
