import { getDb } from '@/db/client';
import { listCaptureStats } from '@/data/capture-stats';
import { summariseCaptureStats } from '@/lib/capture-stats';
import { getISTDateString } from '@/lib/dates';
import { requireUser } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { PageHeader } from '@/components/PageHeader';
import { CaptureStatsTable } from '@/components/CaptureStatsTable';

const DAYS = 30;

/** Settings → Posture capture health (backlog E4): last 30 days of capture counters. */
export default async function CaptureStatsPage() {
  await requireUser();
  const t = getTranslations(await getLocale());
  const rows = await listCaptureStats(getDb(), getISTDateString(-(DAYS - 1)));
  return (
    <div className="space-y-8 pb-10">
      <PageHeader title={t.settings.captureStats.title} subtitle={t.settings.captureStats.description} />
      <CaptureStatsTable summary={summariseCaptureStats(rows)} t={t} />
    </div>
  );
}
