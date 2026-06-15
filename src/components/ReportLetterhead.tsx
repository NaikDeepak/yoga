import { BRANCHES } from '@/lib/presets';

const GREEN = '#1B3A2E';
const CLINIC = {
  phone: '+91 85509 21037',
  email: 'pawarsyog@gmail.com',
  hours: 'Mon–Sat, 6:00 AM – 8:00 PM',
};

interface ReportLetterheadProps {
  badgeLabel: string;
  patientCode: string;
  branch: typeof BRANCHES[number] | null;
  today: string;
}

export function ReportLetterhead({ badgeLabel, patientCode, branch, today }: ReportLetterheadProps) {
  return (
    <header className="mb-6 flex overflow-hidden rounded border border-gray-200">
      <div className="flex flex-1 items-center gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pytc-logo.png" alt="PYTC" className="h-16 w-auto object-contain" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Pawar&apos;s Yog Therapy Center</h1>
          <p className="text-xs font-semibold tracking-widest" style={{ color: '#2D6A4F' }}>
            LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS
          </p>
          {branch && (
            <p className="mt-1 text-xs text-gray-500">
              📍 {branch.fullAddress}
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
            <span>📞 {CLINIC.phone}</span>
            <span>✉ {CLINIC.email}</span>
            <span>🕐 {CLINIC.hours}</span>
          </p>
        </div>
      </div>
      <div
        className="flex w-44 shrink-0 flex-col items-center justify-center p-4 text-white"
        style={{ backgroundColor: GREEN }}
      >
        <p className="text-xs tracking-widest opacity-75">DOCUMENT</p>
        <p className="text-lg font-bold leading-tight">{badgeLabel}</p>
        <p className="mt-1 text-xs opacity-75">{today}</p>
        <p className="text-xs opacity-75">Ref: {patientCode}</p>
      </div>
    </header>
  );
}
