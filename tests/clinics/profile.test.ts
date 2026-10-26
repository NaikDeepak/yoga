import { describe, it, expect } from 'vitest';
import { clinicProfile, clinicName, resolveClinicProfile, CLINIC_REGISTRY } from '@/clinics';
import { clinicProfileSchema } from '@/clinics/types';
import { pawar } from '@/clinics/pawar';
import { CLINIC } from '@/lib/clinic';
import { BRANCHES } from '@/lib/presets';
import { contrast, contrastOnWhite } from '../helpers/contrast';

describe.each(Object.entries(CLINIC_REGISTRY))('printed brand colours of %s are readable on white', (_slug, profile) => {
  it('accent text (small print) meets 4.5:1', () => {
    expect(contrastOnWhite(profile.brand.accentText ?? profile.brand.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent behind large bold text (report initials) meets 3:1', () => {
    expect(contrastOnWhite(profile.brand.accent)).toBeGreaterThanOrEqual(3);
  });
});

describe('CLINIC_REGISTRY profiles', () => {
  it('includes sunrise in CLINIC_REGISTRY', () => {
    expect(CLINIC_REGISTRY).toHaveProperty('sunrise');
  });

  it('every entry in CLINIC_REGISTRY parses with clinicProfileSchema and passes contrast checks', () => {
    expect(Object.keys(CLINIC_REGISTRY)).toContain('sunrise');
    for (const [_slug, profile] of Object.entries(CLINIC_REGISTRY)) {
      expect(() => clinicProfileSchema.parse(profile)).not.toThrow();
      expect(contrastOnWhite(profile.brand.accentText ?? profile.brand.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastOnWhite(profile.brand.accent)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('clinicProfileSchema', () => {
  it("Pawar's profile passes the schema", () => {
    expect(() => clinicProfileSchema.parse(pawar)).not.toThrow();
  });

  it('fails with a duplicate branch key', () => {
    const invalid = {
      ...pawar,
      branches: [
        { key: 'Branch1', label: 'Branch 1', fullAddress: '123 St' },
        { key: 'Branch1', label: 'Branch 1 Duplicate', fullAddress: '456 St' },
      ],
    };
    expect(() => clinicProfileSchema.parse(invalid)).toThrow();
  });

  it('fails with an empty branch list', () => {
    const invalid = {
      ...pawar,
      branches: [],
    };
    expect(() => clinicProfileSchema.parse(invalid)).toThrow();
  });

  it('fails with a bad patient code prefix', () => {
    const withDigits = {
      ...pawar,
      patientCodePrefix: 'PYT1',
    };
    expect(() => clinicProfileSchema.parse(withDigits)).toThrow();

    const withSymbols = {
      ...pawar,
      patientCodePrefix: 'PY-T',
    };
    expect(() => clinicProfileSchema.parse(withSymbols)).toThrow();

    const empty = {
      ...pawar,
      patientCodePrefix: '',
    };
    expect(() => clinicProfileSchema.parse(empty)).toThrow();
  });
});

describe('clinic profile resolution', () => {
  it('throws on an unknown CLINIC_PROFILE, naming the problem', () => {
    expect(() => resolveClinicProfile('unknown-clinic')).toThrow(/unknown/i);
  });

  it('resolves pawar by default or by slug', () => {
    expect(resolveClinicProfile('pawar').slug).toBe('pawar');
    expect(resolveClinicProfile().slug).toBe('pawar');
  });
});

describe('clinicName helper', () => {
  it('returns full names by default', () => {
    expect(clinicName('en')).toBe("Pawar's Yog Therapy Center");
    expect(clinicName('mr')).toBe('पवार योग थेरपी सेंटर');
  });

  it('returns short names when short is true', () => {
    expect(clinicName('en', true)).toBe("Pawar's Yog Therapy");
    expect(clinicName('mr', true)).toBe('पवार योग थेरपी');
  });
});

describe('pinned clinic values', () => {
  it('preserves CLINIC values', () => {
    expect(CLINIC.name).toBe("Pawar's Yog Therapy Center");
    expect(CLINIC.phone).toBe('+91 85509 21037');
    expect(CLINIC.email).toBe('pawarsyog@gmail.com');
    expect(CLINIC.hours).toBe('Mon–Sat, 6:00 AM – 8:00 PM');
    expect(CLINIC.whatsappDigits).toBe('918550921037');
  });

  it('preserves BRANCHES values', () => {
    expect(BRANCHES).toEqual([
      {
        key: 'Manjari BK',
        label: 'Manjari BK',
        fullAddress: 'Shop No 8, Greenoak Society, Cement Road, near Mhasoba Mandir, Manjari Budruk, Pune, Maharashtra 412307',
      },
      {
        key: 'Kharadi',
        label: 'Kharadi',
        fullAddress: 'Survey no. 24/2B, Opposite of Konark Eureka, Sainath Nagar, Kharadi, Pune, Maharashtra 411014',
      },
      {
        key: 'Morgaon',
        label: 'Morgaon',
        fullAddress: 'Morgaon Pawarwadi, Tal-Dodamarg, Sindhudurg - 416511',
      },
    ]);
  });

  it('preserves patientCodePrefix', () => {
    expect(clinicProfile.patientCodePrefix).toBe('PYT');
  });

  // e2e skips steps for modules a profile has off, so this is what keeps Pawar's run covering every module.
  it('keeps every Pawar module on', () => {
    expect(Object.values(pawar.features).every(Boolean)).toBe(true);
  });
});

describe('resolveClinicProfile in production', () => {
  it('refuses to guess the clinic in production', () => {
    expect(() => resolveClinicProfile(undefined, { NODE_ENV: 'production' })).toThrow(/CLINIC_PROFILE/);
    expect(() => resolveClinicProfile(undefined, { NODE_ENV: 'production', CLINIC_PROFILE: '' })).toThrow(/CLINIC_PROFILE/);
  });
  it('still defaults to pawar outside production', () => {
    expect(resolveClinicProfile(undefined, { NODE_ENV: 'development' }).slug).toBe('pawar');
    expect(resolveClinicProfile(undefined, { NODE_ENV: 'test' }).slug).toBe('pawar');
  });
  it('uses CLINIC_PROFILE from env when set', () => {
    expect(resolveClinicProfile(undefined, { NODE_ENV: 'production', CLINIC_PROFILE: 'pawar' }).slug).toBe('pawar');
  });
});

describe.each(Object.entries(CLINIC_REGISTRY))('on-screen theme of %s is readable', (_slug, profile) => {
  const t = profile.theme;
  it('button text on primary meets 4.5:1', () => {
    expect(contrast(t.primary, t.primaryForeground)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent text on white meets 4.5:1', () => {
    expect(contrastOnWhite(t.accentText)).toBeGreaterThanOrEqual(4.5);
  });
  it('body text meets 4.5:1 on the page background and on white', () => {
    expect(contrast(t.foreground, t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite(t.foreground)).toBeGreaterThanOrEqual(4.5);
  });
});
