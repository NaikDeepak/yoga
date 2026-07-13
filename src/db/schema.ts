import {
  pgTable, uuid, text, integer, real, numeric, boolean, date, timestamp, index, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientCode: text('patient_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  photoPath: text('photo_path'),
  age: integer('age'),
  gender: text('gender'),
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),
  mobile: text('mobile').notNull(),
  email: text('email'),
  address: text('address'),
  occupation: text('occupation'),
  emergencyContact: text('emergency_contact'),
  branch: text('branch'),
  birthDate: date('birth_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const patientProblems = pgTable('patient_problems', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  problem: text('problem').notNull(),
  isCustom: boolean('is_custom').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  docType: text('doc_type').notNull(),
  filePath: text('file_path').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const treatmentPlans = pgTable('treatment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  yogaProgram: text('yoga_program'),
  pranayam: text('pranayam'),
  massage: text('massage'),
  yogaTherapy: text('yoga_therapy'),
  dietPlan: text('diet_plan'),
  medicines: text('medicines'),
  panchkarma: text('panchkarma'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const visits = pgTable('visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  visitDate: date('visit_date').notNull(),
  progressNote: text('progress_note').notNull(),
  weightKg: real('weight_kg'),
  painScale: integer('pain_scale'),
  nextVisitDate: date('next_visit_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('visits_patient_latest_idx').on(table.patientId, table.visitDate.desc(), table.createdAt.desc())
]).enableRLS();

export type Patient = typeof patients.$inferSelect;
export type PatientProblem = typeof patientProblems.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type Visit = typeof visits.$inferSelect;

export const lifestyleAssessments = pgTable('lifestyle_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  // Section 1: Primary Concern
  chiefComplaint: text('chief_complaint'),
  duration: text('duration'),
  aggravatingFactors: text('aggravating_factors'),
  relievingFactors: text('relieving_factors'),
  previousTreatment: text('previous_treatment'),
  // Section 2: Medications & Restrictions
  currentMedications: text('current_medications'),
  doctorDiagnosis: text('doctor_diagnosis'),
  doctorRestrictions: text('doctor_restrictions'),
  // Section 3: Lifestyle
  workType: text('work_type'),
  dailySitting: text('daily_sitting'),
  activityLevel: text('activity_level'),
  sleepHours: text('sleep_hours'),
  sleepQuality: integer('sleep_quality'),
  stressLevel: integer('stress_level'),
  screenTime: text('screen_time'),
  // Section 4: Exercise History
  previousExercise: text('previous_exercise'),
  fitnessLevel: text('fitness_level'),
  fearOfMovement: boolean('fear_of_movement'),
  // Section 5: Goals & Safety
  primaryGoal: text('primary_goal'),
  activityStruggle: text('activity_struggle'),
  hasContraindications: boolean('has_contraindications'),
  contraindicationDetails: text('contraindication_details'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export type LifestyleAssessment = typeof lifestyleAssessments.$inferSelect;

export const fees = pgTable('fees', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().unique()
    .references(() => patients.id, { onDelete: 'cascade' }),
  courseFee: numeric('course_fee', { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const feePayments = pgTable('fee_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('fee_payments_patient_history_idx').on(table.patientId, table.paymentDate, table.createdAt)
]).enableRLS();

export type FeeRow = typeof fees.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey(),
  language: text('language').notNull().default('en'),
  whatsappNumber: text('whatsapp_number'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('language_check', sql`language IN ('en', 'mr')`),
  check('whatsapp_number_check', sql`whatsapp_number IS NULL OR whatsapp_number ~ '^[0-9]{10}$'`),
]).enableRLS();

export type UserPreference = typeof userPreferences.$inferSelect;

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameMr: text('name_mr').notNull(),
  category: text('category').notNull(), // 'neck', 'back', 'core', 'lower_body'
  description: text('description'),
  descriptionMr: text('description_mr'),
  repetitions: text('repetitions').notNull(),
  repetitionsMr: text('repetitions_mr').notNull(),
  daysPerWeek: text('days_per_week').notNull(),
  daysPerWeekMr: text('days_per_week_mr').notNull(),
  steps: text('steps').array().notNull(), // text array
  stepsMr: text('steps_mr').array().notNull(), // text array
  tip: text('tip'),
  tipMr: text('tip_mr'),
  imagePath: text('image_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}).enableRLS();

export const prescribedExercises = pgTable('prescribed_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  // Per-patient dose overrides; null falls back to the exercise's library default.
  repetitions: text('repetitions'),
  daysPerWeek: text('days_per_week'),
  customNote: text('custom_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('prescribed_exercises_patient_idx').on(table.patientId),
]).enableRLS();

export type Exercise = typeof exercises.$inferSelect;
export type PrescribedExerciseRow = typeof prescribedExercises.$inferSelect;

