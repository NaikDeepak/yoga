// @vitest-environment jsdom
import '../../helpers/action-mocks';
import { freshTestDb } from '../../helpers/action-mocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PatientPage from '@/app/(app)/patients/[id]/page';
import ReceiptPage from '@/app/(app)/patients/[id]/receipt/page';
import ChargeReceiptPage from '@/app/(app)/patients/[id]/charges/[chargeId]/receipt/page';
import PrintPage from '@/app/(app)/patients/[id]/print/page';
import { createPatient } from '@/data/patients';
import { setCourseFee } from '@/data/fees';
import { addCharge } from '@/data/charges';
import { en } from '@/lib/i18n/en';
import { resolveServerTree } from '../../helpers/server-render';
import type { Db } from '@/db/types';

vi.mock('@/lib/i18n/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/lib/i18n/context', () => ({ useTranslations: () => en }));

let db: Db;
let patientId: string;
let chargeId: string;

beforeEach(async () => {
  db = await freshTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
  await setCourseFee(db, patientId, 5000);
  chargeId = (await addCharge(db, patientId, 'consultation', 'Consultation', 500, '2026-08-10', null)).id;
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function renderPatient(tab?: string) {
  const element = await PatientPage({
    params: Promise.resolve({ id: patientId }),
    searchParams: Promise.resolve({ tab }),
  });
  return render(await resolveServerTree(element));
}

describe('PatientPage fees switch', () => {
  it('shows the fees tab, quick link and receipt link when on', async () => {
    vi.stubEnv('FEATURE_FEES', 'true');
    await renderPatient('fees');
    expect(screen.getAllByRole('link', { name: en.patientDetail.tabs.fees }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.fees.setCourseFee).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(en.fees.recordPayment)).length).toBeGreaterThan(1);
    expect(screen.getAllByRole('link', { name: new RegExp(en.patientDetail.receipt) }).length).toBeGreaterThan(0);
  });

  it('hides the fees tab, its content, quick link and receipt link when off, and ?tab=fees shows overview', async () => {
    vi.stubEnv('FEATURE_FEES', 'false');
    await renderPatient('fees');
    expect(screen.queryAllByRole('link', { name: en.patientDetail.tabs.fees })).toHaveLength(0);
    expect(screen.queryAllByText(en.fees.setCourseFee)).toHaveLength(0);
    expect(screen.queryAllByText(new RegExp(en.fees.recordPayment))).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: new RegExp(en.patientDetail.receipt) })).toHaveLength(0);
    // overview content is what renders instead
    expect(screen.getAllByRole('link', { name: en.patientDetail.tabs.overview }).length).toBeGreaterThan(0);
  });
});

describe('receipt pages fees switch', () => {
  it('receipt renders when on and 404s when off', async () => {
    vi.stubEnv('FEATURE_FEES', 'true');
    const el = await ReceiptPage({ params: Promise.resolve({ id: patientId }) });
    expect(el).toBeTruthy();
    vi.stubEnv('FEATURE_FEES', 'false');
    await expect(ReceiptPage({ params: Promise.resolve({ id: patientId }) })).rejects.toThrow('NOT_FOUND');
  });

  it('charge receipt renders when on and 404s when off', async () => {
    vi.stubEnv('FEATURE_FEES', 'true');
    const el = await ChargeReceiptPage({ params: Promise.resolve({ id: patientId, chargeId }) });
    expect(el).toBeTruthy();
    vi.stubEnv('FEATURE_FEES', 'false');
    await expect(ChargeReceiptPage({ params: Promise.resolve({ id: patientId, chargeId }) })).rejects.toThrow('NOT_FOUND');
  });
});

describe('print page fees switch', () => {
  it('shows the fee summary when on and hides it when off', async () => {
    vi.stubEnv('FEATURE_FEES', 'true');
    const on = render(await resolveServerTree(await PrintPage({ params: Promise.resolve({ id: patientId }) })));
    expect(screen.getAllByText(en.print.feeSummary).length).toBeGreaterThan(0);
    on.unmount();
    vi.stubEnv('FEATURE_FEES', 'false');
    render(await resolveServerTree(await PrintPage({ params: Promise.resolve({ id: patientId }) })));
    expect(screen.queryAllByText(en.print.feeSummary)).toHaveLength(0);
    expect(screen.queryAllByText(en.print.balanceDue)).toHaveLength(0);
  });
});
