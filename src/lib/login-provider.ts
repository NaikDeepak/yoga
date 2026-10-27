import { isLocalMock } from './local-mock';

export type LoginProvider = 'mock' | 'supabase' | 'neon';

// Read at call time so tests can stub the env. Fails closed in production:
// no silent default for a PHI app.
export function loginProvider(): LoginProvider {
  if (isLocalMock()) return 'mock';
  const v = process.env.LOGIN_PROVIDER;
  if (!v) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('LOGIN_PROVIDER must be set in production (supabase or neon)');
    }
    return 'supabase';
  }
  if (v === 'supabase' || v === 'neon') return v;
  throw new Error(`Unknown LOGIN_PROVIDER "${v}"`);
}
