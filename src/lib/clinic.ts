import { clinicProfile } from '@/clinics';

export const CLINIC = {
  name: clinicProfile.name.en,
  phone: clinicProfile.contact.phone,
  email: clinicProfile.contact.email,
  hours: clinicProfile.contact.hours,
  whatsappDigits: clinicProfile.contact.whatsappDigits,
} as const;
