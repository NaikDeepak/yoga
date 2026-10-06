import { z } from 'zod';
import { BRANCHES, DOC_TYPES } from './presets';
import { getISTDateString } from './dates';
import { FEE_TYPE_KEYS } from './feeTypes';
import { POSE_LANDMARK_COUNT, POSTURE_VIEWS } from './posture';
import { isLevel } from './posture-capture';
import { FLEX_SHOTS } from './flexibility';

const blankToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndef, s.optional());

function isCalendarValid(val: string): boolean {
  const [y, m, d] = val.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const patientSchema = z.object({
  fullName: z.string().trim().min(1, 'Name required / नाव आवश्यक'),
  mobile: z.string().trim().regex(/^\d{10}$/, '10-digit mobile required / १० अंकी मोबाईल आवश्यक'),
  age: opt(z.coerce.number().int().min(1).max(120)),
  gender: opt(z.enum(['male', 'female', 'other'])),
  weightKg: opt(z.coerce.number().positive().max(300)),
  heightCm: opt(z.coerce.number().positive().max(250)),
  email: opt(z.string().trim().email('Invalid email / चुकीचा ईमेल')),
  address: opt(z.string().trim().max(500)),
  occupation: opt(z.string().trim().max(100)),
  emergencyContact: opt(z.string().trim().max(100)),
  branch: opt(z.enum(BRANCHES.map(b => b.key) as [string, ...string[]], { message: 'Invalid branch / चुकीची शाखा' })),
  birthDate: opt(
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / चुकीची तारीख')
      .refine(isCalendarValid, 'Invalid date / चुकीची तारीख')
      .refine((val) => val <= getISTDateString(0), 'Birth date cannot be in the future / जन्मतारीख भविष्यातील असू शकत नाही')
  ),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const problemSchema = z.object({
  problem: z.string().trim().min(1, 'Problem required / आजार आवश्यक').max(200),
  isCustom: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  note: opt(z.string().trim().max(500)),
});
export type ProblemInput = z.infer<typeof problemSchema>;

export const treatmentSchema = z.object({
  yogaProgram: opt(z.string().trim().max(2000)),
  pranayam: opt(z.string().trim().max(2000)),
  massage: opt(z.string().trim().max(2000)),
  yogaTherapy: opt(z.string().trim().max(2000)),
  dietPlan: opt(z.string().trim().max(2000)),
  medicines: opt(z.string().trim().max(2000)),
  panchkarma: opt(z.string().trim().max(2000)),
});
export type TreatmentInput = z.infer<typeof treatmentSchema>;

export const visitSchema = z.object({
  visitDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date required / तारीख आवश्यक')
    .refine(isCalendarValid, 'Invalid date / चुकीची तारीख'),
  progressNote: z.string().trim().min(1, 'Note required / नोंद आवश्यक').max(5000),
  weightKg: opt(z.coerce.number().positive().max(300)),
  painScale: opt(z.coerce.number().int().min(1).max(10)),
  nextVisitDate: opt(
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / चुकीची तारीख')
      .refine(isCalendarValid, 'Invalid date / चुकीची तारीख')
      .refine((val) => {
        const d = new Date(Date.now() + 330 * 60_000);
        const todayIST = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        return val >= todayIST;
      }, {
        message: 'Must be today or later / आज किंवा नंतरची तारीख असावी',
      })
  ),
});
export type VisitInput = z.infer<typeof visitSchema>;

export const docTypeSchema = z.enum(DOC_TYPES);

export const whatsappNumberSchema = z.object({
  whatsappNumber: opt(
    z.string().trim().regex(/^\d{10}$/, '10-digit mobile required / १० अंकी मोबाईल आवश्यक')
  ),
});
export type WhatsappNumberInput = z.infer<typeof whatsappNumberSchema>;

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input / चुकीची माहिती';
}

export const lifestyleSchema = z.object({
  // Section 1: Primary Concern
  chiefComplaint: opt(z.string().trim().max(1000)),
  duration: opt(z.string().trim().max(500)),
  aggravatingFactors: opt(z.string().trim().max(1000)),
  relievingFactors: opt(z.string().trim().max(1000)),
  previousTreatment: opt(z.string().trim().max(1000)),
  // Section 2: Medications & Restrictions
  currentMedications: opt(z.string().trim().max(500)),
  doctorDiagnosis: opt(z.string().trim().max(500)),
  doctorRestrictions: opt(z.string().trim().max(500)),
  // Section 3: Lifestyle
  workType: opt(z.enum(['desk', 'standing', 'physical'])),
  dailySitting: opt(z.enum(['<2h', '2-4h', '4-8h', '8+h'])),
  activityLevel: opt(z.enum(['sedentary', 'light', 'active'])),
  sleepHours: opt(z.string().trim().max(500)),
  sleepQuality: opt(z.coerce.number().int().min(1).max(10)),
  stressLevel: opt(z.coerce.number().int().min(1).max(10)),
  screenTime: opt(z.string().trim().max(500)),
  // Section 4: Exercise History
  previousExercise: opt(z.string().trim().max(500)),
  fitnessLevel: opt(z.enum(['beginner', 'intermediate', 'active'])),
  fearOfMovement: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  // Section 5: Goals & Safety
  primaryGoal: opt(z.string().trim().max(1000)),
  activityStruggle: opt(z.string().trim().max(500)),
  hasContraindications: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  contraindicationDetails: opt(z.string().trim().max(1000)),
});
export type LifestyleInput = z.infer<typeof lifestyleSchema>;

export const courseFeeSchema = z.object({
  courseFee: z.coerce.number().positive('Fee must be positive / शुल्क सकारात्मक असणे आवश्यक आहे'),
});
export type CourseFeeInput = z.infer<typeof courseFeeSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive / रक्कम सकारात्मक असणे आवश्यक आहे'),
  paymentDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / अवैध तारीख')
    .refine(isCalendarValid, 'Invalid date / चुकीची तारीख'),
  description: opt(z.string().trim().max(200, 'Description too long / तपशील खूप मोठा आहे')),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const chargeSchema = z.object({
  feeType: z.enum(FEE_TYPE_KEYS, { message: 'Invalid fee type / अवैध शुल्क प्रकार' }),
  customLabel: opt(z.string().trim().max(100, 'Label too long / लेबल खूप मोठे')),
  amount: z.coerce.number().positive('Amount must be positive / रक्कम सकारात्मक असणे आवश्यक आहे'),
  chargeDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / अवैध तारीख')
    .refine(isCalendarValid, 'Invalid date / चुकीची तारीख'),
  note: opt(z.string().trim().max(200, 'Note too long / टीप खूप मोठी आहे')),
}).refine((data) => data.feeType !== 'other' || !!data.customLabel, {
  message: 'Label required / लेबल आवश्यक आहे',
  path: ['customLabel'],
});
export type ChargeInput = z.infer<typeof chargeSchema>;

export const prescribedExerciseSchema = z.object({
  exerciseId: z.string().uuid('Invalid exercise / अमान्य व्यायाम'),
  customNote: opt(z.string().trim().max(500, 'Note too long / टीप खूप मोठी आहे')).nullable(),
  repetitions: opt(z.string().trim().max(100, 'Too long / खूप मोठे')).nullable(),
  daysPerWeek: opt(z.string().trim().max(100, 'Too long / खूप मोठे')).nullable(),
});

export const prescribedExercisesListSchema = z.array(prescribedExerciseSchema).refine(
  (list) => new Set(list.map((item) => item.exerciseId)).size === list.length,
  'Duplicate exercise in selection / निवडीत व्यायामाची पुनरावृत्ती',
);
export type PrescribedExerciseInput = z.infer<typeof prescribedExerciseSchema>;


// Posture assessment payload (JSON part of the capture form; photos are sent as separate files).
const POSTURE_DATA_ERR = { error: 'Invalid posture data / चुकीची पोश्चर माहिती' };
// MediaPipe reports out-of-frame points outside 0–1 (with low visibility); the capture screen clamps
// them to this range when cropping (remapToCrop), so anything beyond it is malformed.
const landmarkCoord = z.number(POSTURE_DATA_ERR).min(-0.5, POSTURE_DATA_ERR).max(1.5, POSTURE_DATA_ERR);

const capturedPhotoFields = {
  imageWidth: z.number(POSTURE_DATA_ERR).int(POSTURE_DATA_ERR).min(1, POSTURE_DATA_ERR).max(4096, POSTURE_DATA_ERR),
  imageHeight: z.number(POSTURE_DATA_ERR).int(POSTURE_DATA_ERR).min(1, POSTURE_DATA_ERR).max(4096, POSTURE_DATA_ERR),
  landmarks: z.array(z.object({
    x: landmarkCoord,
    y: landmarkCoord,
    visibility: z.number(POSTURE_DATA_ERR).min(0, POSTURE_DATA_ERR).max(1, POSTURE_DATA_ERR),
  }, POSTURE_DATA_ERR), POSTURE_DATA_ERR).length(POSE_LANDMARK_COUNT, POSTURE_DATA_ERR),
  landmarksEdited: z.boolean(POSTURE_DATA_ERR),
  cameraCheck: z.object({
    method: z.enum(['sensor', 'reference'], POSTURE_DATA_ERR),
    rollDeg: z.number(POSTURE_DATA_ERR).min(-45, POSTURE_DATA_ERR).max(45, POSTURE_DATA_ERR),
    pitchDeg: z.number(POSTURE_DATA_ERR).min(-90, POSTURE_DATA_ERR).max(90, POSTURE_DATA_ERR).nullable(),
  }, POSTURE_DATA_ERR).refine(
    (c) => isLevel(c),
    'Camera was not level — retake the photo / कॅमेरा सरळ नव्हता — फोटो पुन्हा घ्या',
  ),
};

const postureViewSchema = z.object({ view: z.enum(POSTURE_VIEWS, POSTURE_DATA_ERR), ...capturedPhotoFields }, POSTURE_DATA_ERR);

export const postureAssessmentSchema = z.object({
  consent: z.literal(true, { error: 'Photo consent required / फोटोसाठी संमती आवश्यक' }),
  assessedOn: z.preprocess(
    (v) => blankToUndef(v) ?? getISTDateString(),
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date / चुकीची तारीख')
      .refine(isCalendarValid, 'Invalid date / चुकीची तारीख'),
  ),
  note: opt(z.string().trim().max(1000, 'Note too long / टीप खूप मोठी आहे')),
  views: z.array(postureViewSchema, POSTURE_DATA_ERR).refine(
    (views) => views.length === POSTURE_VIEWS.length && new Set(views.map((v) => v.view)).size === POSTURE_VIEWS.length,
    'All four views required (front, back, left, right) / चारही बाजूंचे फोटो आवश्यक (समोर, मागे, डावी, उजवी)',
  ),
});

export type PostureAssessmentPayload = z.infer<typeof postureAssessmentSchema>;

/** Retaking some views of an existing assessment (consent was recorded with the original). */
export const postureRetakeSchema = z.object({
  /** Only sent when the assessment's photos were deleted (consent withdrawn) and the client agreed again. */
  consent: z.literal(true).optional(),
  views: z.array(postureViewSchema, POSTURE_DATA_ERR)
    .min(1, POSTURE_DATA_ERR)
    .max(POSTURE_VIEWS.length, POSTURE_DATA_ERR)
    .refine((views) => new Set(views.map((v) => v.view)).size === views.length, POSTURE_DATA_ERR),
});

/** Flexibility shots for an existing assessment: any 1–4 distinct shots (first capture or retakes). */
export const flexibilityShotsSchema = z.object({
  /** Only sent when the assessment's photos were deleted (consent withdrawn) and the client agreed again. */
  consent: z.literal(true).optional(),
  shots: z.array(z.object({ shot: z.enum(FLEX_SHOTS, POSTURE_DATA_ERR), ...capturedPhotoFields }, POSTURE_DATA_ERR), POSTURE_DATA_ERR)
    .min(1, POSTURE_DATA_ERR)
    .max(FLEX_SHOTS.length, POSTURE_DATA_ERR)
    .refine((shots) => new Set(shots.map((s) => s.shot)).size === shots.length, POSTURE_DATA_ERR),
});
export type FlexibilityShotsPayload = z.infer<typeof flexibilityShotsSchema>;

// Daily home-exercise check-in from the public share page. No free text; date and client come from the server.
export const checkinSchema = z.object({
  done: z.enum(['all', 'some', 'none']),
  pain: opt(z.coerce.number().int().min(0).max(10)),
  /** Day the form was shown; only honoured just after midnight (see checkinDay). */
  day: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
export type CheckinInput = z.infer<typeof checkinSchema>;
