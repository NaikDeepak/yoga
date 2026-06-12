import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';

export default function NewPatientPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New Patient / नवीन रुग्ण नोंदणी</h1>
      <PatientForm action={createPatientAction} submitLabel="Register / नोंदणी करा" />
    </div>
  );
}
