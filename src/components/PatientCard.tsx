import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PatientCardProps {
  id: string;
  fullName: string;
  patientCode: string;
  mobile: string;
  problems: string[];
  completionStatus: { filled: number; total: 5 };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function assessmentChip(filled: number): { text: string; cls: string } {
  if (filled === 5)
    return { text: 'Assessment ✓ / मूल्यांकन ✓', cls: 'bg-primary/10 text-primary' };
  if (filled > 0)
    return {
      text: `Assessment ${filled}/5 / मूल्यांकन ${filled}/5`,
      cls: 'bg-yellow-100 text-yellow-800',
    };
  return { text: 'Assessment — / मूल्यांकन —', cls: 'bg-muted text-muted-foreground' };
}

export function PatientCard({
  id,
  fullName,
  patientCode,
  mobile,
  problems,
  completionStatus,
}: PatientCardProps) {
  const visible = problems.slice(0, 3);
  const overflow = problems.length - visible.length;
  const chip = assessmentChip(completionStatus.filled);

  return (
    <Link href={`/patients/${id}`} className="block h-full">
      <div className="rounded-2xl border border-border bg-card shadow-sm p-5 hover:shadow-md transition-shadow h-full flex flex-col gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            {initials(fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground truncate">{fullName}</span>
              <Badge
                variant="outline"
                className="border-brand-accent text-brand-accent shrink-0"
              >
                {patientCode}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{mobile}</p>
          </div>
        </div>

        {/* Problems + assessment chip */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto">
          {visible.map((p) => (
            <Badge key={p} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
              {p}
            </Badge>
          ))}
          {overflow > 0 && (
            <span className="text-xs text-muted-foreground">+{overflow} more</span>
          )}
          <span
            className={cn(
              'ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              chip.cls,
            )}
          >
            {chip.text}
          </span>
        </div>
      </div>
    </Link>
  );
}
