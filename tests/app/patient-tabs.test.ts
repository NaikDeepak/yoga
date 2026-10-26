import { describe, it, expect } from 'vitest';
import { patientTabKeys, resolvePatientTab } from '@/lib/patient-tabs';

describe('patientTabKeys', () => {
  it('lists every tab when fees is on', () => {
    expect(patientTabKeys(true)).toEqual(['overview', 'treatment', 'documents', 'fees', 'assessment']);
  });
  it('drops the fees tab when fees is off', () => {
    expect(patientTabKeys(false)).toEqual(['overview', 'treatment', 'documents', 'assessment']);
  });
});

describe('resolvePatientTab', () => {
  it('keeps a valid tab', () => {
    expect(resolvePatientTab('documents', true)).toBe('documents');
    expect(resolvePatientTab('fees', true)).toBe('fees');
  });
  it('falls back to overview for ?tab=fees when fees is off', () => {
    expect(resolvePatientTab('fees', false)).toBe('overview');
  });
  it('maps legacy names and unknown values', () => {
    expect(resolvePatientTab('problems', true)).toBe('overview');
    expect(resolvePatientTab('progress', false)).toBe('treatment');
    expect(resolvePatientTab('nonsense', true)).toBe('overview');
    expect(resolvePatientTab(undefined, true)).toBe('overview');
  });
});
