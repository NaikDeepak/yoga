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
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

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
  const db = getDb();
  const t = getTranslations(await getLocale());

  const totalCount = await countPatients(db, undefined, q);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const clampedPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const offset = (clampedPage - 1) * PAGE_SIZE;

  const list = await searchPatients(db, q, PAGE_SIZE, offset);

  const [problems, completions] = await Promise.all([
    problemsForPatients(db, list.map((p) => p.id)),
    assessmentCompletionForPatients(db, list.map((p) => p.id)),
  ]);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={t.patients.title}
        subtitle={t.patients.registered.replace('{count}', String(totalCount))}
        actions={
          <Button asChild className="rounded-full gap-2 px-5 h-10 shadow-md">
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              {t.patients.newPatient}
            </Link>
          </Button>
        }
      />

      <form method="get" className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            aria-label={t.patients.searchPlaceholder}
            defaultValue={q ?? ''}
            placeholder={t.patients.searchPlaceholder}
            className="pl-9 rounded-full"
          />
        </div>
        <Button type="submit" variant="outline" className="rounded-full px-5 shrink-0">
          {t.common.search}
        </Button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          message={t.patients.notFound}
          action={
            !q
              ? { label: t.patients.registerFirst, href: '/patients/new' }
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
            page={clampedPage}
            totalPages={totalPages}
            buildHref={(p) =>
              q ? `/patients?q=${encodeURIComponent(q)}&page=${p}` : `/patients?page=${p}`
            }
          />
        </>
      )}
    </div>
  );
}
