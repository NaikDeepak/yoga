import { count } from 'drizzle-orm';
import {
  patients, patientProblems, visits, lifestyleAssessments, treatmentPlans, fees, feePayments,
} from './schema';
import type { Db } from './types';
import { getISTDateString } from '@/lib/dates';

// Dates relative to today (IST, matching the app's date math) so charts,
// agenda, and calendar always show data.
const isoDate = (offsetDays: number): string => getISTDateString(offsetDays);

// Seeds demo data for local mock mode. Idempotent: no-op unless the DB is empty.
// Documents are deliberately not seeded — their rows must reference real files.
export async function seedMockData(db: Db): Promise<void> {
  const [{ n }] = await db.select({ n: count() }).from(patients);
  if (Number(n) > 0) return;

  const rows = await db.insert(patients).values([
    { patientCode: 'PYT-0001', fullName: 'Asha Kulkarni', age: 46, gender: 'female', weightKg: 68, heightCm: 158, mobile: '9000000001', occupation: 'Teacher', branch: 'Manjari BK' },
    { patientCode: 'PYT-0002', fullName: 'Ramesh Patil', age: 55, gender: 'male', weightKg: 82, heightCm: 172, mobile: '9000000002', occupation: 'Farmer', branch: 'Manjari BK' },
    { patientCode: 'PYT-0003', fullName: 'Sunita Deshmukh', age: 38, gender: 'female', weightKg: 74, heightCm: 162, mobile: '9000000003', occupation: 'Software engineer', branch: 'Kharadi' },
    { patientCode: 'PYT-0004', fullName: 'Vikram Joshi', age: 42, gender: 'male', weightKg: 90, heightCm: 175, mobile: '9000000004', occupation: 'Bank manager', branch: 'Kharadi' },
    { patientCode: 'PYT-0005', fullName: 'Meera Pawar', age: 29, gender: 'female', weightKg: 58, heightCm: 155, mobile: '9000000005', occupation: 'Homemaker', branch: 'Morgaon' },
    { patientCode: 'PYT-0006', fullName: 'Dattatray Shinde', age: 63, gender: 'male', weightKg: 70, heightCm: 165, mobile: '9000000006', occupation: 'Retired', branch: 'Morgaon' },
  ]).returning({ id: patients.id });
  const [asha, ramesh, sunita, vikram, meera, datta] = rows.map((r) => r.id);

  await db.insert(patientProblems).values([
    { patientId: asha, problem: 'कंबर दुखी' },
    { patientId: asha, problem: 'स्थूलता' },
    { patientId: ramesh, problem: 'गुडघे दुखी' },
    { patientId: ramesh, problem: 'बीपी' },
    { patientId: sunita, problem: 'मान दुखी' },
    { patientId: sunita, problem: 'स्ट्रेस' },
    { patientId: vikram, problem: 'डायबिटीस' },
    { patientId: vikram, problem: 'स्थूलता' },
    { patientId: meera, problem: 'PCOD/PCOS' },
    { patientId: datta, problem: 'सांधेदुखी' },
    { patientId: datta, problem: 'निद्रानाश' },
  ]);

  await db.insert(visits).values([
    // Asha: steady improvement, next follow-up this week
    { patientId: asha, visitDate: isoDate(-42), progressNote: 'First session. Severe lower back pain, limited mobility.', weightKg: 70, painScale: 8 },
    { patientId: asha, visitDate: isoDate(-28), progressNote: 'Pain reduced after two weeks of gentle asanas.', weightKg: 69, painScale: 6 },
    { patientId: asha, visitDate: isoDate(-14), progressNote: 'Sleeping better, pain now intermittent.', weightKg: 68.5, painScale: 4 },
    { patientId: asha, visitDate: isoDate(-3), progressNote: 'Good progress; started strengthening sequence.', weightKg: 68, painScale: 3, nextVisitDate: isoDate(4) },
    // Ramesh: knee pain, follow-up tomorrow
    { patientId: ramesh, visitDate: isoDate(-21), progressNote: 'Knee pain while climbing stairs. Started chair-assisted poses.', weightKg: 83, painScale: 7 },
    { patientId: ramesh, visitDate: isoDate(-7), progressNote: 'Mild relief; BP stable this week.', weightKg: 82, painScale: 5, nextVisitDate: isoDate(1) },
    // Sunita: neck pain from desk work
    { patientId: sunita, visitDate: isoDate(-10), progressNote: 'Neck stiffness from long desk hours. Taught shoulder rolls and neck stretches.', weightKg: 74, painScale: 6, nextVisitDate: isoDate(5) },
    // Vikram: weight management
    { patientId: vikram, visitDate: isoDate(-30), progressNote: 'Baseline session. Sugar levels borderline; starting surya namaskar program.', weightKg: 92, painScale: 2 },
    { patientId: vikram, visitDate: isoDate(-15), progressNote: 'Lost 1 kg; energy improving.', weightKg: 91, painScale: 2, nextVisitDate: isoDate(6) },
    // Meera: recent first visit
    { patientId: meera, visitDate: isoDate(-5), progressNote: 'Initial consultation for PCOD. Cycle irregular; started butterfly and cobra sequences.', weightKg: 58, painScale: 1, nextVisitDate: isoDate(9) },
    // Dattatray: joint pain, ongoing
    { patientId: datta, visitDate: isoDate(-18), progressNote: 'Morning joint stiffness. Warm-up flow prescribed.', weightKg: 70, painScale: 6 },
    { patientId: datta, visitDate: isoDate(-4), progressNote: 'Stiffness eases faster now; sleep still disturbed.', weightKg: 70, painScale: 5, nextVisitDate: isoDate(10) },
  ]);

  await db.insert(lifestyleAssessments).values([
    {
      patientId: asha,
      chiefComplaint: 'Lower back pain radiating to left hip',
      duration: '6 months',
      aggravatingFactors: 'Standing for long periods, lifting',
      relievingFactors: 'Rest, hot water bag',
      previousTreatment: 'Painkillers from family doctor',
      currentMedications: 'None',
      doctorDiagnosis: 'Lumbar spondylosis (mild)',
      doctorRestrictions: 'No heavy lifting',
      workType: 'Standing',
      dailySitting: '2-3 hours',
      activityLevel: 'Light',
      sleepHours: '6',
      sleepQuality: 5,
      stressLevel: 6,
      screenTime: '2 hours',
      previousExercise: 'Morning walks, irregular',
      fitnessLevel: 'Average',
      fearOfMovement: true,
      primaryGoal: 'Pain-free daily routine',
      activityStruggle: 'Bending forward',
      hasContraindications: false,
    },
    {
      patientId: sunita,
      chiefComplaint: 'Neck and shoulder stiffness',
      duration: '1 year',
      aggravatingFactors: 'Long laptop hours',
      relievingFactors: 'Stretching breaks',
      previousTreatment: 'Physiotherapy, 10 sessions',
      currentMedications: 'None',
      workType: 'Desk',
      dailySitting: '9 hours',
      activityLevel: 'Sedentary',
      sleepHours: '7',
      sleepQuality: 6,
      stressLevel: 8,
      screenTime: '11 hours',
      previousExercise: 'Gym, stopped 2 years ago',
      fitnessLevel: 'Below average',
      fearOfMovement: false,
      primaryGoal: 'Stress relief and posture correction',
      activityStruggle: 'Finding time',
      hasContraindications: false,
    },
  ]);

  await db.insert(treatmentPlans).values([
    {
      patientId: asha,
      yogaProgram: 'Marjaryasana, Setu Bandhasana, Shalabhasana — 30 min daily, 5 days/week',
      pranayam: 'Anulom Vilom 10 min every morning',
      massage: 'Weekly lower-back abhyanga with warm sesame oil',
      yogaTherapy: 'Supported backbends with bolster; avoid deep forward folds',
      dietPlan: 'Warm home-cooked meals, reduce fried snacks, dinner before 8 pm',
      medicines: 'Triphala churna 1 tsp at bedtime',
      panchkarma: '',
    },
  ]);

  await db.insert(fees).values([
    { patientId: asha, courseFee: '12000.00' },
    { patientId: ramesh, courseFee: '10000.00' },
    { patientId: sunita, courseFee: '8000.00' },
  ]);

  await db.insert(feePayments).values([
    { patientId: asha, amount: '6000.00', paymentDate: isoDate(-42), description: 'Advance / आगाऊ रक्कम' },
    { patientId: asha, amount: '3000.00', paymentDate: isoDate(-14), description: 'Second instalment' },
    { patientId: ramesh, amount: '10000.00', paymentDate: isoDate(-21), description: 'Full payment' },
    { patientId: sunita, amount: '4000.00', paymentDate: isoDate(-10), description: 'Advance' },
  ]);
}
