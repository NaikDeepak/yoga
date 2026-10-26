import { notFound } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/features';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { PostureCapture } from '@/components/posture/PostureCapture';

export default async function NewPostureAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isFeatureEnabled('posture')) notFound();
  const { id } = await params;
  const patient = await getPatient(getDb(), id);
  if (!patient) notFound();
  return <PostureCapture patientId={id} patientName={`${patient.fullName} · ${patient.patientCode}`} />;
}
