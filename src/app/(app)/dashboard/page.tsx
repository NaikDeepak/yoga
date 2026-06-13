import Link from 'next/link';
import { getDb } from '@/db/client';
import { getDashboardStats, getAilmentBreakdown, getRecentVisits } from '@/data/dashboard';
import { AilmentBarChart } from '@/components/AilmentBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function DashboardPage() {
  const db = getDb();
  const [stats, ailments, recentVisits] = await Promise.all([
    getDashboardStats(db),
    getAilmentBreakdown(db),
    getRecentVisits(db),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard / डॅशबोर्ड</h1>

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
