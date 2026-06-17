import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { updatePatientAction } from '@/actions/patients';
import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

export default async function EditPatientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  const update = updatePatientAction.bind(null, id);
  const t = getTranslations(await getLocale());
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={t.patientDetail.editTitle}
        subtitle={`${patient.fullName} · ${patient.patientCode}`}
      />
      <PatientForm action={update} defaultValues={patient} submitLabel={t.common.save} />
    </div>
  );
}
