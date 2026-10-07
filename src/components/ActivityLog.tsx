import Link from 'next/link';
import type { AuditRow } from '@/db/schema';
import type { Translations } from '@/lib/i18n/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const IST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Audit log table (spec 2026-10-07-audit-log): newest first; clients by code only. */
export function ActivityLog({ rows, olderHref, t }: { rows: AuditRow[]; olderHref: string | null; t: Translations }) {
  const a = t.settings.activity;
  const label = (action: string) => (a.actions as Record<string, string>)[action] ?? action;
  return (
    <Card className="rounded-2xl shadow-sm border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{a.title}</CardTitle>
        <CardDescription>{a.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{a.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{a.columns.when}</th>
                  <th className="py-2 pr-3 font-medium">{a.columns.who}</th>
                  <th className="py-2 pr-3 font-medium">{a.columns.what}</th>
                  <th className="py-2 pr-3 font-medium">{a.columns.client}</th>
                  <th className="py-2 font-medium">{a.columns.detail}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">{IST.format(r.at)}</td>
                    <td className="py-2 pr-3">{r.actorEmail ?? r.actorId}</td>
                    <td className="py-2 pr-3 font-medium">{label(r.action)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.clientCode ?? '—'}</td>
                    <td className="py-2 text-muted-foreground">{r.summary ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {olderHref && <Link href={olderHref} className="mt-4 inline-block text-sm text-primary hover:underline">{a.older} →</Link>}
      </CardContent>
    </Card>
  );
}
