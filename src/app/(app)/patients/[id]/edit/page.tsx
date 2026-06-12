import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { updatePatientAction } from '@/actions/patients';
import { PatientForm } from '@/components/PatientForm';

export default async function EditPatientPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  const update = updatePatientAction.bind(null, id);
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Edit Patient / माहिती बदला — {patient.fullName}</h1>
      <PatientForm action={update} defaultValues={patient} submitLabel="Save / जतन करा" />
    </div>
  );
}
