import Link from 'next/link';
import type { QuietClient } from '@/data/quiet-clients';
import type { Translations } from '@/lib/i18n/translations';
import { daysSince, QUIET_AFTER_DAYS } from '@/lib/adherence';
import { formatDueDate, getISTDateString } from '@/lib/dates';
import { firstName } from '@/lib/names';
import { quietNudgeMessage, waMeUrl } from '@/lib/whatsapp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NudgeButton } from './NudgeButton';

/** Dashboard: clients whose home check-ins have stopped, with a one-tap WhatsApp nudge (spec 2026-10-06-quiet-client-alerts). */
export function QuietClientsCard({ clients, today, t, className = '' }: { clients: QuietClient[]; today: string; t: Translations; className?: string }) {
  const q = t.dashboard.quiet;
  const nudged = (at: Date) => {
    const d = daysSince(getISTDateString(0, at), today);
    return d <= 0 ? q.nudgedToday : d === 1 ? q.nudgedYesterday : q.nudgedDaysAgo.replace('{days}', String(d));
  };

  return (
    <Card className={`rounded-2xl shadow-sm border-border ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{q.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{q.subtitle.replace('{days}', String(QUIET_AFTER_DAYS))}</p>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{q.empty}</p>
        ) : (
          // Everyone is listed (no hidden "+N more"); long lists scroll inside the card.
          <ul className="mt-1 max-h-96 space-y-3 overflow-y-auto pr-1 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:space-y-0 sm:gap-y-3">
            {clients.map((c) => (
              <li key={c.patientId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/patients/${c.patientId}?tab=treatment`} className="block truncate text-sm font-medium transition-colors hover:text-primary">
                    {c.fullName}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-destructive">{q.days.replace('{days}', String(c.quietDays))}</span>
                    {' · '}{c.lastCheckin ? q.lastCheckin.replace('{date}', formatDueDate(c.lastCheckin)) : q.never}
                    {c.nudgedAt && <> · <span className="text-emerald-700">{nudged(c.nudgedAt)}</span></>}
                  </p>
                </div>
                <NudgeButton patientId={c.patientId} href={waMeUrl(c.mobile, quietNudgeMessage(firstName(c.fullName)))} label={q.nudge} failedText={q.nudgeFailed} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
