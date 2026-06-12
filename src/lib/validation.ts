import { z } from 'zod';
import { DOC_TYPES } from './presets';

const blankToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndef, s.optional());

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
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date required / तारीख आवश्यक'),
  progressNote: z.string().trim().min(1, 'Note required / नोंद आवश्यक').max(5000),
  weightKg: opt(z.coerce.number().positive().max(300)),
  painScale: opt(z.coerce.number().int().min(1).max(10)),
});
export type VisitInput = z.infer<typeof visitSchema>;

export const docTypeSchema = z.enum(DOC_TYPES);

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input / चुकीची माहिती';
}
