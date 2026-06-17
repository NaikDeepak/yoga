import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { updatePatientAction } from '@/actions/patients';
import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';

export default async function EditPatientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  const update = updatePatientAction.bind(null, id);
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Edit Patient / माहिती बदला"
        subtitle={`${patient.fullName} — ${patient.patientCode}`}
      />
      <PatientForm action={update} defaultValues={patient} submitLabel="Save / जतन करा" />
    </div>
  );
}
