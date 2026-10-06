import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckinDots } from '@/components/CheckinDots';
import { VisitLineChart } from '@/components/VisitLineChart';
import type { Checkin } from '@/data/checkins';
import { adherence, dayStrip, painSeries, QUIET_AFTER_DAYS, quietDays } from '@/lib/adherence';
import { formatDueDate, formatFullDate } from '@/lib/dates';
import type { Translations } from '@/lib/i18n/en';

/** Days without a check-in (while a link is live) before the card flags it. */

/** Treatment tab: adherence and home pain from the client's daily check-ins (last 30 days). */
export function HomeExerciseCard({ checkins, lastCheckin, today, since, liveLinkSince, t }: {
  checkins: Checkin[]; // last 30 days, oldest first
  lastCheckin: string | null; // latest check-in ever (may be older than 30 days)
  today: string;
  since: string | null; // first exercise link (IST day): starts the adherence window
  liveLinkSince: string | null; // IST day the current live link was shared; null when none is live
  t: Translations;
}) {
  const h = t.homeExercise;
  const quiet = quietDays(today, lastCheckin, liveLinkSince);
  const isQuiet = quiet !== null && quiet >= QUIET_AFTER_DAYS;
  const quietLine = isQuiet && <p className="font-medium text-destructive">{h.quiet.replace('{days}', String(quiet))}</p>;

  if (!lastCheckin) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">{h.title}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {liveLinkSince
            ? quietLine || <p className="text-muted-foreground">{h.waiting.replace('{date}', formatFullDate(liveLinkSince))}</p>
            : <p className="text-muted-foreground">{h.empty}</p>}
        </CardContent>
      </Card>
    );
  }

  const windows = [[h.last7, 7], [h.last30, 30]] as const;
  // Every day of the 30, so the chart's spacing is true to time; gaps where no pain was logged.
  const pain = painSeries(checkins, today, 30);
  const painPoints = pain.filter((p) => p.pain !== null).length;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2"><CardTitle className="text-base">{h.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          {windows.map(([label, days]) => {
            const a = adherence(checkins, today, days, since);
            return (
              <div key={days} className="rounded-lg bg-primary/5 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {h.daysOf.replace('{score}', String(a.score)).replace('{days}', String(a.days))}
                </dd>
                {since && a.days < days && (
                  <dd className="text-[11px] text-muted-foreground">{h.since.replace('{date}', formatFullDate(since))}</dd>
                )}
              </div>
            );
          })}
        </dl>
        <CheckinDots days={dayStrip(checkins, today, 30)} labels={t.sharedPage.checkin.legend} size="sm" />
        {quietLine || <p className="text-xs text-muted-foreground">{h.lastCheckin.replace('{date}', formatFullDate(lastCheckin))}</p>}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{h.painTitle}</p>
          {painPoints >= 2
            ? <VisitLineChart data={pain.map((p) => ({ visitDate: formatDueDate(p.date), value: p.pain }))} color="var(--destructive)" unit="" />
            : <p className="text-xs text-muted-foreground">{h.noPainYet}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
