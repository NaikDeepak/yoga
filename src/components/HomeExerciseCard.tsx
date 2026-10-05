import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckinDots } from '@/components/CheckinDots';
import { VisitLineChart } from '@/components/VisitLineChart';
import type { Checkin } from '@/data/checkins';
import { adherence, dayStrip, daysSince } from '@/lib/adherence';
import { formatFullDate } from '@/lib/dates';
import type { Translations } from '@/lib/i18n/en';

/** Days without a check-in (while a link is live) before the card flags it. */
const QUIET_DAYS = 3;

/** Treatment tab: adherence and home pain from the client's daily check-ins (last 30 days). */
export function HomeExerciseCard({ checkins, lastCheckin, today, since, linkActive, t }: {
  checkins: Checkin[]; // last 30 days, oldest first
  lastCheckin: string | null; // latest check-in ever (may be older than 30 days)
  today: string;
  since: string | null; // first exercise link (IST day)
  linkActive: boolean;
  t: Translations;
}) {
  const h = t.homeExercise;
  const fmt = (a: { score: number; days: number }) =>
    h.daysOf.replace('{score}', String(a.score)).replace('{days}', String(a.days));
  const week = adherence(checkins, today, 7, since);
  const month = adherence(checkins, today, 30, since);
  const quietFor = lastCheckin ? daysSince(lastCheckin, today) : null;
  const pain = checkins.filter((c) => c.pain !== null).map((c) => ({ visitDate: formatFullDate(c.date), value: c.pain! }));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{h.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!lastCheckin ? (
          <p className="text-muted-foreground">{h.empty}</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              {([[h.last7, week], [h.last30, month]] as const).map(([label, a]) => (
                <div key={label} className="rounded-lg bg-primary/5 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{fmt(a)}</dd>
                  {since && a.days < (label === h.last7 ? 7 : 30) && (
                    <dd className="text-[11px] text-muted-foreground">{h.since.replace('{date}', formatFullDate(since))}</dd>
                  )}
                </div>
              ))}
            </dl>
            <CheckinDots days={dayStrip(checkins, today, 30)} labels={t.sharedPage.checkin.legend} size="sm" />
            <p className={linkActive && quietFor !== null && quietFor >= QUIET_DAYS ? 'font-medium text-destructive' : 'text-xs text-muted-foreground'}>
              {linkActive && quietFor !== null && quietFor >= QUIET_DAYS
                ? h.quiet.replace('{days}', String(quietFor))
                : h.lastCheckin.replace('{date}', formatFullDate(lastCheckin))}
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{h.painTitle}</p>
              {pain.length >= 2
                ? <VisitLineChart data={pain} color="var(--destructive)" unit="" />
                : <p className="text-xs text-muted-foreground">{h.noPainYet}</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
