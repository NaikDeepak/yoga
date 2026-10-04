import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { getPostureAssessment } from '@/data/posture';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import { PostureCapture } from '@/components/posture/PostureCapture';

/** Retake some views of an existing assessment: `?views=front,back` (capture order is kept). */
export default async function RetakePostureViewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
  searchParams: Promise<{ views?: string }>;
}) {
  const { id, assessmentId } = await params;
  const requested = ((await searchParams).views ?? '').split(',');
  const views = POSTURE_VIEWS.filter((v): v is PostureView => requested.includes(v));
  if (!views.length) notFound();

  const db = getDb();
  const patient = await getPatient(db, id);
  const assessment = await getPostureAssessment(db, assessmentId);
  if (!patient || !assessment || assessment.patientId !== id) notFound();

  return (
    <PostureCapture
      patientId={id}
      patientName={`${patient.fullName} · ${patient.patientCode}`}
      retake={{ assessmentId, views }}
    />
  );
}
