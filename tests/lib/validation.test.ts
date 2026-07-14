import { describe, it, expect } from 'vitest';
import {
  patientSchema, problemSchema, treatmentSchema, visitSchema, docTypeSchema,
  prescribedExercisesListSchema,
} from '@/lib/validation';
import { getISTDateString } from '@/lib/dates';

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
  it('accepts valid birthDate and rejects bad format or invalid calendar dates', () => {
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: '2000-01-01' }).success).toBe(true);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: '' }).success).toBe(true);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: '01-01-2000' }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: '2000-02-30' }).success).toBe(false);
  });
  it('accepts today as birthDate but rejects future dates', () => {
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: getISTDateString(0) }).success).toBe(true);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: getISTDateString(1) }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: 'A', mobile: '9876543210', birthDate: '2999-01-01' }).success).toBe(false);
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
  it('accepts a valid nextVisitDate', () => {
    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: futureDate });
    expect(r.nextVisitDate).toBe(futureDate);
  });
  it('maps empty nextVisitDate to undefined', () => {
    const r = visitSchema.parse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: '' });
    expect(r.nextVisitDate).toBeUndefined();
  });
  it('rejects a badly-formatted nextVisitDate', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: 'June 21' }).success,
    ).toBe(false);
  });
  it('rejects a nextVisitDate in the past', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: '2020-01-01' }).success,
    ).toBe(false);
  });
  it('rejects calendar-invalid visitDate (Feb 30)', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-02-30', progressNote: 'ok' }).success,
    ).toBe(false);
  });
  it('rejects calendar-invalid visitDate (month 13)', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-13-01', progressNote: 'ok' }).success,
    ).toBe(false);
  });
  it('rejects calendar-invalid nextVisitDate (Apr 31)', () => {
    expect(
      visitSchema.safeParse({ visitDate: '2026-06-11', progressNote: 'ok', nextVisitDate: '2099-04-31' }).success,
    ).toBe(false);
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

describe('prescribedExercisesListSchema', () => {
  const uuid1 = '11111111-1111-4111-8111-111111111111';
  const uuid2 = '22222222-2222-4222-8222-222222222222';

  it('accepts a list of distinct exercises', () => {
    const r = prescribedExercisesListSchema.safeParse([
      { exerciseId: uuid1, customNote: null, repetitions: null, daysPerWeek: null },
      { exerciseId: uuid2, customNote: 'note', repetitions: '5', daysPerWeek: '3' },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects duplicate exerciseIds in one payload', () => {
    const r = prescribedExercisesListSchema.safeParse([
      { exerciseId: uuid1, customNote: null, repetitions: null, daysPerWeek: null },
      { exerciseId: uuid1, customNote: null, repetitions: null, daysPerWeek: null },
    ]);
    expect(r.success).toBe(false);
  });

  it('rejects an over-long customNote with a bilingual message', () => {
    const r = prescribedExercisesListSchema.safeParse([
      { exerciseId: uuid1, customNote: 'x'.repeat(501), repetitions: null, daysPerWeek: null },
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/\//);
    }
  });
});
