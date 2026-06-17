import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { countPatients } from '@/data/patients';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, patientCount] = await Promise.all([
    requireUser(),
    countPatients(getDb()),
  ]);
  return (
    <AppShell userEmail={user.email ?? null} patientCount={patientCount}>
      {children}
    </AppShell>
  );
}
