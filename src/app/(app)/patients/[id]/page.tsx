import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { addVisitAction } from '@/actions/visits';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';

const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
] as const;
type Tab = (typeof TABS)[number][0];

const field = 'mt-1 w-full rounded border border-stone-300 p-2';
const btn = 'rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800';

export default async function PatientPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tab = ((await searchParams).tab ?? 'overview') as Tab;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {patient.fullName} <span className="text-sm font-normal text-stone-500">{patient.patientCode}</span>
        </h1>
        <div className="flex gap-3">
          <Link href={`/patients/${id}/edit`} className="text-sm text-emerald-700 hover:underline">Edit / बदला</Link>
          <Link href={`/patients/${id}/print`} className="text-sm text-emerald-700 hover:underline">
            Download PDF / प्रिंट
          </Link>
        </div>
      </div>
      <nav className="mb-4 flex gap-1 border-b border-stone-200">
        {TABS.map(([key, title]) => (
          <Link key={key} href={`/patients/${id}?tab=${key}`}
            className={`rounded-t px-3 py-2 text-sm ${tab === key
              ? 'border border-b-0 border-stone-200 bg-white font-medium'
              : 'text-stone-500 hover:text-stone-800'}`}>
            {title}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
    </div>
  );
}

async function Overview({ patient }: { patient: NonNullable<Awaited<ReturnType<typeof getPatient>>> }) {
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const photoUrl = patient.photoPath ? await getStorage().createSignedUrl(patient.photoPath) : null;
  const rows: [string, string | number | null][] = [
    ['Age / वय', patient.age], ['Gender / लिंग', patient.gender],
    ['Weight / वजन (kg)', patient.weightKg], ['Height / उंची (cm)', patient.heightCm],
    ['BMI', bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : null],
    ['Mobile / मोबाईल', patient.mobile], ['Email / ईमेल', patient.email],
    ['Occupation / व्यवसाय', patient.occupation],
    ['Emergency / आपत्कालीन', patient.emergencyContact],
    ['Address / पत्ता', patient.address],
  ];
  return (
    <div className="flex flex-wrap gap-6">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={patient.fullName} className="h-32 w-32 rounded-lg object-cover" />
      )}
      <dl className="grid flex-1 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-stone-100 py-1 text-sm">
            <dt className="text-stone-500">{k}</dt>
            <dd className="text-right">{v ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function Problems({ patientId }: { patientId: string }) {
  const problems = await listProblems(getDb(), patientId);
  const add = addProblemAction.bind(null, patientId);
  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {problems.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded border border-stone-200 bg-white p-3">
            <span>
              {p.problem}
              {p.note && <span className="ml-2 text-sm text-stone-500">({p.note})</span>}
            </span>
            <DeleteButton
              action={removeProblemAction.bind(null, patientId, p.id)}
              confirmText={`Remove ${p.problem}?`} label="Remove / काढा" />
          </li>
        ))}
        {problems.length === 0 && <li className="text-sm text-stone-500">No problems recorded / नोंद नाही</li>}
      </ul>
      <InlineForm action={add} className="space-y-2 rounded border border-stone-200 bg-white p-3">
        <label className="block text-sm">Preset / आजार निवडा
          <select name="problem" className={field}>
            {PRESET_PROBLEMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block text-sm">Note / टीप
          <input name="note" className={field} />
        </label>
        <button className={btn}>Add / जोडा</button>
      </InlineForm>
      <InlineForm action={add} className="space-y-2 rounded border border-stone-200 bg-white p-3">
        <input type="hidden" name="isCustom" value="true" />
        <label className="block text-sm">Other problem / इतर आजार
          <input name="problem" className={field} placeholder="Type custom problem / आजार लिहा" />
        </label>
        <button className={btn}>Add custom / इतर जोडा</button>
      </InlineForm>
    </div>
  );
}

async function Documents({ patientId }: { patientId: string }) {
  const docs = await listDocuments(getDb(), patientId);
  const storage = getStorage();
  const withUrls = await Promise.all(
    docs.map(async (d) => ({ ...d, url: await storage.createSignedUrl(d.filePath) })),
  );
  return (
    <div className="max-w-2xl space-y-4">
      <InlineForm action={uploadDocumentAction.bind(null, patientId)}
        className="flex flex-wrap items-end gap-3 rounded border border-stone-200 bg-white p-3">
        <label className="block text-sm">Type / प्रकार
          <select name="docType" className={field}>
            {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">File (PDF/JPG/PNG, max 10MB)
          <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" className={field} />
        </label>
        <button className={btn}>Upload / अपलोड</button>
      </InlineForm>
      <ul className="divide-y divide-stone-100 rounded border border-stone-200 bg-white">
        {withUrls.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div>
              <span className="mr-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">{d.docType}</span>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                {d.originalName}
              </a>
              <span className="ml-2 text-stone-400">{new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
            </div>
            <DeleteButton action={deleteDocumentAction.bind(null, patientId, d.id)}
              confirmText={`Delete ${d.originalName}?`} />
          </li>
        ))}
        {docs.length === 0 && <li className="p-3 text-sm text-stone-500">No documents / कागदपत्रे नाहीत</li>}
      </ul>
    </div>
  );
}

async function Treatment({ patientId }: { patientId: string }) {
  const db = getDb();
  const plan = await getTreatmentPlan(db, patientId);
  const visits = await listVisits(db, patientId);
  const planFields: [keyof NonNullable<typeof plan> & string, string][] = [
    ['yogaProgram', 'Yoga Program / योग कार्यक्रम'], ['pranayam', 'Pranayam / प्राणायाम'],
    ['massage', 'Massage / मसाज'], ['yogaTherapy', 'Yoga Therapy / योग थेरपी'],
    ['dietPlan', 'Diet Plan / आहार योजना'], ['medicines', 'Medicines / औषधे'],
    ['panchkarma', 'Panchkarma / पंचकर्म'],
  ];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InlineForm action={saveTreatmentPlanAction.bind(null, patientId)}
        className="space-y-3 rounded border border-stone-200 bg-white p-4">
        <h2 className="font-medium">Treatment Plan / उपचार योजना</h2>
        {planFields.map(([name, title]) => (
          <label key={name} className="block text-sm">{title}
            <textarea name={name} rows={2} defaultValue={(plan?.[name] as string | null) ?? ''} className={field} />
          </label>
        ))}
        <button className={btn}>Save plan / योजना जतन करा</button>
      </InlineForm>
      <div className="space-y-4">
        <InlineForm action={addVisitAction.bind(null, patientId)}
          className="space-y-3 rounded border border-stone-200 bg-white p-4">
          <h2 className="font-medium">Add Visit / नवीन भेट</h2>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">Date / तारीख
              <input name="visitDate" type="date" defaultValue={today} className={field} />
            </label>
            <label className="block text-sm">Weight (kg)
              <input name="weightKg" type="number" step="0.1" className={field} />
            </label>
            <label className="block text-sm">Pain (1–10)
              <input name="painScale" type="number" min="1" max="10" className={field} />
            </label>
          </div>
          <label className="block text-sm">Progress note / प्रगती नोंद
            <textarea name="progressNote" rows={2} className={field} />
          </label>
          <button className={btn}>Add visit / भेट जोडा</button>
        </InlineForm>
        <ul className="space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>{v.visitDate}</span>
                <span>
                  {v.weightKg != null && `${v.weightKg} kg `}
                  {v.painScale != null && `· pain ${v.painScale}/10`}
                </span>
              </div>
              <p className="mt-1">{v.progressNote}</p>
            </li>
          ))}
          {visits.length === 0 && <li className="text-sm text-stone-500">No visits yet / भेटी नाहीत</li>}
        </ul>
      </div>
    </div>
  );
}
