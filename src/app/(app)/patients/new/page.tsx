import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';

export default function NewPatientPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Patient / नवीन रुग्ण नोंदणी</h1>
        <p className="text-sm text-muted-foreground">Fill in the details below to register a new patient.</p>
      </div>
      <PatientForm action={createPatientAction} submitLabel="Register / नोंदणी करा" />
    </div>
  );
}
