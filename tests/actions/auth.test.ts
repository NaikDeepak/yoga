import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as actions from '@/actions/auth';
import { signInAction, signOutAction } from '@/actions/auth';
import { MOCK_SESSION_COOKIE } from '@/lib/local-mock';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGetAll = vi.fn(() => [] as { name: string }[]);
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete, getAll: cookieGetAll }),
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

const neonSignIn = vi.fn();
const neonSignOut = vi.fn();
vi.mock('@/lib/neon-auth', () => ({
  getNeonAuth: () => ({ signIn: { email: neonSignIn }, signOut: neonSignOut }),
}));

describe('neon provider', () => {
  beforeEach(() => vi.stubEnv('LOGIN_PROVIDER', 'neon'));
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('signs in with the credentials and redirects to /dashboard', async () => {
    neonSignIn.mockResolvedValue({ data: {}, error: null });
    await expect(signInAction(fd({ email: 'a@b.c', password: 'secret' })))
      .rejects.toThrow('REDIRECT:/dashboard');
    expect(neonSignIn).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('an error result redirects to /login?error=1', async () => {
    neonSignIn.mockResolvedValue({ data: null, error: { message: 'bad' } });
    await expect(signInAction(fd({ email: 'a@b.c', password: 'wrong' })))
      .rejects.toThrow('REDIRECT:/login?error=1');
  });
  it('a thrown error redirects to /login?error=1 and never logs the password', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    neonSignIn.mockRejectedValue(new Error('network down'));
    await expect(signInAction(fd({ email: 'a@b.c', password: 'hunter2-secret' })))
      .rejects.toThrow('REDIRECT:/login?error=1');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('hunter2-secret');
  });
  it('sign-out calls signOut and redirects to /login', async () => {
    neonSignOut.mockResolvedValue({ data: {}, error: null });
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expect(neonSignOut).toHaveBeenCalled();
  });
  const jar = [
    { name: '__Secure-neon-auth.session_token' },
    { name: '__Secure-neon-auth.local.session_data' },
    { name: 'NEXT_LOCALE' },
  ];
  const expectNeonCookiesCleared = () => {
    expect(cookieDelete).toHaveBeenCalledTimes(2);
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-neon-auth.session_token', path: '/' });
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-neon-auth.local.session_data', path: '/' });
  };
  it('sign-out failure (throws) clears every neon-auth cookie, not others, then redirects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cookieGetAll.mockReturnValue(jar);
    neonSignOut.mockRejectedValue(new Error('boom'));
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expectNeonCookiesCleared();
  });
  it('sign-out failure (error result) clears neon-auth cookies too', async () => {
    cookieGetAll.mockReturnValue(jar);
    neonSignOut.mockResolvedValue({ data: null, error: { message: 'down' } });
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expectNeonCookiesCleared();
  });
  it('successful sign-out deletes nothing by hand', async () => {
    cookieGetAll.mockReturnValue(jar);
    neonSignOut.mockResolvedValue({ data: {}, error: null });
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expect(cookieDelete).not.toHaveBeenCalled();
  });
});

it('self-registration is gone', () => {
  expect('signUpAction' in actions).toBe(false);
});

describe('local mock mode', () => {
  beforeEach(() => vi.stubEnv('LOCAL_MOCK', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('signs in with the mock credentials and sets an httpOnly session cookie', async () => {
    await expect(signInAction(fd({ email: 'dr.demo@example.com', password: 'password' })))
      .rejects.toThrow('REDIRECT:/dashboard');
    expect(cookieSet).toHaveBeenCalledWith(
      MOCK_SESSION_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' },
    );
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects wrong mock credentials without setting a cookie', async () => {
    await expect(signInAction(fd({ email: 'dr.demo@example.com', password: 'nope' })))
      .rejects.toThrow('REDIRECT:/login?error=1');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('signs out by deleting the session cookie with matching path', async () => {
    await expect(signOutAction()).rejects.toThrow('REDIRECT:/login');
    expect(cookieDelete).toHaveBeenCalledWith({ name: MOCK_SESSION_COOKIE, path: '/' });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
