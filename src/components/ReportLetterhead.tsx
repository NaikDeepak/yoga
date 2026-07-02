import { BRANCHES } from '@/lib/presets';
import { CLINIC } from '@/lib/clinic';

const GREEN = '#1B3A2E';
const SAFFRON = '#C8962E';

interface ReportLetterheadProps {
  badgeLabel: string;
  patientCode: string;
  branch: typeof BRANCHES[number] | null;
  today: string;
}

export function ReportLetterhead({ badgeLabel, patientCode, branch, today }: ReportLetterheadProps) {
  return (
    <header className="mb-6 overflow-hidden rounded-sm border border-gray-200">
      {/* Saffron accent bar */}
      <div style={{ backgroundColor: SAFFRON, height: '6px' }} />

      <div className="flex items-start justify-between p-5">
        {/* Left: logo + clinic info */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pytc-logo.png" alt="PYTC" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: GREEN }}>
              {CLINIC.name}
            </h1>
            <p className="text-xs font-semibold tracking-widest" style={{ color: SAFFRON }}>
              LIVE PAIN-FREE · EMBRACE HEALTH AND HAPPINESS
            </p>
            {branch && (
              <p className="mt-1 text-xs text-gray-500">📍 {branch.fullAddress}</p>
            )}
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
              <span>📞 {CLINIC.phone}</span>
              <span>✉ {CLINIC.email}</span>
              <span>🕐 {CLINIC.hours}</span>
            </p>
          </div>
        </div>

        {/* Right: document type */}
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold" style={{ color: GREEN }}>{badgeLabel}</p>
          <p className="mt-0.5 text-xs text-gray-500">{today}</p>
          <p className="text-xs text-gray-400">Ref: {patientCode}</p>
        </div>
      </div>
    </header>
  );
}
