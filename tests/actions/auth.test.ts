import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signInAction, signOutAction, signUpAction } from '@/actions/auth';
import { MOCK_SESSION_COOKIE } from '@/lib/local-mock';

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

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete }),
}));

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe('signInAction', () => {
  it('signs in and redirects to /dashboard', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signInAction(fd({ email: 'a@b.c', password: 'secret' })))
      .rejects.toThrow('REDIRECT:/dashboard');
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

describe('local mock mode', () => {
  beforeEach(() => vi.stubEnv('LOCAL_MOCK', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('signs in with the mock credentials and sets an httpOnly session cookie', async () => {
    await expect(signInAction(fd({ email: 'dr.pawar@example.com', password: 'password' })))
      .rejects.toThrow('REDIRECT:/dashboard');
    expect(cookieSet).toHaveBeenCalledWith(
      MOCK_SESSION_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' },
    );
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects wrong mock credentials without setting a cookie', async () => {
    await expect(signInAction(fd({ email: 'dr.pawar@example.com', password: 'nope' })))
      .rejects.toThrow('REDIRECT:/login?error=1');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('signs out by deleting the session cookie', async () => {
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expect(cookieDelete).toHaveBeenCalledWith(MOCK_SESSION_COOKIE);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('short-circuits sign-up to the login page', async () => {
    await expect(signUpAction(fd({ email: 'x@y.z', password: 'pw' })))
      .rejects.toThrow('REDIRECT:/login?registered=1');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
