import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';
import { loginProvider } from '@/lib/login-provider';

afterEach(() => vi.unstubAllEnvs());

describe('loginProvider', () => {
  it('is mock when local mock is on, whatever LOGIN_PROVIDER says', () => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    expect(loginProvider()).toBe('mock');
  });

  it('reads neon and supabase', () => {
    vi.stubEnv('LOGIN_PROVIDER', 'neon');
    expect(loginProvider()).toBe('neon');
    vi.stubEnv('LOGIN_PROVIDER', 'supabase');
    expect(loginProvider()).toBe('supabase');
  });

  it.each(['development', 'test'])('defaults to supabase when unset in %s', (env) => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('LOGIN_PROVIDER', '');
    expect(loginProvider()).toBe('supabase');
  });

  it('fails closed when unset in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOGIN_PROVIDER', '');
    expect(() => loginProvider()).toThrow('LOGIN_PROVIDER must be set in production (supabase or neon)');
  });

  it.each(['Neon', 'clerk'])('rejects unknown value %s', (v) => {
    vi.stubEnv('LOGIN_PROVIDER', v);
    expect(() => loginProvider()).toThrow(`Unknown LOGIN_PROVIDER "${v}"`);
  });
});
