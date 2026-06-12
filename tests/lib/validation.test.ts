import { describe, it, expect } from 'vitest';
import {
  patientSchema, problemSchema, treatmentSchema, visitSchema, docTypeSchema,
} from '@/lib/validation';

describe('patientSchema', () => {
  it('accepts a minimal valid patient', () => {
    const r = patientSchema.safeParse({ fullName: 'Asha Pawar', mobile: '9876543210' });
    expect(r.success).toBe(true);
  });
  it('coerces numerics and drops empty strings', () => {
    const r = patientSchema.parse({
      fullName: 'A', mobile: '9876543210',
      age: '45', weightKg: '70.5', heightCm: '160', email: '', address: '',
    });
    expect(r.age).toBe(45);
    expect(r.weightKg).toBe(70.5);
    expect(r.email).toBeUndefined();
    expect(r.address).toBeUndefined();
  });
  it('rejects bad mobile, bad email, out-of-range age', () => {
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '12345' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', email: 'nope' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', age: '150' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: '', mobile: '9876543210' }).success).toBe(false);
  });
});

describe('problemSchema', () => {
  it('requires a problem name, allows note', () => {
    expect(problemSchema.parse({ problem: 'कंबर दुखी' }).isCustom).toBe(false);
    expect(problemSchema.parse({ problem: 'Vertigo', isCustom: 'true' }).isCustom).toBe(true);
    expect(problemSchema.safeParse({ problem: '  ' }).success).toBe(false);
  });
});

describe('visitSchema', () => {
  it('validates date, note, optional measurements', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'good', painScale: '7' });
    expect(r.painScale).toBe(7);
    expect(visitSchema.safeParse({ visitDate: 'June 11', progressNote: 'x' }).success).toBe(false);
    expect(visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'x', painScale: '11' }).success).toBe(false);
  });
});

describe('treatmentSchema', () => {
  it('all fields optional, empties dropped', () => {
    const r = treatmentSchema.parse({ yogaProgram: 'Surya Namaskar x12', dietPlan: '' });
    expect(r.yogaProgram).toBe('Surya Namaskar x12');
    expect(r.dietPlan).toBeUndefined();
  });
});

describe('docTypeSchema', () => {
  it('accepts known types only', () => {
    expect(docTypeSchema.safeParse('MRI').success).toBe(true);
    expect(docTypeSchema.safeParse('Selfie').success).toBe(false);
  });
});
