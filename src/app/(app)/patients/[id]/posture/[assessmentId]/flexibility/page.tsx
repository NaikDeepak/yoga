import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { consentWithdrawn, getPostureAssessment } from '@/data/posture';
import { FLEX_SHOTS, type FlexShot } from '@/lib/flexibility';
import { PostureCapture } from '@/components/posture/PostureCapture';

/** Flexibility tests for an existing assessment: all four shots, or `?shots=forwardFold,butterfly` to retake some. */
export default async function FlexibilityCapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
  searchParams: Promise<{ shots?: string }>;
}) {
  const { id, assessmentId } = await params;
  const requested = (await searchParams).shots?.split(',');
  const shots = requested ? FLEX_SHOTS.filter((s): s is FlexShot => requested.includes(s)) : [...FLEX_SHOTS];
  if (!shots.length) notFound();

  const db = getDb();
  const patient = await getPatient(db, id);
  const assessment = await getPostureAssessment(db, assessmentId);
  if (!patient || !assessment || assessment.patientId !== id) notFound();

  return (
    <PostureCapture
      patientId={id}
      patientName={`${patient.fullName} · ${patient.patientCode}`}
      flexibility={{ assessmentId, shots }}
      reconsent={consentWithdrawn(assessment)}
    />
  );
}
