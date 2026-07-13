import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits, getPendingAssessments, getBirthdaysToday } from '@/data/dashboard';
import { getFollowUpsThisWeek, getISTDateString, type FollowUp } from '@/data/visits';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { WeeklyVisitsChart } from '@/components/WeeklyVisitsChart';
import { BranchFilter } from '@/components/BranchFilter';
import { RevenueStatCard } from '@/components/RevenueStatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BRANCHES, type BranchKey } from '@/lib/presets';
import { formatDueDate } from '@/lib/dates';
import { reminderUrl, digestUrl } from '@/lib/whatsapp';
import { ArrowUpRight, Cake, MessageCircle, Plus, UploadCloud } from 'lucide-react';
import { cookies } from 'next/headers';
import { getTranslations, type Translations, LOCALES, type Locale } from '@/lib/i18n/translations';
import { getUserLanguage, getWhatsappNumber } from '@/data/preferences';
import { CLINIC } from '@/lib/clinic';
import { requireUser } from '@/lib/auth';

const MONTHLY_TARGET = 100;

function parseBranch(value?: string): BranchKey | undefined {
  return BRANCHES.some((b) => b.key === value) ? (value as BranchKey) : undefined;
}

type AgendaRow =
  | { kind: 'header'; label: string }
  | { kind: 'item'; followUp: FollowUp };

function groupFollowUps(followUps: FollowUp[], t: Translations): AgendaRow[] {
  const today = getISTDateString(0);
  const tomorrow = getISTDateString(1);
  const rows: AgendaRow[] = [];
  let lastDate: string | null = null;
  for (const f of followUps) {
    if (f.nextVisitDate !== lastDate) {
      rows.push({ kind: 'header', label: dateHeaderLabel(f.nextVisitDate, today, tomorrow, t) });
      lastDate = f.nextVisitDate;
    }
    rows.push({ kind: 'item', followUp: f });
  }
  return rows;
}

function dateHeaderLabel(date: string, today: string, tomorrow: string, t: Translations): string {
  if (date === today) return t.dashboard.today;
  if (date === tomorrow) return t.dashboard.tomorrow;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = t.dashboard.weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const dateStr = formatDueDate(date);
  return `${weekday}, ${dateStr}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchParam } = await searchParams;
  const branch = parseBranch(branchParam);
  const db = getDb();
  const user = await requireUser();
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(langCookie ?? '')
    ? (langCookie as Locale)
    : await getUserLanguage(db, user.id);
  const t = getTranslations(locale);

  const [stats, ailments, recentVisits, rawFollowUps, pendingAssessments, birthdaysToday, savedWhatsappNumber] = await Promise.all([
    getDashboardStats(db, branch),
    getAilmentBreakdown(db, branch),
    getRecentVisits(db, 5, branch),
    getFollowUpsThisWeek(db, branch),
    getPendingAssessments(db, 5, branch),
    getBirthdaysToday(db, branch),
    getWhatsappNumber(db, user.id),
  ]);
  const digestTarget = savedWhatsappNumber ?? CLINIC.whatsappDigits;

  const followUps = rawFollowUps.map(f => ({
    ...f,
    nextVisitDate: typeof f.nextVisitDate === 'string' ? f.nextVisitDate.substring(0, 10) : ''
  })).filter(f => f.nextVisitDate !== '');

  // Generate upcoming visits for the next 8 days (today..+7) based on followUps
  // (next_visit_date) — this window must match getFollowUpsThisWeek's window so the
  // chart and the Reminders panel never disagree.
  const todayStr = getISTDateString(0);
  const tomorrowStr = getISTDateString(1);
  const tomorrowFollowUps = followUps.filter((f) => f.nextVisitDate === tomorrowStr);
  const upcomingVisitsData = Array.from({ length: 8 }, (_, i) => {
    const dateStr = getISTDateString(i);
    // Count how many follow-ups happen on this day, safely handling strings with time parts
    const count = followUps.filter(f => {
      const fDate = typeof f.nextVisitDate === 'string' ? f.nextVisitDate.substring(0, 10) : '';
      return fDate === dateStr;
    }).length;
    return { date: dateStr, count, isToday: dateStr === todayStr };
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.dashboard.subtitle}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-auto">
            <BranchFilter />
          </div>

          <Button className="rounded-full gap-2 px-5 h-10 shadow-md w-full sm:w-auto justify-center" asChild>
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              {t.dashboard.addPatient}
            </Link>
          </Button>
        </div>
      </div>

      {/* Birthday Alerts In-App Notification Banner */}
      {birthdaysToday.length > 0 && (
        <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-2xl p-5 flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 text-pink-700 rounded-full dark:text-pink-400">
              <Cake className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t.dashboard.birthdaysToday}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.dashboard.birthdayWishSubtext}
              </p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {birthdaysToday.map((patient) => (
              <li key={patient.id} className="bg-background/60 backdrop-blur-md rounded-xl p-3 border border-purple-500/10 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center text-pink-700 dark:text-pink-400 font-bold text-xs shrink-0">
                    {patient.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <Link href={`/patients/${patient.id}`} className="text-sm font-semibold truncate hover:text-primary transition-colors">
                      {patient.fullName}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate">
                        {patient.patientCode}
                      </span>
                      <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-4 border-none shadow-none leading-none flex items-center ${patient.isTomorrow ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-400' : 'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-400'}`}>
                        {patient.isTomorrow ? t.dashboard.tomorrow : t.dashboard.today}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-full h-8 px-3 text-xs border-pink-500/20 text-pink-700 hover:bg-pink-500/10 hover:text-pink-800 dark:text-pink-400 dark:border-pink-500/30">
                  <a href={birthdayWhatsappUrl(patient.mobile, patient.fullName, t)} target="_blank" rel="noopener noreferrer">
                    {t.dashboard.sendWish}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Primary Solid Green Card */}
        <Card className="rounded-2xl border-none bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-md relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-primary-foreground/90 truncate">{t.dashboard.totalPatients}</CardTitle>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-3xl sm:text-4xl font-bold tracking-tight truncate">{stats.totalPatients}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary-foreground/80 font-medium bg-black/10 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="h-3 w-3" />
              <span>{t.dashboard.increasedLastMonth}</span>
            </div>
          </CardContent>
          {/* Decorative shapes */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
        </Card>

        {/* Regular Stat Cards */}
        <StatCard
          title={t.dashboard.visitsThisMonth}
          value={String(stats.visitsThisMonth)}
          trend={t.dashboard.increasedLastMonth}
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        />

        <RevenueStatCard value={stats.revenueThisMonth} />

        <StatCard
          title={t.dashboard.mostCommonAilment}
          value={stats.mostCommonProblem ?? '—'}
          trend={t.dashboard.highFrequency}
        />
      </div>

      {/* Analytics & Reminders Row */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr_1fr]">
        <Card className="rounded-2xl shadow-sm border-border overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">{t.dashboard.weeklyVisits}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-2">
            <div className="h-[250px] w-full mt-4">
              <WeeklyVisitsChart data={upcomingVisitsData} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-xl font-semibold truncate">{t.dashboard.reminders}</CardTitle>
            {tomorrowFollowUps.length > 0 && (
              <Button asChild size="sm" variant="outline" className="rounded-full shrink-0 w-full sm:w-auto text-center justify-center">
                <a href={digestUrl(tomorrowFollowUps, tomorrowStr, digestTarget)} target="_blank" rel="noopener noreferrer">
                  {t.dashboard.whatsappDigest.replace('{count}', String(tomorrowFollowUps.length))}
                </a>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-accent/40 p-4 border border-border/50">
              <h4 className="font-semibold text-sm mb-1 text-foreground">{t.dashboard.followUpsThisWeek}</h4>
              <p className="text-xs text-muted-foreground mb-4">{t.dashboard.sendReminders}</p>
              {followUps.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">{t.dashboard.noFollowUps}</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {followUps.slice(0, 3).map((f) => (
                    <li key={f.patientId} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {f.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link href={`/patients/${f.patientId}`} className="text-sm font-semibold truncate hover:text-primary transition-colors">
                            {f.fullName}
                          </Link>
                          <span className="text-xs text-muted-foreground truncate">
                            {t.dashboard.due}: {formatDueDate(f.nextVisitDate)}
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" className="rounded-full h-8 shrink-0 shadow-sm" variant="default">
                        <a href={reminderUrl(f.mobile, f.fullName, f.nextVisitDate)} target="_blank" rel="noopener noreferrer">
                          {t.dashboard.sendMsg}
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {followUps.length > 3 && (
                <Button variant="link" size="sm" className="mt-2 w-full text-xs text-primary" asChild>
                  <Link href="/patients">{t.dashboard.viewAll.replace('{count}', String(followUps.length))}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Week's Schedule — full follow-up list grouped by day */}
        <Card className="rounded-2xl shadow-sm border-border flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold">{t.dashboard.weeksSchedule}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[340px] pr-1">
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t.dashboard.noVisitsThisWeek}</p>
            ) : (
              <ul className="space-y-1">
                {groupFollowUps(followUps, t).map((row, i) =>
                  row.kind === 'header' ? (
                    <li key={`h-${i}`} className="pt-3 first:pt-0 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</span>
                    </li>
                  ) : (
                    <li key={row.followUp.patientId + row.followUp.nextVisitDate} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40 transition-colors">
                      <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                        {row.followUp.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <Link href={`/patients/${row.followUp.patientId}`} className="text-sm font-medium truncate hover:text-primary transition-colors flex-1">
                        {row.followUp.fullName}
                      </Link>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDueDate(row.followUp.nextVisitDate)}</span>
                      <Button asChild size="icon" variant="ghost" className="h-6 w-6 shrink-0">
                        <a
                          href={reminderUrl(row.followUp.mobile, row.followUp.fullName, row.followUp.nextVisitDate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t.dashboard.sendMsg}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </li>
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Collaboration, Progress, Time Tracker */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Assessments */}
        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t.dashboard.pendingAssessments}</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t.dashboard.allAssessmentsComplete}</p>
            ) : (
              <ul className="space-y-4 mt-2">
                {pendingAssessments.map((p) => (
                  <li key={p.patientId} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {initials(p.fullName)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link href={`/patients/${p.patientId}?tab=${p.missingLifestyle ? 'assessment' : 'treatment'}`} className="text-sm font-medium truncate hover:text-primary transition-colors">
                        {p.fullName}
                      </Link>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {pendingReason(p.missingLifestyle, p.missingTreatment, t)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-yellow-100 text-yellow-800 border-none shadow-none shrink-0">{t.common.pending}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Ailment Breakdown (Replacing Donut Chart Placeholder) */}
        <Card className="rounded-2xl shadow-sm border-border flex flex-col justify-between">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold">{t.dashboard.ailmentBreakdown}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center pb-6 mt-4">
            {ailments.length > 0 ? (
              <div className="h-[220px] w-full">
                <AilmentBarChart data={ailments} />
              </div>
            ) : (
              <div className="flex h-[220px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                <p className="text-sm text-muted-foreground">{t.dashboard.noAilmentData}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Visit Goal */}
        <Card className="rounded-2xl shadow-sm border-border flex flex-col items-center justify-center">
          <CardHeader className="pb-0 w-full">
            <CardTitle className="text-base font-semibold">{t.dashboard.monthlyVisitGoal}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2 pb-4">
            <VisitGoalGauge
              current={stats.visitsThisMonth}
              target={MONTHLY_TARGET}
              ofGoal={t.dashboard.ofGoal}
              ariaLabel={t.dashboard.visitsThisMonthText
                .replace('{current}', String(stats.visitsThisMonth))
                .replace('{target}', String(MONTHLY_TARGET))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t.dashboard.visitsThisMonthText
                .replace('{current}', String(stats.visitsThisMonth))
                .replace('{target}', String(MONTHLY_TARGET))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Full Width */}
      <Card className="rounded-2xl shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">{t.dashboard.recentVisits}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t.dashboard.noVisitsYet}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">{t.dashboard.patientName}</th>
                    <th className="px-4 py-3">{t.dashboard.patientId}</th>
                    <th className="px-4 py-3">{t.dashboard.date}</th>
                    <th className="px-4 py-3">{t.dashboard.weight}</th>
                    <th className="px-4 py-3 rounded-tr-lg">{t.dashboard.painScale}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v, i) => (
                    <tr key={v.visitId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/patients/${v.patientId}`} className="hover:text-primary transition-colors">
                          {v.patientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-brand-accent/50 text-brand-accent bg-brand-accent/5 shadow-none">{v.patientCode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{v.visitDate}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.weightKg ? `${v.weightKg} kg` : '—'}</td>
                      <td className="px-4 py-3">
                        {v.painScale !== null ? (
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${painDotColor(v.painScale)}`} />
                            <span className="text-muted-foreground">{v.painScale}/10</span>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, trend, icon }: { title: string; value: string; trend?: string; icon?: React.ReactNode }) {
  return (
    <Card className="rounded-2xl shadow-sm border-border min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground truncate">{title}</CardTitle>
          {icon && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate" title={value}>{value}</p>
        {trend && (
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <span className="text-green-600 bg-green-100 dark:bg-green-900/30 px-1 rounded inline-flex items-center">
              <ArrowUpRight className="h-3 w-3" />
            </span>
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function painDotColor(scale: number) {
  if (scale <= 3) return 'bg-primary';
  if (scale <= 6) return 'bg-yellow-500';
  return 'bg-destructive';
}

const ARC_LENGTH = Math.PI * 80; // semicircle r=80

function VisitGoalGauge({ current, target, ofGoal, ariaLabel }: { current: number; target: number; ofGoal: string; ariaLabel: string }) {
  const pct = Math.min(current / target, 1);
  const filled = ARC_LENGTH * pct;
  const gaugeColor = pct >= 1 ? '#16a34a' : pct >= 0.5 ? '#16a34a' : '#ca8a04';
  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[200px]" aria-label={ariaLabel}>
      {/* Track */}
      <path d="M 20 105 A 80 80 0 0 1 180 105" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="14" strokeLinecap="round" />
      {/* Progress */}
      <path
        d="M 20 105 A 80 80 0 0 1 180 105"
        fill="none"
        stroke={gaugeColor}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${ARC_LENGTH}`}
      />
      {/* Count */}
      <text x="100" y="82" textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor">{current}</text>
      <text x="100" y="100" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.5">{Math.round(pct * 100)}{ofGoal}</text>
    </svg>
  );
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pendingReason(missingLifestyle: boolean, missingTreatment: boolean, t: Translations): string {
  if (missingLifestyle && missingTreatment) return t.dashboard.pendingReason.both;
  if (missingLifestyle) return t.dashboard.pendingReason.lifestyle;
  return t.dashboard.pendingReason.treatment;
}

function birthdayWhatsappUrl(mobile: string, fullName: string, t: Translations): string {
  const text = t.dashboard.birthdayWishMsg.replaceAll('{name}', fullName);
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
}
