import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { computeBmi } from '@/lib/bmi';
import { BRANCHES } from '@/lib/presets';
import { PrintButton } from '@/components/PrintButton';

const CLINIC = { phone: '+91 85509 21037', email: 'pawarsyog@gmail.com', location: 'Pune, Maharashtra' };
const GREEN = '#1B3A2E';

const GENDER_MARATHI: Record<string, string> = { male: 'पुरुष', female: 'स्त्री', other: 'इतर' };

const MODALITY_KEYS = [
  ['yogaProgram', 'Yoga Program'],
  ['pranayam', 'Pranayam'],
  ['massage', 'Massage'],
  ['yogaTherapy', 'Yoga Therapy'],
  ['panchkarma', 'Panchkarma'],
] as const;

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const [problems, plan, visits, patientFees] = await Promise.all([
    listProblems(db, id),
    getTreatmentPlan(db, id),
    listVisits(db, id),
    getPatientFees(db, id),
  ]);

  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const branch = BRANCHES.find((b) => b.key === patient.branch) ?? null;
  const today = formatDate();
  const latestNote = visits[0]?.progressNote ?? null;
  const modalities = plan
    ? MODALITY_KEYS.filter(([key]) => Boolean(plan[key as keyof typeof plan])).map(([, label]) => label)
    : [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ── LETTERHEAD ── */}
      <header className="mb-6 flex overflow-hidden rounded border border-gray-200">
        <div className="flex flex-1 items-center gap-4 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pytc-logo.png" alt="PYTC" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Pawar&apos;s Yog Therapy Center</h1>
            <p className="text-xs font-semibold tracking-widest" style={{ color: '#2D6A4F' }}>
              HEALING THROUGH NATURE &amp; TRADITION
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
              <span>📍 {CLINIC.location}</span>
              <span>📞 {CLINIC.phone}</span>
              <span>✉ {CLINIC.email}</span>
            </p>
          </div>
        </div>
        <div
          className="flex w-44 shrink-0 flex-col items-center justify-center p-4 text-white"
          style={{ backgroundColor: GREEN }}
        >
          <p className="text-xs tracking-widest opacity-75">DOCUMENT</p>
          <p className="text-lg font-bold leading-tight">Patient Report</p>
          <p className="mt-1 text-xs opacity-75">{today}</p>
          <p className="text-xs opacity-75">Ref: {patient.patientCode}</p>
        </div>
      </header>

      {/* ── PATIENT IDENTIFICATION ── */}
      <SectionHeader>PATIENT IDENTIFICATION</SectionHeader>
      <div className="mb-6 flex items-center gap-4 rounded border border-gray-100 bg-gray-50 p-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: GREEN }}
        >
          {nameInitials(patient.fullName)}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{patient.fullName}</p>
          <p className="text-sm text-gray-600">
            {patient.gender ? GENDER_MARATHI[patient.gender] : ''}
            {patient.age ? ` | Age: ${patient.age} yrs` : ''}
            {` | ${patient.mobile}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>{patient.patientCode}</Chip>
            {branch && <Chip>{branch.label}</Chip>}
          </div>
        </div>
      </div>

      {/* ── PERSONAL INFORMATION ── */}
      <SectionHeader>PERSONAL INFORMATION</SectionHeader>
      <div className="mb-6">
        <InfoTable>
          <InfoRow2
            label1="Full Name" value1={patient.fullName}
            label2="Gender" value2={patient.gender ? GENDER_MARATHI[patient.gender] : '—'}
          />
          <InfoRow2
            label1="Age" value1={patient.age ? `${patient.age} years` : '—'}
            label2="Mobile" value2={patient.mobile}
          />
          <InfoRow2
            label1="Email" value1={patient.email ?? '—'}
            label2="Occupation" value2={patient.occupation ?? '—'}
          />
          <InfoRow1 label="Address" value={patient.address ?? '—'} />
          {branch && <InfoRow1 label="Branch" value={branch.label} />}
        </InfoTable>
      </div>

      {/* ── PHYSICAL MEASUREMENTS ── */}
      {(patient.weightKg !== null || patient.heightCm !== null) && (
        <>
          <SectionHeader>PHYSICAL MEASUREMENTS</SectionHeader>
          <div className="mb-6">
            <InfoTable>
              <InfoRow2
                label1="Weight" value1={patient.weightKg !== null ? `${patient.weightKg.toFixed(2)} kg` : '—'}
                label2="Height" value2={patient.heightCm !== null ? `${patient.heightCm.toFixed(2)} cm` : '—'}
              />
              {bmi !== null && <InfoRow1 label="BMI" value={bmi.toFixed(1)} />}
            </InfoTable>
          </div>
        </>
      )}

      {/* ── HEALTH CONDITIONS ── */}
      {problems.length > 0 && (
        <>
          <SectionHeader>HEALTH CONDITIONS</SectionHeader>
          <div className="mb-6 flex flex-wrap gap-2 py-2">
            {problems.map((p) => <Chip key={p.id}>{p.problem}</Chip>)}
          </div>
        </>
      )}

      {/* ── TREATMENT PLAN ── */}
      {(plan || latestNote) && (
        <>
          <SectionHeader>TREATMENT PLAN</SectionHeader>
          <div className="mb-6">
            <table className="w-full text-sm">
              <tbody>
                {modalities.length > 0 && (
                  <tr className="border-b border-gray-100 align-top">
                    <td className="w-36 py-2 font-medium text-gray-700">Modalities</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {modalities.map((m) => <Chip key={m}>{m}</Chip>)}
                      </div>
                    </td>
                  </tr>
                )}
                {plan?.yogaProgram && <PlanRow label="Yoga Program" value={plan.yogaProgram} />}
                {plan?.pranayam && <PlanRow label="Pranayam" value={plan.pranayam} />}
                {plan?.massage && <PlanRow label="Massage" value={plan.massage} />}
                {plan?.yogaTherapy && <PlanRow label="Yoga Therapy" value={plan.yogaTherapy} />}
                {plan?.dietPlan && <PlanRow label="Diet Plan" value={plan.dietPlan} />}
                {plan?.medicines && <PlanRow label="Medicines" value={plan.medicines} />}
                {plan?.panchkarma && <PlanRow label="Panchkarma" value={plan.panchkarma} />}
                {latestNote && <PlanRow label="Progress Notes" value={latestNote} />}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── FEE SUMMARY ── */}
      {patientFees.courseFee !== null && (
        <>
          <SectionHeader>FEE SUMMARY</SectionHeader>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <FeeBox label="TOTAL FEE" amount={patientFees.courseFee} variant="neutral" />
            <FeeBox label="AMOUNT PAID" amount={patientFees.totalPaid} variant="green" />
            <FeeBox
              label="BALANCE DUE"
              amount={patientFees.balance ?? 0}
              variant={(patientFees.balance ?? 0) > 0 ? 'orange' : 'green'}
            />
          </div>
        </>
      )}

      {/* ── VISIT HISTORY ── */}
      <SectionHeader>VISIT HISTORY</SectionHeader>
      <div className="mb-8">
        {visits.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No visit records found / भेटींची नोंद नाही
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: GREEN, color: 'white' }}>
                {['NO.', 'VISIT DATE', 'WEIGHT', 'PAIN LEVEL', 'SESSION NOTES'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visits.map((v, i) => (
                <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border-b border-gray-100 px-3 py-2">{i + 1}</td>
                  <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">{v.visitDate}</td>
                  <td className="border-b border-gray-100 px-3 py-2">{v.weightKg != null ? `${v.weightKg} kg` : '—'}</td>
                  <td className="border-b border-gray-100 px-3 py-2">{v.painScale != null ? `${v.painScale}/10` : '—'}</td>
                  <td className="border-b border-gray-100 px-3 py-2 whitespace-pre-wrap">{v.progressNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FOOTER ── */}
      <hr className="border-gray-200" />
      <div className="mt-8 flex justify-end">
        <div className="w-52 border-t-2 border-gray-400 pt-2 text-right">
          <p className="text-sm font-bold">Aaracharya Narayan Pawar</p>
          <p className="text-xs text-gray-600">Founder of PYTC &amp; Lead Instructor</p>
          <p className="text-xs italic text-gray-500">Pawar&apos;s Yog Therapy Center, Pune</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        This is an official patient record issued by Pawar&apos;s Yog Therapy Center.
        Confidential — intended solely for the patient and treating practitioner. | Generated on {today}
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3 inline-block rounded px-3 py-1 text-xs font-bold tracking-widest text-white"
      style={{ backgroundColor: '#1B3A2E' }}
    >
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: '#1B3A2E', color: '#1B3A2E', backgroundColor: '#E8F5E9' }}
    >
      {children}
    </span>
  );
}

function InfoTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-sm"><tbody>{children}</tbody></table>;
}

function InfoRow2({
  label1, value1, label2, value2,
}: { label1: string; value1: string; label2: string; value2: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-28 py-2 font-medium text-gray-700">{label1}</td>
      <td className="py-2 pr-6">{value1}</td>
      <td className="w-28 py-2 font-medium text-gray-700">{label2}</td>
      <td className="py-2">{value2}</td>
    </tr>
  );
}

function InfoRow1({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="w-28 py-2 font-medium text-gray-700">{label}</td>
      <td className="py-2" colSpan={3}>{value}</td>
    </tr>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="w-36 py-2 font-medium text-gray-700">{label}</td>
      <td className="py-2 whitespace-pre-wrap">{value}</td>
    </tr>
  );
}

function FeeBox({
  label, amount, variant,
}: { label: string; amount: number; variant: 'neutral' | 'green' | 'orange' }) {
  const bg = { neutral: '#F9FAFB', green: '#E8F5E9', orange: '#FFF3E0' }[variant];
  const color = { neutral: '#374151', green: '#1B3A2E', orange: '#C2410C' }[variant];
  return (
    <div className="rounded p-4 text-center" style={{ backgroundColor: bg }}>
      <p className="text-2xl font-bold" style={{ color }}>
        ₹{amount.toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-xs tracking-widest text-gray-500">{label}</p>
    </div>
  );
}
