import { describe, it, expect, afterEach, vi } from 'vitest';
import { isLocalMock, MOCK_USER, MOCK_PASSWORD, MOCK_SESSION_COOKIE } from '@/lib/local-mock';

afterEach(() => vi.unstubAllEnvs());

describe('isLocalMock', () => {
  it('is false when LOCAL_MOCK is unset', () => {
    expect(isLocalMock()).toBe(false);
  });

  it('is false for any value other than "true"', () => {
    vi.stubEnv('LOCAL_MOCK', '1');
    expect(isLocalMock()).toBe(false);
  });

  it('is true when LOCAL_MOCK=true in development or test', () => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    expect(isLocalMock()).toBe(true); // vitest runs with NODE_ENV=test
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLocalMock()).toBe(true);
  });

  it('throws when LOCAL_MOCK=true in production', () => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => isLocalMock()).toThrow('LOCAL_MOCK cannot be enabled when NODE_ENV=production');
  });

  it('fails closed for any other environment (e.g. staging)', () => {
    vi.stubEnv('LOCAL_MOCK', 'true');
    vi.stubEnv('NODE_ENV', 'staging');
    expect(() => isLocalMock()).toThrow('LOCAL_MOCK cannot be enabled when NODE_ENV=staging');
  });
});

describe('mock constants', () => {
  it('exposes a stable mock identity', () => {
    expect(MOCK_USER.id).toBe('local-mock-user');
    expect(MOCK_USER.email).toBe('dr.pawar@example.com');
    expect(MOCK_PASSWORD).toBe('password');
    expect(MOCK_SESSION_COOKIE).toBe('mock_session');
  });
});
