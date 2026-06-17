import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPatientFees } from '@/data/fees';
import { BRANCHES } from '@/lib/presets';
import { PrintButton } from '@/components/PrintButton';
import { ReportLetterhead } from '@/components/ReportLetterhead';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

const GREEN = '#1B3A2E';
const SAFFRON = '#C8962E';
const CREAM = '#FDF8F0';

import { getISTDateString } from '@/lib/dates';

function formatCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const patientFees = await getPatientFees(db, id);
  if (patientFees.courseFee === null) redirect(`/patients/${id}`);

  const t = getTranslations(await getLocale());
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const today = getISTDateString();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ── LETTERHEAD ── */}
      <ReportLetterhead badgeLabel={t.receipt.title} patientCode={patient.patientCode} branch={branch} today={today} />

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

      {/* ── FEE SUMMARY ── */}
      <SectionHeader>{t.receipt.feeSummary}</SectionHeader>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <FeeBox label={t.receipt.totalFee} amount={patientFees.courseFee} variant="neutral" />
        <FeeBox label={t.receipt.totalPaid} amount={patientFees.totalPaid} variant="green" />
        <FeeBox
          label={t.receipt.balanceDue}
          amount={patientFees.balance ?? 0}
          variant={(patientFees.balance ?? 0) > 0 ? 'orange' : 'green'}
        />
      </div>

      {/* ── PAYMENT HISTORY ── */}
      <SectionHeader>{t.receipt.paymentHistory}</SectionHeader>
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: CREAM, borderBottom: `2px solid ${SAFFRON}` }}>
              {[t.receipt.no, t.receipt.date, t.receipt.description, t.receipt.amount].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...patientFees.payments].reverse().map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border-b border-gray-100 px-3 py-2">{i + 1}</td>
                <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">{p.paymentDate}</td>
                <td className="border-b border-gray-100 px-3 py-2">{p.description ?? '—'}</td>
                <td className="border-b border-gray-100 px-3 py-2 font-medium">{formatCurrency(p.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td colSpan={3} className="px-3 py-2 text-right">{t.receipt.totalPaid}</td>
              <td className="px-3 py-2" style={{ color: GREEN }}>{formatCurrency(patientFees.totalPaid)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── FOOTER ── */}
      <hr className="border-gray-200" />
      <div className="mt-8 flex justify-end">
        <div className="w-52 border-t-2 border-gray-400 pt-2 text-right">
          <p className="text-sm font-bold">Aacharya Narayan Pawar</p>
          <p className="text-xs text-gray-600">Founder &amp; Director of PYTC | Chief Medical Yoga Expert</p>
          <p className="text-xs italic text-gray-500">Pawar&apos;s Yog Therapy Center</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        {t.receipt.footerOfficial} | {t.receipt.footerGenerated} {today}
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

function FeeBox({
  label, amount, variant,
}: { label: string; amount: number; variant: 'neutral' | 'green' | 'orange' }) {
  const bg = { neutral: CREAM, green: '#DCFCE7', orange: '#FFF3E0' }[variant];
  const color = { neutral: '#374151', green: '#1B3A2E', orange: '#C2410C' }[variant];
  const borderColor = { neutral: '#E5D5B5', green: '#86EFAC', orange: '#FED7AA' }[variant];
  return (
    <div className="rounded border p-4 text-center" style={{ backgroundColor: bg, borderColor }}>
      <p className="text-2xl font-bold" style={{ color }}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-xs tracking-widest text-gray-500">{label}</p>
    </div>
  );
}
