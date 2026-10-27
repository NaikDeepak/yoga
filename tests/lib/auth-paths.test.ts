import { describe, it, expect } from 'vitest';
import { isPublicPath } from '@/lib/auth-paths';

describe('isPublicPath', () => {
  it('login and next internals are public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/_next/static/x.js')).toBe(true);
    expect(isPublicPath('/favicon.ico')).toBe(true);
  });
  it('the app manifest is public (phones fetch it without the login cookie to install the app)', () => {
    expect(isPublicPath('/manifest.webmanifest')).toBe(true);
  });
  it('robots.txt is public (crawlers have no login cookie; it tells them to stay out)', () => {
    expect(isPublicPath('/robots.txt')).toBe(true);
  });
  it('self-registration is gone: /register is protected', () => {
    expect(isPublicPath('/register')).toBe(false);
  });
  it('app pages are protected', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/patients')).toBe(false);
    expect(isPublicPath('/patients/abc/print')).toBe(false);
  });
  it('client share links are public, nothing that merely starts with /s', () => {
    expect(isPublicPath('/s/AbC123_-')).toBe(true);
    expect(isPublicPath('/s')).toBe(false);
    expect(isPublicPath('/settings')).toBe(false);
    expect(isPublicPath('/sx/abc')).toBe(false);
  });
});
