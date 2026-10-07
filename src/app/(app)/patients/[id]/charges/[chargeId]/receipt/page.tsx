import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getCharge } from '@/data/charges';
import { BRANCHES } from '@/lib/presets';
import { PrintButton } from '@/components/PrintButton';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { ClinicSignature } from '@/components/ClinicSignature';
import { clinicName, clinicProfile } from '@/clinics';
import { getISTDateString } from '@/lib/dates';

const GREEN = clinicProfile.brand.primary;
const SAFFRON = clinicProfile.brand.accent;

function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ChargeReceiptPage({
  params,
}: {
  params: Promise<{ id: string; chargeId: string }>;
}) {
  const { id, chargeId } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const charge = await getCharge(db, id, chargeId);
  if (!charge) notFound();

  const locale = await getLocale();
  const t = getTranslations(locale);
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const today = getISTDateString();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ── LETTERHEAD ── */}
      <ReportLetterhead badgeLabel={t.chargeReceipt.title} patientCode={patient.patientCode} branch={branch} today={today} />

      {/* ── PATIENT ── */}
      <SectionHeader>{t.receipt.patientSection}</SectionHeader>
      <div className="mb-6">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="w-28 py-2 font-medium text-gray-700">{t.form.fullName}</td>
              <td className="py-2 pr-6">{patient.fullName}</td>
              <td className="w-28 py-2 font-medium text-gray-700">{t.receipt.patientCode}</td>
              <td className="py-2">{patient.patientCode}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="w-28 py-2 font-medium text-gray-700">{t.form.branch}</td>
              <td className="py-2 pr-6">{branch?.label ?? '—'}</td>
              <td className="w-28 py-2 font-medium text-gray-700">{t.form.mobile}</td>
              <td className="py-2">{patient.mobile}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── CHARGE ── */}
      <SectionHeader>{t.chargeReceipt.charge}</SectionHeader>
      <div className="mb-8 rounded border p-4" style={{ borderColor: '#E5D5B5' }}>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-medium">{charge.label}</span>
          <span className="text-2xl font-bold" style={{ color: GREEN }}>{formatCurrency(charge.amount)}</span>
        </div>
        <p className="mt-2 text-sm text-gray-600">{t.chargeReceipt.date}: {charge.chargeDate}</p>
        {charge.note && <p className="mt-1 text-sm text-gray-500">{charge.note}</p>}
      </div>

      {/* ── FOOTER ── */}
      <hr className="border-gray-200" />
      <div className="mt-8 flex justify-end">
        <ClinicSignature />
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        {t.chargeReceipt.footerOfficial.replaceAll('{clinic}', clinicName(locale))} | {t.chargeReceipt.footerGenerated} {today}
      </p>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 border-l-4 pl-3" style={{ borderColor: SAFFRON }}>
      <span className="text-xs font-bold uppercase tracking-widest text-gray-600">{children}</span>
    </div>
  );
}
