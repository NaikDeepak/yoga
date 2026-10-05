import {
  pgTable, uuid, text, integer, real, numeric, boolean, date, timestamp, index, uniqueIndex, check, jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Landmark, Metric } from '@/lib/posture';
import type { CameraCheck } from '@/lib/posture-capture';
import type { PostureAiReport } from '@/lib/posture-ai';

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

export const charges = pgTable('charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  feeType: text('fee_type').notNull(), // 'consultation' | 'monthly_yoga' | 'package' | 'other'
  label: text('label').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  chargeDate: date('charge_date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('charges_patient_history_idx').on(table.patientId, table.chargeDate, table.createdAt)
]).enableRLS();

export type Charge = typeof charges.$inferSelect;

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
  // Unique: seeding upserts and orphan detection key on name.
  name: text('name').notNull().unique(),
  nameMr: text('name_mr').notNull(),
  category: text('category').notNull(),
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
}, () => [
  check('exercises_category_check', sql`category IN ('neck', 'back', 'core', 'lower_body', 'shoulder')`),
]).enableRLS();

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
  // One prescription per patient per exercise; save replaces the whole set.
  uniqueIndex('prescribed_exercises_patient_exercise_uq').on(table.patientId, table.exerciseId),
]).enableRLS();

export type Exercise = typeof exercises.$inferSelect;
export type PrescribedExerciseRow = typeof prescribedExercises.$inferSelect;


export const postureAssessments = pgTable('posture_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  assessedOn: date('assessed_on').notNull(),
  heightCm: real('height_cm'), // snapshot of client height used for cm conversion
  note: text('note'),
  consentAt: timestamp('consent_at').notNull(), // when the photo-consent checkbox was ticked
  // AI-written analysis (see lib/posture-ai.ts). Draft until the physio approves it.
  aiReport: jsonb('ai_report').$type<PostureAiReport>(),
  aiGeneratedAt: timestamp('ai_generated_at'),
  aiApprovedAt: timestamp('ai_approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('posture_assessments_patient_idx').on(table.patientId, table.assessedOn),
]).enableRLS();

export const postureViews = pgTable('posture_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').notNull()
    .references(() => postureAssessments.id, { onDelete: 'cascade' }),
  view: text('view').notNull(), // 'front' | 'back' | 'left' | 'right'
  filePath: text('file_path').notNull(), // private bucket; signed URLs only
  imageWidth: integer('image_width').notNull(),
  imageHeight: integer('image_height').notNull(),
  landmarks: jsonb('landmarks').$type<Landmark[]>().notNull(), // 33 × {x,y,visibility}, normalised 0–1
  landmarksEdited: boolean('landmarks_edited').default(false).notNull(),
  metrics: jsonb('metrics').$type<Metric[]>().notNull(), // always computed server-side from landmarks
  // How camera level was verified at capture: phone gravity sensor, or a door-frame reference line
  // (roll only). Null for rows captured before this was recorded.
  cameraCheck: jsonb('camera_check').$type<CameraCheck>(),
}, (table) => [
  uniqueIndex('posture_views_assessment_view_uq').on(table.assessmentId, table.view),
  check('posture_views_view_check', sql`${table.view} IN ('front', 'back', 'left', 'right')`),
]).enableRLS();

export type PostureAssessmentRow = typeof postureAssessments.$inferSelect;
export type PostureViewRow = typeof postureViews.$inferSelect;

// Client share links (spec 2026-10-05-client-exercise-link). Only the token's SHA-256 is stored.
export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  viewCount: integer('view_count').notNull().default(0),
  lastViewedAt: timestamp('last_viewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('share_links_patient_kind_idx').on(table.patientId, table.kind),
  // At most one unrevoked link per client and kind ("Share again" replaces the old link).
  uniqueIndex('share_links_one_live_uq').on(table.patientId, table.kind).where(sql`${table.revokedAt} IS NULL`),
  check('share_links_kind_check', sql`${table.kind} IN ('exercises')`),
]).enableRLS();

export type ShareLinkRow = typeof shareLinks.$inferSelect;
export type ShareLinkKind = 'exercises';

// Daily home-exercise check-ins from the client's share-link page (spec 2026-10-05-exercise-checkin).
export const exerciseCheckins = pgTable('exercise_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  shareLinkId: uuid('share_link_id')
    .references(() => shareLinks.id, { onDelete: 'set null' }),
  checkinDate: date('checkin_date').notNull(), // clinic (IST) day, set by the server
  done: text('done').notNull(),
  painScale: integer('pain_scale'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('exercise_checkins_patient_date_uq').on(table.patientId, table.checkinDate),
  check('exercise_checkins_done_check', sql`${table.done} IN ('all', 'some', 'none')`),
  check('exercise_checkins_pain_check', sql`${table.painScale} IS NULL OR ${table.painScale} BETWEEN 0 AND 10`),
]).enableRLS();

export type ExerciseCheckinRow = typeof exerciseCheckins.$inferSelect;
