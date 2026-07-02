'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isLocalMock, MOCK_PASSWORD, MOCK_SESSION_COOKIE, MOCK_USER } from '@/lib/local-mock';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (isLocalMock()) {
    if (email !== MOCK_USER.email || password !== MOCK_PASSWORD) redirect('/login?error=1');
    const cookieStore = await cookies();
    cookieStore.set(MOCK_SESSION_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' });
    redirect('/dashboard');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=1');
  redirect('/dashboard');
}

export async function signOutAction() {
  if (isLocalMock()) {
    const cookieStore = await cookies();
    // path must match the scope the cookie was set with
    cookieStore.delete({ name: MOCK_SESSION_COOKIE, path: '/' });
    redirect('/login');
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function signUpAction(formData: FormData) {
  // Mock mode has exactly one account; any registration "succeeds" into it.
  if (isLocalMock()) redirect('/login?registered=1');

  const supabase = await createSupabaseServerClient();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/login?registered=1');
}
