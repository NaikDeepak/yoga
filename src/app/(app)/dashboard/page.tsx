import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { getFollowUpsThisWeek } from '@/data/visits';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function DashboardPage() {
  const db = getDb();
  const [stats, ailments, recentVisits, followUps] = await Promise.all([
    getDashboardStats(db),
    getAilmentBreakdown(db),
    getRecentVisits(db),
    getFollowUpsThisWeek(db),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard / डॅशबोर्ड</h1>

      {/* Follow-ups card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-ups This Week / या आठवड्यातील पाठपुरावा</CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No follow-ups in the next 7 days / या आठवड्यात कोणी नाही
            </p>
          ) : (
            <ul className="space-y-3">
              {followUps.map((f) => (
                <li
                  key={f.patientId}
                  className="flex items-center justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/patients/${f.patientId}`} className="font-medium hover:text-primary">
                      {f.fullName}
                    </Link>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${f.mobile}`} className="text-xs text-muted-foreground hover:text-primary">
                        {f.mobile}
                      </a>
                      <a
                        href={whatsappUrl(f.mobile, f.fullName, f.nextVisitDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send WhatsApp reminder / WhatsApp आठवण पाठवा"
                        className="text-green-600 hover:text-green-700"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-brand-accent text-brand-accent text-xs">
                      {f.patientCode}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      Due / देय: {formatDueDate(f.nextVisitDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Stat cards — 2-col on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Patients / रुग्ण"
          value={String(stats.totalPatients)}
        />
        <StatCard
          title="Visits This Month / भेटी"
          value={String(stats.visitsThisMonth)}
        />
        <StatCard
          title="Most Common / सामान्य आजार"
          value={stats.mostCommonProblem ?? '—'}
        />
        <StatCard
          title="Avg Pain / वेदना"
          value={stats.avgPainThisMonth !== null ? String(stats.avgPainThisMonth) : '—'}
        />
      </div>

      {/* Ailment chart + Recent activity side-by-side on md+ */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ailment Breakdown / आजार</CardTitle>
          </CardHeader>
          <CardContent>
            {ailments.length > 0 ? (
              <AilmentBarChart data={ailments} />
            ) : (
              <p className="text-sm text-muted-foreground">No data yet / माहिती नाही</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity / अलीकडील</CardTitle>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet / भेटी नाहीत</p>
            ) : (
              <ul className="space-y-3">
                {recentVisits.map((v) => (
                  <li
                    key={v.visitId}
                    className="flex items-start justify-between gap-2 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/patients/${v.patientId}`}
                        className="font-medium hover:text-primary"
                      >
                        {v.patientName}
                      </Link>
                      <span className="text-xs text-muted-foreground">{v.visitDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-brand-accent text-brand-accent text-xs"
                      >
                        {v.patientCode}
                      </Badge>
                      {v.weightKg !== null && (
                        <span className="text-xs text-muted-foreground">{v.weightKg}kg</span>
                      )}
                      {v.painScale !== null && (
                        <span
                          className={`h-3 w-3 rounded-full ${painDotColor(v.painScale)}`}
                          title={`Pain: ${v.painScale} / वेदना: ${v.painScale}`}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
