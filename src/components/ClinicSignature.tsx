import { clinicProfile } from '@/clinics';

export function ClinicSignature({ className }: { className?: string } = {}) {
  const { signature } = clinicProfile;
  return (
    <div className={className ?? 'w-52 border-t-2 border-gray-400 pt-2 text-right'}>
      <p className="text-sm font-bold">{signature.name}</p>
      {signature.lines.map((line, idx) => (
        <p
          key={idx}
          className={idx === 0 ? 'text-xs text-gray-600' : 'text-xs italic text-gray-500'}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
