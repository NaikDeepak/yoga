import { getDb } from '@/db/client';
import { listAudit } from '@/data/audit';
import { requireUser } from '@/lib/auth';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { PageHeader } from '@/components/PageHeader';
import { ActivityLog } from '@/components/ActivityLog';

const PAGE = 50;

/** Settings → Activity log: who changed, deleted or exported what (newest first, 50 per page). */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await requireUser();
  const t = getTranslations(await getLocale());
  const { before } = await searchParams;
  const valid = before && /^[0-9a-f-]{36}$/i.test(before) ? before : undefined;
  const rows = await listAudit(getDb(), { limit: PAGE, before: valid });
  return (
    <div className="space-y-8 pb-10">
      <PageHeader title={t.settings.activity.title} subtitle={t.settings.title} />
      <ActivityLog rows={rows} olderHref={rows.length === PAGE ? `/settings/activity?before=${rows.at(-1)!.id}` : null} t={t} />
    </div>
  );
}
