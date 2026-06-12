import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAction, signOutAction, signUpAction } from '@/actions/auth';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
};
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe('signInAction', () => {
  it('signs in and redirects to /patients', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signInAction(fd({ email: 'a@b.c', password: 'secret' })))
      .rejects.toThrow('REDIRECT:/patients');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret' });
  });
  it('redirects back to /login with error flag on failure', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'bad creds' } });
    await expect(signInAction(fd({ email: 'a@b.c', password: 'wrong' })))
      .rejects.toThrow('REDIRECT:/login?error=1');
  });
  it('treats missing fields as empty strings', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'missing' } });
    await expect(signInAction(fd({}))).rejects.toThrow('REDIRECT:/login?error=1');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: '', password: '' });
  });
});

describe('signOutAction', () => {
  it('signs out and redirects to /login', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe('signUpAction', () => {
  it('registers and redirects to /login with registered flag', async () => {
    auth.signUp.mockResolvedValue({ error: null });
    await expect(signUpAction(fd({ email: 'new@b.c', password: 'secret' })))
      .rejects.toThrow('REDIRECT:/login?registered=1');
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@b.c', password: 'secret' });
  });
  it('redirects back to /register with the error message on failure', async () => {
    auth.signUp.mockResolvedValue({ error: { message: 'User already registered' } });
    await expect(signUpAction(fd({ email: 'dup@b.c', password: 'secret' })))
      .rejects.toThrow(`REDIRECT:/register?error=${encodeURIComponent('User already registered')}`);
  });
});
