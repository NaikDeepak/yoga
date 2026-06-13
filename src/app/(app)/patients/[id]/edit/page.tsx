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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Patient / माहिती बदला</h1>
        <p className="text-sm text-muted-foreground">{patient.fullName} — {patient.patientCode}</p>
      </div>
      <PatientForm action={update} defaultValues={patient} submitLabel="Save / जतन करा" />
    </div>
  );
}
