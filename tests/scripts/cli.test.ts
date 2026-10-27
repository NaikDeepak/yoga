import { describe, it, expect } from 'vitest';
import { parseClinicArgs, parseMoveArgs, newPasswordProblem } from '../../scripts/clinic/cli';

describe('parseClinicArgs', () => {
  it('reads --clinic, --email (lowercased) and flags', () => {
    expect(parseClinicArgs(['--clinic', 'sunrise', '--email', 'Staff@Example.com', '--reset']))
      .toEqual({ clinic: 'sunrise', email: 'staff@example.com', reset: true, site: undefined });
  });
  it('reads --site and trims its trailing slash', () => {
    expect(parseClinicArgs(['--clinic', 'a', '--email', 'a@b.co', '--site', 'https://x.vercel.app/']).site)
      .toBe('https://x.vercel.app');
  });
  it('refuses without --clinic or --email', () => {
    expect(() => parseClinicArgs(['--email', 'a@b.co'])).toThrow(/--clinic/);
    expect(() => parseClinicArgs(['--clinic', 'a'])).toThrow(/--email/);
  });
  it('refuses a malformed email and unknown flags', () => {
    expect(() => parseClinicArgs(['--clinic', 'a', '--email', 'nope'])).toThrow(/email/);
    expect(() => parseClinicArgs(['--clinic', 'a', '--email', 'a@b.co', '--password', 'x'])).toThrow();
  });
  it('refuses a --site that is not http(s)', () => {
    expect(() => parseClinicArgs(['--clinic', 'a', '--email', 'a@b.co', '--site', 'ftp://x'])).toThrow(/--site/);
  });
});

describe('parseMoveArgs', () => {
  it('reads --from and --to', () => {
    expect(parseMoveArgs(['--from', 'old-id', '--to', 'new-id'])).toEqual({ from: 'old-id', to: 'new-id' });
  });
  it('refuses a missing id or the same id twice', () => {
    expect(() => parseMoveArgs(['--from', 'a'])).toThrow(/--to/);
    expect(() => parseMoveArgs(['--to', 'a'])).toThrow(/--from/);
    expect(() => parseMoveArgs(['--from', 'a', '--to', 'a'])).toThrow(/differ/);
  });
});

describe('newPasswordProblem', () => {
  it('accepts two matching passwords of 8+ characters', () => {
    expect(newPasswordProblem('longenough', 'longenough')).toBeNull();
  });
  it('refuses short or mismatched passwords without echoing them', () => {
    const short = newPasswordProblem('short', 'short');
    const mismatch = newPasswordProblem('longenough1', 'longenough2');
    expect(short).toMatch(/8/);
    expect(mismatch).toMatch(/match/);
    expect(`${short}${mismatch}`).not.toMatch(/short'|longenough/);
  });
});
