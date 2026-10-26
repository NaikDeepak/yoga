import type { ClinicProfile } from './types';

export const sunrise: ClinicProfile = {
  slug: 'sunrise',
  name: {
    en: 'Sunrise Physio Clinic',
    mr: 'सनराइज फिजिओ क्लिनिक',
  },
  shortName: {
    en: 'Sunrise Physio',
    mr: 'सनराइज फिजिओ',
  },
  tagline: 'EVIDENCE-BASED REHABILITATION & PHYSIOTHERAPY',
  logo: {
    src: '/clinics/sunrise/logo.png',
    alt: 'Sunrise Physio Clinic',
  },
  icons: {
    icon192: '/clinics/sunrise/icons/icon-192.png',
    icon512: '/clinics/sunrise/icons/icon-512.png',
    maskable512: '/clinics/sunrise/icons/icon-512-maskable.png',
  },
  brand: {
    primary: '#1F5F8B',
    accent: '#2A9D8F',
    accentText: '#1E7268',
    cream: '#EBF3F8',
    themeColor: '#1F5F8B',
    background: '#F5F9FC',
  },
  theme: {
    primary: '#1F5F8B',
    primaryForeground: '#FFFFFF',
    ring: '#1F5F8B',
    background: '#F5F9FC',
    foreground: '#14222E',
    accent: '#2A9D8F',
    accentText: '#1E7268',
  },
  contact: {
    phone: '+91 90000 00000',
    whatsappDigits: '919000000000',
    email: 'hello@sunrise-physio.example',
    hours: 'Mon–Sat, 8:00 AM – 7:00 PM',
  },
  signature: {
    name: 'Dr. Asha Kulkarni, PT',
    lines: [
      'Consultant Physiotherapist | B.P.Th, M.P.Th (Musculoskeletal)',
      'Sunrise Physio Clinic',
    ],
    wishSignOff: {
      en: 'Dr. Asha Kulkarni, PT\nSunrise Physio Clinic',
      mr: 'डॉ. आशा कुलकर्णी, पी.टी.\nसनराइज फिजिओ क्लिनिक',
    },
  },
  branches: [
    {
      key: 'Baner',
      label: 'Baner',
      fullAddress:
        'Shop 4, Silver Crest, Pan Card Club Road, Baner, Pune, Maharashtra 411045',
    },
    {
      key: 'Wakad',
      label: 'Wakad',
      fullAddress:
        'Office 201, Aster Plaza, Datta Mandir Road, Wakad, Pune, Maharashtra 411057',
    },
  ],
  patientCodePrefix: 'SRP',
  appName: 'Sunrise Physio',
  practice: {
    type: 'physio',
    treatmentSections: [
      'exerciseTherapy',
      'manualTherapy',
      'electrotherapy',
      'homeProgramme',
      'advice',
    ],
    feeTypes: [
      { key: 'assessment', defaultAmount: 800 },
      { key: 'session', defaultAmount: 600 },
      { key: 'package', defaultAmount: null },
      { key: 'other', defaultAmount: null },
    ],
  },
  features: {
    posture: false,
    flexibility: false,
    ai: false,
    shareLinks: true,
    checkins: true,
    fees: true,
  },
};
