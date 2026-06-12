import Link from 'next/link';
import { getDb } from '@/db/client';
import { searchPatients } from '@/data/patients';
import { problemsForPatients } from '@/data/problems';

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = getDb();
  const list = await searchPatients(db, q);
  const problems = await problemsForPatients(db, list.map((p) => p.id));
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <form className="flex-1">
          <input name="q" defaultValue={q ?? ''} placeholder="Search name or mobile / नाव किंवा मोबाईल शोधा"
            className="w-full max-w-md rounded border border-stone-300 p-2" />
        </form>
        <Link href="/patients/new"
          className="rounded bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
          + New Patient / नवीन रुग्ण
        </Link>
      </div>
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {list.length === 0 && <li className="p-4 text-stone-500">No patients found / रुग्ण सापडले नाहीत</li>}
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/patients/${p.id}`} className="block p-4 hover:bg-stone-50">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{p.fullName}</span>
                <span className="text-sm text-stone-500">{p.patientCode}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                <span>{p.mobile}</span>
                {(problems[p.id] ?? []).map((pr) => (
                  <span key={pr.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    {pr.problem}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
