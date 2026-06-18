import { getDb } from '@/db/client';
import { getFollowUpsInRange, getISTDateString, type FollowUp } from '@/data/visits';
import { CalendarMonthGrid } from '@/components/CalendarMonthGrid';
import { BranchFilter } from '@/components/BranchFilter';
import { BRANCHES, type BranchKey } from '@/lib/presets';
import { cookies } from 'next/headers';
import { getTranslations, LOCALES, type Locale } from '@/lib/i18n/translations';
import { getUserLanguage } from '@/data/preferences';
import { requireUser } from '@/lib/auth';

function parseBranch(value?: string): BranchKey | undefined {
  return BRANCHES.some((b) => b.key === value) ? (value as BranchKey) : undefined;
}

function parseMonth(value?: string): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = getISTDateString(0).split('-').map(Number);
  return { year, month };
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; month?: string }>;
}) {
  const { branch: branchParam, month: monthParam } = await searchParams;
  const branch = parseBranch(branchParam);
  const { year, month } = parseMonth(monthParam);
  const { start, end } = monthRange(year, month);

  const db = getDb();
  const user = await requireUser();
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(langCookie ?? '')
    ? (langCookie as Locale)
    : await getUserLanguage(db, user.id);
  const t = getTranslations(locale);

  const followUps = await getFollowUpsInRange(db, start, end, branch);

  const followUpsByDate: Record<string, FollowUp[]> = {};
  for (const f of followUps) {
    (followUpsByDate[f.nextVisitDate] ??= []).push(f);
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t.calendar.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.calendar.subtitle}</p>
        </div>
        <BranchFilter />
      </div>

      <CalendarMonthGrid
        year={year}
        month={month}
        todayISO={getISTDateString(0)}
        followUpsByDate={followUpsByDate}
      />
    </div>
  );
}
