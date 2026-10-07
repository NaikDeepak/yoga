import { z } from 'zod';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a #RRGGBB colour');

export const clinicBranchSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  fullAddress: z.string().min(1),
});

export type ClinicBranch = z.infer<typeof clinicBranchSchema>;

export const clinicProfileSchema = z.object({
  slug: z.string().min(1),
  name: z.object({
    en: z.string().min(1),
    mr: z.string().min(1),
  }),
  shortName: z.object({
    en: z.string().min(1),
    mr: z.string().min(1),
  }),
  // Printed under the name on report letterheads; optional.
  tagline: z.string().min(1).optional(),
  logo: z.object({
    src: z.string().min(1),
    alt: z.string().min(1),
  }),
  // Home-screen app icons (PWA manifest); files live in public/clinics/<slug>/.
  icons: z.object({
    icon192: z.string().min(1),
    icon512: z.string().min(1),
    maskable512: z.string().min(1),
  }),
  // Printed reports/receipts and the installed app's chrome. The in-app theme stays in globals.css.
  brand: z.object({
    primary: hex,
    accent: hex,
    cream: hex,
    themeColor: hex,
    background: hex,
  }),
  contact: z.object({
    phone: z.string().min(1),
    whatsappDigits: z.string().min(1),
    email: z.string().email(),
    hours: z.string().min(1),
  }),
  signature: z.object({
    name: z.string().min(1),
    lines: z.array(z.string()),
    // Sign-off lines under greetings sent to clients (e.g. the birthday wish), per language.
    wishSignOff: z.object({ en: z.string().min(1), mr: z.string().min(1) }),
  }),
  branches: z
    .array(clinicBranchSchema)
    .min(1, 'At least one branch is required')
    .refine(
      (branches) => {
        const keys = branches.map((b) => b.key);
        return new Set(keys).size === keys.length;
      },
      { message: 'Branch keys must be unique' }
    ),
  patientCodePrefix: z
    .string()
    .min(1)
    .regex(/^[A-Za-z]+$/, 'patientCodePrefix must contain letters only'),
  appName: z.string().optional(),
  features: z.object({
    posture: z.boolean(),
    flexibility: z.boolean(),
    ai: z.boolean(),
    shareLinks: z.boolean(),
    checkins: z.boolean(),
  }),
});

export type ClinicProfile = z.infer<typeof clinicProfileSchema>;
