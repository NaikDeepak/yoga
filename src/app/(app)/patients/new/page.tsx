import { PageHeader } from '@/components/PageHeader';
import { PatientForm } from '@/components/PatientForm';
import { createPatientAction } from '@/actions/patients';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

export default async function NewPatientPage() {
  const t = getTranslations(await getLocale());
  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={t.patients.newPatientTitle}
        subtitle={t.patients.newPatientSubtitle}
      />
      <PatientForm action={createPatientAction} submitLabel={t.patients.newPatient} />
    </div>
  );
}
