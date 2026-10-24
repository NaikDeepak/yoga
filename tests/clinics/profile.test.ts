import { describe, it, expect } from 'vitest';
import { clinicProfile, clinicName, resolveClinicProfile } from '@/clinics';
import { clinicProfileSchema } from '@/clinics/types';
import { pawar } from '@/clinics/pawar';
import { CLINIC } from '@/lib/clinic';
import { BRANCHES } from '@/lib/presets';

/** WCAG contrast ratio of a #rrggbb colour against white. */
function contrastOnWhite(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

describe('printed brand colours are readable on white', () => {
  it('accent text (small print) meets 4.5:1', () => {
    expect(contrastOnWhite(pawar.brand.accentText ?? pawar.brand.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent behind large bold text (report initials) meets 3:1', () => {
    expect(contrastOnWhite(pawar.brand.accent)).toBeGreaterThanOrEqual(3);
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
});
