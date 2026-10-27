import { describe, it, expect } from 'vitest';
import { isAllowedAuthRoute } from '@/lib/auth-routes';

describe('isAllowedAuthRoute', () => {
  it.each([
    ['POST', ['sign-in', 'email']],
    ['POST', ['sign-out']],
  ])('allows %s %j', (method, segs) => {
    expect(isAllowedAuthRoute(method, segs)).toBe(true);
  });

  it.each([
    ['POST', ['sign-up', 'email']],
    ['POST', ['admin', 'create-user']],
    ['GET', ['admin', 'list-users']],
    ['POST', ['organization', 'create']],
    ['GET', ['sign-in', 'email']],
    ['POST', ['Sign-In', 'Email']],
    ['POST', ['sign-in', 'email', '']],
    ['POST', ['sign-up%2Femail']],
    ['POST', ['sign-up/email']],
    ['POST', ['..', 'admin', 'create-user']],
    ['POST', []],
    ['GET', ['reset-password', 'a', 'b']],
    ['GET', ['reset-password', '']],
    ['GET', ['reset-password', 'a.b']],
    ['GET', ['reset-password', 'a%2Fb']],
    ['GET', ['reset-password', 'a/b']],
    ['GET', ['reset-password', 'x'.repeat(257)]],
    ['DELETE', ['sign-out']],
    ['get', ['sign-out']],
    ['GET', ['get-session']],
    ['POST', ['request-password-reset']],
    ['POST', ['reset-password']],
    ['GET', ['reset-password', 'AbC_123-xyz']],
  ])('refuses %s %j', (method, segs) => {
    expect(isAllowedAuthRoute(method, segs)).toBe(false);
  });
});
