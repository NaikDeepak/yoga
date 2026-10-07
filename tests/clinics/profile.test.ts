import { describe, it, expect } from 'vitest';
import { clinicProfile, clinicName, resolveClinicProfile } from '@/clinics';
import { clinicProfileSchema } from '@/clinics/types';
import { pawar } from '@/clinics/pawar';
import { CLINIC } from '@/lib/clinic';
import { BRANCHES } from '@/lib/presets';

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
