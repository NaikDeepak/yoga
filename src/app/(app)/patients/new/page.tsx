import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';

export default function NewPatientPage() {
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="New Patient / नवीन रुग्ण"
        subtitle="Register a new patient / नवीन रुग्ण नोंदवा"
      />
      <PatientForm action={createPatientAction} submitLabel="Register / नोंदणी करा" />
    </div>
  );
}
