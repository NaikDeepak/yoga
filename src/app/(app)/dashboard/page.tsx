import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { getFollowUpsThisWeek, getISTDateString, type FollowUp } from '@/data/visits';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { WeeklyVisitsChart } from '@/components/WeeklyVisitsChart';
import { BranchFilter } from '@/components/BranchFilter';
import { RevenueStatCard } from '@/components/RevenueStatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BRANCHES, type BranchKey } from '@/lib/presets';
import { ArrowUpRight, Plus, UploadCloud, PieChart, Users, Clock, PlayCircle } from 'lucide-react';

function parseBranch(value?: string): BranchKey | undefined {
  return BRANCHES.some((b) => b.key === value) ? (value as BranchKey) : undefined;
}

type AgendaRow =
  | { kind: 'header'; label: string }
  | { kind: 'item'; followUp: FollowUp };

function groupFollowUps(followUps: FollowUp[]): AgendaRow[] {
  const today = getISTDateString(0);
  const tomorrow = getISTDateString(1);
  const rows: AgendaRow[] = [];
  let lastDate: string | null = null;
  for (const f of followUps) {
    if (f.nextVisitDate !== lastDate) {
      rows.push({ kind: 'header', label: dateHeaderLabel(f.nextVisitDate, today, tomorrow) });
      lastDate = f.nextVisitDate;
    }
    rows.push({ kind: 'item', followUp: f });
  }
  return rows;
}

const WEEKDAYS: [string, string][] = [
  ['Sun', 'रवि'], ['Mon', 'सोम'], ['Tue', 'मंगळ'], ['Wed', 'बुध'],
  ['Thu', 'गुरु'], ['Fri', 'शुक्र'], ['Sat', 'शनि'],
];

function dateHeaderLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'Today / आज';
  if (date === tomorrow) return 'Tomorrow / उद्या';
  const [year, month, day] = date.split('-').map(Number);
  const [enWeekday, mrWeekday] = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const dateStr = formatDueDate(date);
  return `${enWeekday}, ${dateStr} / ${mrWeekday}, ${dateStr}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchParam } = await searchParams;
  const branch = parseBranch(branchParam);

  const db = getDb();
  const [stats, ailments, recentVisits, followUps] = await Promise.all([
    getDashboardStats(db, branch),
    getAilmentBreakdown(db, branch),
    getRecentVisits(db, 5, branch),
    getFollowUpsThisWeek(db, branch),
  ]);

  // Generate upcoming visits for the next 8 days (today..+7) based on followUps
  // (next_visit_date) — this window must match getFollowUpsThisWeek's window so the
  // chart and the Reminders panel never disagree.
  const todayStr = getISTDateString(0);
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your clinic, patients, and tasks with ease.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BranchFilter />
          <Button variant="outline" className="rounded-full gap-2 px-5 h-10 border-border" asChild>
            <Link href="#">
              <UploadCloud className="h-4 w-4" />
              Import Data
            </Link>
          </Button>
          <Button className="rounded-full gap-2 px-5 h-10 shadow-md" asChild>
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              Add Patient
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Primary Solid Green Card */}
        <Card className="rounded-2xl border-none bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-md relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-primary-foreground/90">Total Patients</CardTitle>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-4xl font-bold tracking-tight">{stats.totalPatients}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary-foreground/80 font-medium bg-black/10 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="h-3 w-3" />
              <span>Increased from last month</span>
            </div>
          </CardContent>
          {/* Decorative shapes */}
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
        </Card>

        {/* Regular Stat Cards */}
        <StatCard
          title="Visits This Month"
          value={String(stats.visitsThisMonth)}
          trend="Increased from last month"
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        />
        
        <RevenueStatCard value={stats.revenueThisMonth} />

        <StatCard
          title="Most Common Ailment"
          value={stats.mostCommonProblem ?? '—'}
          trend="High frequency"
        />
      </div>

      {/* Analytics & Reminders Row */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-2xl shadow-sm border-border overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Weekly Patient Visits</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-2">
            <div className="h-[250px] w-full mt-4">
              <WeeklyVisitsChart data={upcomingVisitsData} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-accent/40 p-4 border border-border/50">
              <h4 className="font-semibold text-sm mb-1 text-foreground">Follow-ups This Week</h4>
              <p className="text-xs text-muted-foreground mb-4">Send reminders to patients</p>
              
              {followUps.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No follow-ups / या आठवड्यात कोणी नाही</p>
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
                            Due: {formatDueDate(f.nextVisitDate)}
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" className="rounded-full h-8 shrink-0 shadow-sm" variant="default">
                        <a href={whatsappUrl(f.mobile, f.fullName, f.nextVisitDate)} target="_blank" rel="noopener noreferrer">
                          Send Msg
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {followUps.length > 3 && (
                <Button variant="link" size="sm" className="mt-2 w-full text-xs text-primary" asChild>
                  <Link href="/patients">View all {followUps.length} follow-ups</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Collaboration, Progress, Time Tracker */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Assessments (Replacing Team Collaboration) */}
        <Card className="rounded-2xl shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Pending Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 mt-2">
              {/* Placeholders representing patients needing assessment */}
              <li className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">RJ</div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Rahul Jadhav</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Lifestyle missing</span>
                </div>
                <Badge variant="secondary" className="ml-auto text-[10px] bg-yellow-100 text-yellow-800 border-none shadow-none">Pending</Badge>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-xs">SK</div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Sneha Kulkarni</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Diet plan missing</span>
                </div>
                <Badge variant="secondary" className="ml-auto text-[10px] bg-yellow-100 text-yellow-800 border-none shadow-none">Pending</Badge>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs">AM</div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Amit Mishra</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ready for review</span>
                </div>
                <Badge variant="secondary" className="ml-auto text-[10px] bg-green-100 text-green-800 border-none shadow-none">Completed</Badge>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Ailment Breakdown (Replacing Donut Chart Placeholder) */}
        <Card className="rounded-2xl shadow-sm border-border flex flex-col justify-between">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold">Ailment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center pb-6 mt-4">
            {ailments.length > 0 ? (
              <div className="h-[220px] w-full">
                <AilmentBarChart data={ailments} />
              </div>
            ) : (
              <div className="flex h-[220px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                <p className="text-sm text-muted-foreground">No ailment data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Tracker / Today Overview */}
        <Card className="rounded-2xl border-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-primary text-primary-foreground shadow-lg overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 to-green-950/90 z-0"></div>
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Today&apos;s Overview</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 flex flex-col justify-between h-[calc(100%-60px)]">
            <div className="text-center py-4">
              <div className="text-5xl font-bold tracking-wider tabular-nums">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
              <p className="text-sm mt-2 text-primary-foreground/70 font-medium tracking-wide">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-4 mt-auto pb-2">
              <Button size="icon" className="h-12 w-12 rounded-full bg-white text-primary hover:bg-white/90 shadow-md">
                <PlayCircle className="h-6 w-6" />
              </Button>
              <Button size="icon" className="h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-none">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Activity Full Width */}
      <Card className="rounded-2xl shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Visits</CardTitle>
        </CardHeader>
        <CardContent>
          {recentVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No visits yet / भेटी नाहीत</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Patient Name</th>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Weight</th>
                    <th className="px-4 py-3 rounded-tr-lg">Pain Scale</th>
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
    <Card className="rounded-2xl shadow-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {icon && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
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

function formatDueDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(day).padStart(2, '0')} ${months[month - 1]}`;
}

function whatsappUrl(mobile: string, fullName: string, nextVisitDate: string): string {
  const date = formatDueDate(nextVisitDate);
  const text = `Hello ${fullName}, a reminder from Pawar's Yog Therapy — your next session is on ${date}. / नमस्कार ${fullName}, आपल्या पुढील योग थेरपी भेटीची आठवण — ${date} रोजी आहे.`;
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
}
