import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readClinicLoginConfig, readClinicSecret } from '../../scripts/clinic/login-config';

const GOOD = [
  'NEON_AUTH_BASE_URL=https://ep-x.neonauth.example/neondb/auth/',
  'ADMIN_EMAIL=admin@example.com',
  'SITE_URL=https://clinic.example/',
].join('\n');

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'clinic-cfg-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function write(body: string, mode = 0o600) {
  const file = join(dir, 'sunrise.env');
  writeFileSync(file, body);
  chmodSync(file, mode);
}

describe('readClinicLoginConfig', () => {
  it('reads the three keys and trims trailing slashes', () => {
    write(GOOD);
    expect(readClinicLoginConfig('sunrise', dir)).toEqual({
      authBaseUrl: 'https://ep-x.neonauth.example/neondb/auth',
      adminEmail: 'admin@example.com',
      siteUrl: 'https://clinic.example',
      vercelProtectionBypass: undefined,
    });
  });

  it('accepts mode 400 and reads the optional bypass secret', () => {
    write(`${GOOD}\nVERCEL_PROTECTION_BYPASS=bypass-secret`, 0o400);
    expect(readClinicLoginConfig('sunrise', dir).vercelProtectionBypass).toBe('bypass-secret');
  });

  it('refuses when the file is missing', () => {
    expect(() => readClinicLoginConfig('sunrise', dir)).toThrow(/not found/);
  });

  it('refuses a group/world-readable file (644) and says chmod 600', () => {
    write(GOOD, 0o644);
    expect(() => readClinicLoginConfig('sunrise', dir)).toThrow(/chmod 600/);
  });

  it('refuses a missing key, naming the key and never a value', () => {
    write('NEON_AUTH_BASE_URL=https://secret-host.example\nSITE_URL=https://clinic.example');
    let message = '';
    try { readClinicLoginConfig('sunrise', dir); } catch (e) { message = (e as Error).message; }
    expect(message).toContain('ADMIN_EMAIL');
    expect(message).not.toContain('secret-host');
    expect(message).not.toContain('clinic.example');
  });

  it('refuses an empty key like a missing one', () => {
    write(GOOD.replace('admin@example.com', ''));
    expect(() => readClinicLoginConfig('sunrise', dir)).toThrow(/ADMIN_EMAIL/);
  });

  it('refuses a slug that is not a plain name', () => {
    expect(() => readClinicLoginConfig('../etc/passwd', dir)).toThrow(/clinic slug/);
  });
});

describe('readClinicSecret', () => {
  it('reads one key without needing the login keys', () => {
    write('CRON_SECRET= cron-value \n');
    expect(readClinicSecret('sunrise', 'CRON_SECRET', dir)).toBe('cron-value');
  });

  it('returns undefined for a missing or empty key', () => {
    write('CRON_SECRET=\n');
    expect(readClinicSecret('sunrise', 'CRON_SECRET', dir)).toBeUndefined();
    expect(readClinicSecret('sunrise', 'OTHER', dir)).toBeUndefined();
  });

  it('refuses a missing file and a group/world-readable file, like the login settings', () => {
    expect(() => readClinicSecret('sunrise', 'CRON_SECRET', dir)).toThrow(/not found/);
    write('CRON_SECRET=cron-value', 0o644);
    expect(() => readClinicSecret('sunrise', 'CRON_SECRET', dir)).toThrow(/chmod 600/);
  });
});
