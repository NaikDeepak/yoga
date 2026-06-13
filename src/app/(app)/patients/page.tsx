import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import { getDb } from '@/db/client';
import { searchPatients } from '@/data/patients';
import { problemsForPatients } from '@/data/problems';
import { assessmentCompletionForPatients } from '@/data/lifestyle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = getDb();
  const list = await searchPatients(db, q);
  const [problems, completions] = await Promise.all([
    problemsForPatients(db, list.map((p) => p.id)),
    assessmentCompletionForPatients(db, list.map((p) => p.id)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Patients / रुग्ण</h1>
          <p className="text-sm text-muted-foreground">{list.length} registered</p>
        </div>
        <Button asChild>
          <Link href="/patients/new">+ New Patient / नवीन रुग्ण</Link>
        </Button>
      </div>

      <form method="get">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            name="q"
            aria-label="Search patients"
            defaultValue={q ?? ''}
            placeholder="Search name or mobile / नाव किंवा मोबाईल"
            className="pl-9"
          />
        </div>
      </form>

      <div className="space-y-2">
        {list.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No patients found / रुग्ण सापडले नाहीत</p>
            <Button asChild className="mt-4">
              <Link href="/patients/new">Register first patient / पहिला रुग्ण नोंदवा</Link>
            </Button>
          </Card>
        )}
        {list.map((p) => {
          const pts = problems[p.id] ?? [];
          const visible = pts.slice(0, 3);
          const overflow = pts.length - visible.length;
          const filled = completions[p.id] ?? 0;
          const completion = filled === 5
            ? { text: 'Assessment ✓', cls: 'bg-primary/10 text-primary' }
            : filled > 0
              ? { text: `Assessment ${filled}/5`, cls: 'bg-yellow-100 text-yellow-800' }
              : { text: 'Assessment —', cls: 'bg-muted text-muted-foreground' };
          return (
            <Link key={p.id} href={`/patients/${p.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.fullName}</span>
                    <Badge variant="outline" className="border-brand-accent text-brand-accent">
                      {p.patientCode}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">{p.mobile}</span>
                    {visible.map((pr) => (
                      <Badge
                        key={pr.id}
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {pr.problem}
                      </Badge>
                    ))}
                    {overflow > 0 && (
                      <span className="text-xs text-muted-foreground">+{overflow} more</span>
                    )}
                    <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${completion.cls}`}>
                      {completion.text}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
