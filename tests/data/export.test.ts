import { eq } from 'drizzle-orm';
import { addPayment } from '@/data/fees';
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { exportClients, exportVisits, exportFees } from '@/data/export';
import { patients, patientProblems, fees, feePayments, charges, visits } from '@/db/schema';
import type { Db } from '@/db/types';

let db: Db;

beforeEach(async () => {
  db = await createTestDb();

  await db.insert(patients).values([
    {
      id: '11111111-1111-1111-1111-111111111111',
      patientCode: 'PYT-0001',
      fullName: 'Asha Patil',
      mobile: '9876543210',
      branch: 'Manjari BK',
      age: 40,
      gender: 'Female',
      createdAt: new Date('2026-06-01T10:00:00Z'),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      patientCode: 'PYT-0002',
      fullName: 'Bhavna Shinde',
      mobile: '9876543211',
      branch: 'Kharadi',
      age: null,
      gender: null,
      createdAt: new Date('2026-06-02T10:00:00Z'),
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      patientCode: 'PYT-0003',
      fullName: 'Chetan More',
      mobile: '9876543212',
      branch: 'Manjari BK',
      age: 35,
      gender: 'Male',
      createdAt: new Date('2026-06-03T10:00:00Z'),
    },
  ]);

  await db.insert(patientProblems).values([
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      problem: 'कंबर दुखी',
      createdAt: new Date('2026-06-01T10:01:00Z'),
    },
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      problem: 'मान दुखी',
      createdAt: new Date('2026-06-01T10:02:00Z'),
    },
    {
      patientId: '33333333-3333-3333-3333-333333333333',
      problem: 'सायटिका',
      createdAt: new Date('2026-06-03T10:01:00Z'),
    },
  ]);

  await db.insert(fees).values([
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      courseFee: '5000',
    },
    {
      patientId: '33333333-3333-3333-3333-333333333333',
      courseFee: '3000',
    },
  ]);

  await db.insert(feePayments).values([
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      amount: '2000',
      paymentDate: '2026-06-05',
    },
  ]);

  await db.insert(charges).values([
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      feeType: 'consultation',
      label: 'Consultation',
      amount: '500',
      chargeDate: '2026-06-01',
    },
    {
      patientId: '33333333-3333-3333-3333-333333333333',
      feeType: 'monthly_yoga',
      label: 'Monthly Yoga',
      amount: '250',
      chargeDate: '2026-06-03',
    },
    {
      patientId: '33333333-3333-3333-3333-333333333333',
      feeType: 'package',
      label: 'Package',
      amount: '150',
      chargeDate: '2026-06-04',
    },
  ]);

  await db.insert(visits).values([
    {
      patientId: '11111111-1111-1111-1111-111111111111',
      visitDate: '2026-06-02',
      progressNote: 'DISTINCTIVE_SECRET_NOTE_ASHA',
      painScale: 6,
      weightKg: 62.5,
      nextVisitDate: '2026-06-10',
    },
    {
      patientId: '22222222-2222-2222-2222-222222222222',
      visitDate: '2026-06-01',
      progressNote: 'DISTINCTIVE_SECRET_NOTE_BHAVNA',
      painScale: null,
      weightKg: null,
      nextVisitDate: null,
    },
    {
      patientId: '33333333-3333-3333-3333-333333333333',
      visitDate: '2026-06-03',
      progressNote: 'DISTINCTIVE_SECRET_NOTE_CHETAN',
      painScale: 2,
      weightKg: 70,
      nextVisitDate: '2026-06-15',
    },
  ]);
});

describe('exportClients', () => {
  it('returns exact headers, joins problems with semicolon, handles nulls, and orders by client code', async () => {
    const result = await exportClients(db);

    expect(result.header).toEqual([
      'Client code',
      'Name',
      'Mobile',
      'Branch',
      'Age',
      'Gender',
      'Joined',
      'Problems',
    ]);

    expect(result.rows).toEqual([
      ['PYT-0001', 'Asha Patil', '9876543210', 'Manjari BK', 40, 'Female', '2026-06-01', 'कंबर दुखी; मान दुखी'],
      ['PYT-0002', 'Bhavna Shinde', '9876543211', 'Kharadi', null, null, '2026-06-02', ''],
      ['PYT-0003', 'Chetan More', '9876543212', 'Manjari BK', 35, 'Male', '2026-06-03', 'सायटिका'],
    ]);
  });

  it('filters clients by branch when provided', async () => {
    const result = await exportClients(db, { branch: 'Manjari BK' });
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r[0])).toEqual(['PYT-0001', 'PYT-0003']);
  });
});

describe('exportVisits', () => {
  it('returns exact headers, orders by visit date then client code, and preserves nulls', async () => {
    const result = await exportVisits(db);

    expect(result.header).toEqual([
      'Client code',
      'Name',
      'Visit date',
      'Pain (0-10)',
      'Weight (kg)',
      'Next visit',
    ]);

    expect(result.rows).toEqual([
      ['PYT-0002', 'Bhavna Shinde', '2026-06-01', null, null, null],
      ['PYT-0001', 'Asha Patil', '2026-06-02', 6, 62.5, '2026-06-10'],
      ['PYT-0003', 'Chetan More', '2026-06-03', 2, 70, '2026-06-15'],
    ]);
  });

  it('filters visits by client branch', async () => {
    const result = await exportVisits(db, { branch: 'Kharadi' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe('PYT-0002');
  });

  it('never leaks clinical visit progress notes into the export', async () => {
    const result = await exportVisits(db);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('DISTINCTIVE_SECRET_NOTE_ASHA');
    expect(serialized).not.toContain('DISTINCTIVE_SECRET_NOTE_BHAVNA');
    expect(serialized).not.toContain('DISTINCTIVE_SECRET_NOTE_CHETAN');
  });
});

describe('exportFees', () => {
  it('returns exact headers, computes balance and charges totals, blanks fee cells when no fee row, and orders by client code', async () => {
    const result = await exportFees(db);

    expect(result.header).toEqual([
      'Client code',
      'Name',
      'Course fee',
      'Total paid',
      'Balance',
      'Charges total',
    ]);

    expect(result.rows).toEqual([
      ['PYT-0001', 'Asha Patil', 5000, 2000, 3000, 500],
      ['PYT-0002', 'Bhavna Shinde', null, 0, null, 0], // no course fee: fee + balance blank, money received still shown
      ['PYT-0003', 'Chetan More', 3000, 0, 3000, 400],
    ]);
  });

  it('shows payments received even when no course fee is set', async () => {
    const [, bhavna] = (await exportClients(db)).rows;
    const id = (await db.select({ id: patients.id }).from(patients).where(eq(patients.patientCode, bhavna[0] as string)))[0].id;
    await addPayment(db, id, 750, '2026-10-01', null);
    const row = (await exportFees(db)).rows.find((r) => r[0] === bhavna[0])!;
    expect(row.slice(2, 5)).toEqual([null, 750, null]);
  });

  it('filters fees by client branch', async () => {
    const result = await exportFees(db, { branch: 'Kharadi' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(['PYT-0002', 'Bhavna Shinde', null, 0, null, 0]);
  });
});
