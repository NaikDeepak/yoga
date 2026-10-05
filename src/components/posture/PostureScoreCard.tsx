import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LatestPostureScore } from '@/data/posture';
import { formatFullDate } from '@/lib/dates';
import type { Translations } from '@/lib/i18n/en';
import { scoreTrend } from '@/lib/posture-compare';
import { scoreColor } from './ReportParts';
import { ScoreTrend } from './ScoreTrend';

/** Overview tab: latest posture score, grade and trend vs the previous assessment. */
export function PostureScoreCard({ patientId, latest, t }: {
  patientId: string;
  latest: LatestPostureScore | undefined;
  t: Translations;
}) {
  const p = t.posture;
  const oc = p.overviewCard;
  const reportHref = latest && `/patients/${patientId}/posture/${latest.assessmentId}`;
  const { change, trend } = scoreTrend(latest?.score ?? null, latest?.previousScore ?? null);

  return (
    <Card className="rounded-2xl sm:col-span-2">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{p.title}</CardTitle>
        <Link href={`/patients/${patientId}/posture/new`} className="text-xs text-primary hover:underline">{p.add}</Link>
      </CardHeader>
      <CardContent className="text-sm">
        {!latest ? (
          <p className="text-muted-foreground">{oc.none}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: latest.score === null ? '#9ca3af' : scoreColor(latest.score) }}
            >
              {latest.score ?? '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {latest.grade ? p.insights.grades[latest.grade] : p.insights.notMeasured}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{formatFullDate(latest.assessedOn)}</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {trend && change !== null && latest.previousOn ? (
                  <>
                    <ScoreTrend change={change} trend={trend} label={oc.trend[trend]} compact />
                    <span>{oc.trend[trend]} {oc.since.replace('{date}', formatFullDate(latest.previousOn))}</span>
                  </>
                ) : latest.previousId === null ? (
                  <span>{oc.firstAssessment}</span>
                ) : null}
                <span>· {p.history.counts.replace('{marked}', String(latest.markedCount)).replace('{mild}', String(latest.mildCount))}</span>
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <Link href={reportHref!} className="text-primary hover:underline">{p.history.viewReport}</Link>
              {latest.previousId && (
                <Link
                  href={`/patients/${patientId}/posture/compare?a=${latest.previousId}&b=${latest.assessmentId}`}
                  className="text-primary hover:underline"
                >
                  {oc.compare}
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
