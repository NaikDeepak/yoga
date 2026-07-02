// Single source of truth for local mock mode (offline dev without Supabase).
// Every mock branch in the codebase must gate on isLocalMock() — never read
// process.env.LOCAL_MOCK directly.

export const MOCK_USER = { id: 'local-mock-user', email: 'dr.pawar@example.com' };
export const MOCK_PASSWORD = 'password';
export const MOCK_SESSION_COOKIE = 'mock_session';

export function isLocalMock(): boolean {
  if (process.env.LOCAL_MOCK !== 'true') return false;
  if (process.env.NODE_ENV === 'production') {
    // This app holds PHI; the mock path bypasses auth and serves files
    // unauthenticated. Fail loudly rather than ever running it in production.
    throw new Error('LOCAL_MOCK cannot be enabled in production');
  }
  return true;
}
