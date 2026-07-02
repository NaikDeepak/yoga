// Single source of truth for local mock mode (offline dev without Supabase).
// Every mock branch in the codebase must gate on isLocalMock() — never read
// process.env.LOCAL_MOCK directly.

export const MOCK_USER = { id: 'local-mock-user', email: 'dr.pawar@example.com' };
export const MOCK_PASSWORD = 'password';
export const MOCK_SESSION_COOKIE = 'mock_session';

export function isLocalMock(): boolean {
  if (process.env.LOCAL_MOCK !== 'true') return false;
  // This app holds PHI and the mock path bypasses auth. Fail closed: only
  // development and test may run it; production, staging, or anything else
  // fails loudly rather than silently deciding.
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error(`LOCAL_MOCK cannot be enabled when NODE_ENV=${process.env.NODE_ENV} — development/test only`);
  }
  return true;
}
