import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { listVisits } from '@/data/visits';
import { computeBmi } from '@/lib/bmi';
import { generateTreatmentDraft, type TreatmentContext } from '@/lib/gemini';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
    }

    const { patientId } = await params;
    const db = getDb();

    const patient = await getPatient(db, patientId);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found / रुग्ण सापडला नाही' }, { status: 404 });
    }

    const [problems, lifestyle, allVisits] = await Promise.all([
      listProblems(db, patientId),
      getLifestyleAssessment(db, patientId),
      listVisits(db, patientId),
    ]);

    // listVisits returns desc order: index 0 = most recent visit
    const visitsWithWeight = allVisits.filter((v) => v.weightKg != null);

    const context: TreatmentContext = {
      patient: {
        fullName: patient.fullName,
        age: patient.age ?? null,
        gender: patient.gender ?? null,
        weightKg: patient.weightKg ?? null,
        heightCm: patient.heightCm ?? null,
      },
      bmi: computeBmi(patient.weightKg, patient.heightCm),
      ailments: problems.map((p) => p.problem),
      lifestyle: lifestyle
        ? {
            chiefComplaint: lifestyle.chiefComplaint ?? null,
            duration: lifestyle.duration ?? null,
            aggravatingFactors: lifestyle.aggravatingFactors ?? null,
            relievingFactors: lifestyle.relievingFactors ?? null,
            previousTreatment: lifestyle.previousTreatment ?? null,
            currentMedications: lifestyle.currentMedications ?? null,
            doctorDiagnosis: lifestyle.doctorDiagnosis ?? null,
            doctorRestrictions: lifestyle.doctorRestrictions ?? null,
            workType: lifestyle.workType ?? null,
            dailySitting: lifestyle.dailySitting ?? null,
            activityLevel: lifestyle.activityLevel ?? null,
            sleepHours: lifestyle.sleepHours ?? null,
            sleepQuality: lifestyle.sleepQuality ?? null,
            stressLevel: lifestyle.stressLevel ?? null,
            screenTime: lifestyle.screenTime ?? null,
            previousExercise: lifestyle.previousExercise ?? null,
            fitnessLevel: lifestyle.fitnessLevel ?? null,
            fearOfMovement: lifestyle.fearOfMovement ?? null,
            primaryGoal: lifestyle.primaryGoal ?? null,
            activityStruggle: lifestyle.activityStruggle ?? null,
            hasContraindications: lifestyle.hasContraindications ?? null,
            contraindicationDetails: lifestyle.contraindicationDetails ?? null,
          }
        : null,
      visits: {
        count: allVisits.length,
        latestPainScale: allVisits[0]?.painScale ?? null,
        // visitsWithWeight is desc-ordered, so index 0 = newest, last = oldest
        latestWeightKg: visitsWithWeight[0]?.weightKg ?? null,
        firstWeightKg: visitsWithWeight[visitsWithWeight.length - 1]?.weightKg ?? null,
      },
    };

    const draft = await generateTreatmentDraft(context);
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
