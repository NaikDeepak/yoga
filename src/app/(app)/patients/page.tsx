import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { getDb } from '@/db/client';
import { searchPatients, countPatients } from '@/data/patients';
import { problemsForPatients } from '@/data/problems';
import { assessmentCompletionForPatients } from '@/data/lifestyle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { PatientCard } from '@/components/PatientCard';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 12;

function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: rawPage } = await searchParams;
  const page = parsePage(rawPage);
  const offset = (page - 1) * PAGE_SIZE;
  const db = getDb();

  const [list, totalCount] = await Promise.all([
    searchPatients(db, q, PAGE_SIZE, offset),
    countPatients(db, undefined, q),
  ]);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const [problems, completions] = await Promise.all([
    problemsForPatients(db, list.map((p) => p.id)),
    assessmentCompletionForPatients(db, list.map((p) => p.id)),
  ]);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Patients / रुग्ण"
        subtitle={`${totalCount} registered`}
        actions={
          <Button asChild className="rounded-full gap-2 px-5 h-10 shadow-md">
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              New Patient / नवीन रुग्ण
            </Link>
          </Button>
        }
      />

      <form method="get">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            aria-label="Search patients"
            defaultValue={q ?? ''}
            placeholder="Search name or mobile / नाव किंवा मोबाईल"
            className="pl-9 rounded-full"
          />
        </div>
      </form>

      {list.length === 0 ? (
        <EmptyState
          message="No patients found / रुग्ण सापडले नाहीत"
          action={
            !q
              ? { label: 'Register first patient / पहिला रुग्ण नोंदवा', href: '/patients/new' }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const pts = (problems[p.id] ?? []).map((pr) => pr.problem);
              const filled = completions[p.id] ?? 0;
              return (
                <PatientCard
                  key={p.id}
                  id={p.id}
                  fullName={p.fullName}
                  patientCode={p.patientCode}
                  mobile={p.mobile}
                  problems={pts}
                  completionStatus={{ filled, total: 5 }}
                />
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) =>
              `/patients?q=${encodeURIComponent(q ?? '')}&page=${p}`
            }
          />
        </>
      )}
    </div>
  );
}
